package tests

import (
	"bytes"
	"context"
	"dryl-planes/internal/antenna"
	"dryl-planes/internal/diskstore"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestAntennaRejectsInvalidFeedWithoutWriting(t *testing.T) {
	for _, body := range []string{`{}`, `{"aircraft":"bad"}`, fmt.Sprintf(`{"now":%d,"aircraft":[]}`, time.Now().Unix()-180), fmt.Sprintf(`{"now":%d,"aircraft":[]}`, time.Now().Unix()+600)} {
		t.Run(body, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { _, _ = w.Write([]byte(body)) }))
			defer server.Close()
			root := t.TempDir()
			original := `{"sightings":{},"unknown":9007199254740993}`
			write(t, root, "antenna-sightings.json", original)
			path := filepath.Join(root, "antenna-sightings.json")
			e, err := antenna.New(path, server.URL, time.Second)
			if err != nil {
				t.Fatal(err)
			}
			if e.Poll(context.Background()) == nil {
				t.Fatal("invalid feed accepted")
			}
			if err := e.Flush(); err != nil {
				t.Fatal(err)
			}
			raw, _ := os.ReadFile(path)
			if string(raw) != original {
				t.Fatal("invalid feed changed history")
			}
		})
	}
}

func TestAntennaCapacityFailureRetainsOriginalSnapshot(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"aircraft":[{"hex":"abc123","messages":1}]}`))
	}))
	defer server.Close()
	root := t.TempDir()
	path := filepath.Join(root, "antenna-sightings.json")
	// Valid existing data just below the fixed limit; a new row exceeds it.
	original := []byte(`{"sightings":{},"unknown":"` + strings.Repeat("x", (16<<20)-100) + `"}`)
	write(t, root, "antenna-sightings.json", string(original))
	e, err := antenna.New(path, server.URL, time.Second)
	if err != nil {
		t.Fatal(err)
	}
	if e.Poll(context.Background()) == nil {
		t.Fatal("capacity failure hidden")
	}
	snapshot, _ := e.Snapshot()
	if string(snapshot["sightings"]) != "{}" || string(snapshot["lastPollOk"]) != "false" {
		t.Fatal("rejected observation leaked or failure hidden")
	}
	if err := e.Flush(); err != nil {
		t.Fatal(err)
	}
	raw, _ := os.ReadFile(path)
	if !bytes.Equal(raw, original) {
		t.Fatal("capacity failure modified household data")
	}
}

func TestBrokenBackupBlocksReplacement(t *testing.T) {
	for _, backup := range []string{".go-original.json", ".go-previous.json"} {
		t.Run(backup, func(t *testing.T) {
			root := t.TempDir()
			path := filepath.Join(root, "antenna-sightings.json")
			original := []byte(`{"sightings":{}}`)
			write(t, root, "antenna-sightings.json", string(original))
			if err := os.Mkdir(path+backup, 0700); err != nil {
				t.Fatal(err)
			}
			if diskstore.Persist(path, original, []byte(`{"sightings":{},"new":1}`)) == nil {
				t.Fatal("broken backup ignored")
			}
			raw, _ := os.ReadFile(path)
			if !bytes.Equal(raw, original) {
				t.Fatal("backup failure replaced original")
			}
		})
	}
}
