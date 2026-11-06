package diskstore

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"runtime"
)

type Object = map[string]json.RawMessage

func Read(path string) (Object, error) {
	raw, err := Bytes(path)
	if err != nil {
		return nil, err
	}
	var value Object
	if json.Unmarshal(raw, &value) != nil || value == nil {
		return nil, errors.New("invalid saved data")
	}
	return value, nil
}
func Bytes(path string) ([]byte, error) {
	if info, err := os.Lstat(path); err != nil {
		return nil, err
	} else if !info.Mode().IsRegular() {
		return nil, errors.New("regular household store required")
	}
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil {
		return nil, err
	}
	if !info.Mode().IsRegular() || info.Size() > 16<<20 {
		return nil, errors.New("invalid store size/type")
	}
	raw, err := io.ReadAll(io.LimitReader(f, (16<<20)+1))
	if err != nil || len(raw) > 16<<20 || !json.Valid(raw) {
		return nil, errors.New("invalid saved data")
	}
	return raw, nil
}
func syncDir(path string) error {
	if runtime.GOOS == "windows" {
		return nil
	}
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()
	return f.Sync()
}
func Atomic(path string, raw []byte) error {
	if len(raw) > 16<<20 || !json.Valid(raw) {
		return errors.New("invalid store update")
	}
	dir := filepath.Dir(path)
	f, err := os.CreateTemp(dir, ".go-antenna-")
	if err != nil {
		return err
	}
	defer os.Remove(f.Name())
	_, err = f.Write(raw)
	if err == nil {
		err = f.Sync()
	}
	closed := f.Close()
	if err != nil {
		return err
	}
	if closed != nil {
		return closed
	}
	if err = os.Rename(f.Name(), path); err != nil {
		return err
	}
	return syncDir(dir)
}

// Keep one original and one previous generation; never prune household rows.
func Persist(path string, expected, raw []byte) error {
	old, err := Bytes(path)
	if err != nil {
		return err
	}
	if !bytes.Equal(old, expected) {
		return errors.New("antenna store changed outside its sole writer")
	}
	original := path + ".go-original.json"
	if _, err := os.Stat(original); os.IsNotExist(err) {
		if err = Atomic(original, old); err != nil {
			return err
		}
	} else if err != nil {
		return err
	} else if _, err := Bytes(original); err != nil {
		return err
	}
	if err := Atomic(path+".go-previous.json", old); err != nil {
		return err
	}
	return Atomic(path, raw)
}
