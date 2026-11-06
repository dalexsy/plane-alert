package tests

import (
	"bytes"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"syscall"
	"testing"
	"time"
)

func TestActualPollingBinaryDrainsObservedState(t *testing.T) {
	binary := os.Getenv("PLANE_SERVICE_BINARY")
	if binary == "" || runtime.GOOS != "linux" {
		t.Skip("native Linux ARM polling/drain fixture")
	}
	receiver := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"aircraft":[{"hex":"abc123","flight":"FIXTURE","messages":10}]}`))
	}))
	defer receiver.Close()
	root := t.TempDir()
	initial, _ := json.Marshal(map[string]any{"feedUrl": receiver.URL, "future": "preserved", "sightings": map[string]any{}})
	write(t, root, "antenna-sightings.json", string(initial))
	main := `{"deviceTokens":{},"future":9007199254740993}`
	write(t, root, "planes-api-store.json", main)
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	address := listener.Addr().String()
	_ = listener.Close()
	cmd := exec.Command(binary, "-data", root, "-listen", address)
	cmd.Env = append(os.Environ(), "PLANES_ANTENNA_ENABLED=1")
	var output bytes.Buffer
	cmd.Stdout = &output
	cmd.Stderr = &output
	if err = cmd.Start(); err != nil {
		t.Fatal(err)
	}
	defer func() { _ = cmd.Process.Kill() }()
	client := &http.Client{Timeout: time.Second}
	ready := false
	for i := 0; i < 40; i++ {
		res, err := client.Get("http://" + address + "/antennaSightings")
		if err == nil {
			raw, _ := io.ReadAll(res.Body)
			_ = res.Body.Close()
			if res.StatusCode == 200 && bytes.Contains(raw, []byte(`"hex":"abc123"`)) && bytes.Contains(raw, []byte(`"enabled":true`)) {
				ready = true
				break
			}
		}
		time.Sleep(100 * time.Millisecond)
	}
	if !ready {
		_ = cmd.Process.Kill()
		_ = cmd.Wait()
		t.Fatal("actual polling binary did not expose observed aircraft")
	}
	if err = cmd.Process.Signal(syscall.SIGTERM); err != nil {
		t.Fatal(err)
	}
	done := make(chan error, 1)
	go func() { done <- cmd.Wait() }()
	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("drain failed: %v %s", err, output.String())
		}
	case <-time.After(10 * time.Second):
		t.Fatal("drain timeout")
	}
	saved, err := os.ReadFile(filepath.Join(root, "antenna-sightings.json"))
	if err != nil || !bytes.Contains(saved, []byte(`"hex":"abc123"`)) || !bytes.Contains(saved, []byte("preserved")) {
		t.Fatal("observed fixture history not durably retained", err)
	}
	untouched, _ := os.ReadFile(filepath.Join(root, "planes-api-store.json"))
	if string(untouched) != main {
		t.Fatal("unrelated registrations/history rewritten")
	}
	original, _ := os.ReadFile(filepath.Join(root, "antenna-sightings.json.go-original.json"))
	if !bytes.Equal(original, initial) {
		t.Fatal("original snapshot missing")
	}
}
