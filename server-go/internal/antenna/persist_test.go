package antenna

import (
	"bytes"
	"dryl-planes/internal/diskstore"
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestCommittedSyncFailureCanRetryWithoutAcceptingExternalEdits(t *testing.T) {
	for _, external := range []bool{false, true} {
		path := filepath.Join(t.TempDir(), "antenna.json")
		old, next := []byte(`{"sightings":{}}`), []byte(`{"sightings":{},"generation":1}`)
		if err := os.WriteFile(path, old, 0600); err != nil {
			t.Fatal(err)
		}
		e := &Engine{path: path, diskRaw: old, raw: next, dirty: true}
		err := e.persistWith(func(path string, expected, raw []byte) error {
			if !bytes.Equal(expected, old) {
				t.Fatal("wrong expected generation")
			}
			if external {
				raw = []byte(`{"outside":true}`)
			}
			if err := os.WriteFile(path, raw, 0600); err != nil {
				t.Fatal(err)
			}
			return &diskstore.CommitError{Path: path, Err: errors.New("injected sync failure")}
		})
		if err == nil || !e.dirty {
			t.Fatal("durability failure hidden")
		}
		if external {
			if !bytes.Equal(e.diskRaw, old) || e.persist() == nil {
				t.Fatal("outside edit accepted")
			}
			continue
		}
		if !bytes.Equal(e.diskRaw, next) {
			t.Fatal("committed generation not reconciled")
		}
		e.raw = []byte(`{"sightings":{},"generation":2}`)
		if err := e.persist(); err != nil {
			t.Fatal("retry blocked", err)
		}
	}
}
