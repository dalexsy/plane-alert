package diskstore

import (
	"bytes"
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestPostRenameSyncFailureReportsCommittedPath(t *testing.T) {
	path := filepath.Join(t.TempDir(), "antenna.json")
	raw := []byte(`{"sightings":{}}`)
	err := atomic(path, raw, func(string) error { return errors.New("injected directory sync failure") })
	var committed *CommitError
	if !errors.As(err, &committed) || committed.Path != path {
		t.Fatal("rename outcome lost", err)
	}
	got, err := os.ReadFile(path)
	if err != nil || !bytes.Equal(got, raw) {
		t.Fatal("fixture did not commit", err)
	}
	if err := Atomic(path, []byte(`{"retry":true}`)); err != nil {
		t.Fatal("retry failed", err)
	}
}
