package antenna

import (
	"bytes"
	"dryl-planes/internal/diskstore"
	"errors"
)

func (e *Engine) persist() error {
	return e.persistWith(diskstore.Persist)
}
func (e *Engine) persistWith(save func(string, []byte, []byte) error) error {
	err := save(e.path, e.diskRaw, e.raw)
	if err == nil {
		e.diskRaw = e.raw
		return nil
	}
	var committed *diskstore.CommitError
	if errors.As(err, &committed) && committed.Path == e.path {
		// Only reconcile our exact attempted generation. A different external
		// edit must still fail the next compare-and-swap; keep dirty/error now.
		if current, readErr := diskstore.Bytes(e.path); readErr == nil && bytes.Equal(current, e.raw) {
			e.diskRaw = e.raw
		}
	}
	return err
}
