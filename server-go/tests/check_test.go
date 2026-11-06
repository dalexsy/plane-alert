package tests

import (
	"dryl-planes/internal/api"
	"os"
	"path/filepath"
	"testing"
)

func TestStorePreflightRejectsCorruptionWithoutWriting(t *testing.T) {
	root := t.TempDir()
	write(t, root, "antenna-sightings.json", `{"sightings":{}}`)
	for _, raw := range []string{`{"deviceTokens":`, `{"unrelated":{}}`, `{"deviceTokens":null}`, `{"deviceTokens":{"invalid":null}}`} {
		write(t, root, "planes-api-store.json", raw)
		if api.CheckData(root) == nil {
			t.Fatal("invalid store accepted", raw)
		}
		got, _ := os.ReadFile(filepath.Join(root, "planes-api-store.json"))
		if string(got) != raw {
			t.Fatal("preflight changed evidence")
		}
	}
	write(t, root, "planes-api-store.json", `{"deviceTokens":{},"future":{"largeInteger":9007199254740993}}`)
	if err := api.CheckData(root); err != nil {
		t.Fatal(err)
	}
}
