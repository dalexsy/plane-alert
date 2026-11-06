package tests

import (
	"context"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"testing"
	"time"
)

func TestActualPlanesBinary(t *testing.T) {
	binary := os.Getenv("PLANE_SERVICE_BINARY")
	if binary == "" {
		t.Skip("native staging binary integration")
	}
	root := t.TempDir()
	write(t, root, "antenna-sightings.json", `{"sightings":{"abc123":{"hex":"abc123","lastFlight":"ISOLATED","flights":[],"lastSeen":100,"closestNm":2}}}`)
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	address := listener.Addr().String()
	_ = listener.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, binary, "-data", root, "-listen", address)
	if err = cmd.Start(); err != nil {
		t.Fatal(err)
	}
	defer func() { _ = cmd.Process.Kill(); _ = cmd.Wait() }()
	client := &http.Client{Timeout: time.Second}
	ready := false
	for i := 0; i < 40; i++ {
		res, err := client.Get("http://" + address + "/health")
		if err == nil {
			_ = res.Body.Close()
			if res.StatusCode == 200 {
				ready = true
				break
			}
		}
		time.Sleep(100 * time.Millisecond)
	}
	if !ready {
		t.Fatal("actual binary not healthy")
	}
	res, err := client.Get("http://" + address + "/antennaSightings")
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := io.ReadAll(res.Body)
	_ = res.Body.Close()
	if res.StatusCode != 200 || !strings.Contains(string(raw), `"hex":"abc123"`) {
		t.Fatalf("actual binary data failed: %d %s", res.StatusCode, raw)
	}
	res, err = client.Get("http://" + address + "/adsbPointProxy?lat=NaN&lon=0&radiusKm=100")
	if err != nil {
		t.Fatal(err)
	}
	_ = res.Body.Close()
	if res.StatusCode != 400 {
		t.Fatal("invalid coordinates accepted")
	}
}
