package tests

import (
	"bytes"
	"context"
	"dryl-planes/internal/antenna"
	"dryl-planes/internal/diskstore"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestAntennaPollPreservesHistoryAndBuffersDurableWrites(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "antenna-sightings.json")
	var body atomic.Value
	body.Store(`{"aircraft":[{"hex":"ABC123","flight":" NEW ","messages":20,"alt_baro":500,"r_dst":3,"r_dir":90}]}`)
	receiver := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { _, _ = w.Write([]byte(body.Load().(string))) }))
	defer receiver.Close()
	original := `{"future":{"precise":9007199254740993},"sightings":{"abc123":{"hex":"abc123","firstSeen":1,"lastSeen":2,"hits":3,"messages":100,"lastMessages":10,"flights":["OLD"],"lastFlight":"OLD","closestNm":2,"closestDir":45,"closestAt":1,"altMin":100,"altMax":1000,"unknown":{"keep":true}},"old":{"hex":"old","firstSeen":1,"lastSeen":2,"hits":1,"messages":0,"flights":[]}}}`
	write(t, root, "antenna-sightings.json", original)
	engine, err := antenna.New(path, receiver.URL, 12*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	if err = engine.Poll(context.Background()); err != nil {
		t.Fatal(err)
	}
	got, _ := os.ReadFile(path)
	if string(got) != original {
		t.Fatal("poll rewrote before coalesced persistence")
	}
	snapshot, err := engine.Snapshot()
	if err != nil {
		t.Fatal(err)
	}
	var rows map[string]map[string]json.RawMessage
	_ = json.Unmarshal(snapshot["sightings"], &rows)
	if string(rows["abc123"]["messages"]) != "110" || string(rows["abc123"]["closestNm"]) != "2" || string(rows["abc123"]["firstSeen"]) != "1" || rows["old"] == nil || !bytes.Contains(snapshot["future"], []byte("9007199254740993")) {
		t.Fatal("history or unknown fields changed")
	}
	body.Store(`{"aircraft":[{"hex":"abc123","messages":4,"r_dst":1,"r_dir":180,"alt_baro":50}]}`)
	if err = engine.Poll(context.Background()); err != nil {
		t.Fatal(err)
	}
	if err = engine.Flush(); err != nil {
		t.Fatal(err)
	}
	saved, err := diskstore.Read(path)
	if err != nil {
		t.Fatal(err)
	}
	_ = json.Unmarshal(saved["sightings"], &rows)
	if string(rows["abc123"]["messages"]) != "114" || string(rows["abc123"]["closestNm"]) != "1" || string(rows["abc123"]["altMin"]) != "50" || !bytes.Contains(rows["abc123"]["unknown"], []byte("true")) {
		t.Fatal("counter reset/closest/unknown preservation failed")
	}
	backup, _ := os.ReadFile(path + ".go-original.json")
	if string(backup) != original {
		t.Fatal("original evidence not retained")
	}
	for i := 0; i < 4; i++ {
		if err = engine.Poll(context.Background()); err != nil {
			t.Fatal(err)
		}
		if err = engine.Flush(); err != nil {
			t.Fatal(err)
		}
	}
	entries, _ := os.ReadDir(root)
	if len(entries) != 3 {
		t.Fatal("unbounded snapshots", len(entries))
	}
}
func TestIdleFailureAndExternalChangeDoNotRewriteHistory(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "antenna-sightings.json")
	var mode atomic.Bool
	receiver := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if mode.Load() {
			w.WriteHeader(503)
			return
		}
		_, _ = w.Write([]byte(`{"aircraft":[]}`))
	}))
	defer receiver.Close()
	original := `{"sightings":{}}`
	write(t, root, "antenna-sightings.json", original)
	engine, err := antenna.New(path, receiver.URL, 12*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	if err = engine.Poll(context.Background()); err != nil {
		t.Fatal(err)
	}
	if err = engine.Flush(); err != nil {
		t.Fatal(err)
	}
	mode.Store(true)
	if engine.Poll(context.Background()) == nil {
		t.Fatal("failure hidden")
	}
	snapshot, _ := engine.Snapshot()
	if string(snapshot["lastPollOk"]) != "false" {
		t.Fatal("receiver failure not visible")
	}
	if err = engine.Flush(); err != nil {
		t.Fatal(err)
	}
	got, _ := os.ReadFile(path)
	entries, _ := os.ReadDir(root)
	if string(got) != original || len(entries) != 1 {
		t.Fatal("idle/failure wrote household state")
	}
	if err = diskstore.Persist(path, []byte(`{"wrong":true}`), []byte(`{"sightings":{}}`)); err == nil {
		t.Fatal("outside writer change accepted")
	}
}
func TestAntennaPollsNeverOverlapAndShutdownFlushes(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "antenna-sightings.json")
	var active, max atomic.Int32
	seen := make(chan struct{}, 10)
	receiver := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := active.Add(1)
		defer active.Add(-1)
		for old := max.Load(); n > old && !max.CompareAndSwap(old, n); old = max.Load() {
		}
		time.Sleep(10 * time.Millisecond)
		_, _ = w.Write([]byte(`{"aircraft":[{"hex":"abc","messages":1}]}`))
		seen <- struct{}{}
	}))
	defer receiver.Close()
	write(t, root, "antenna-sightings.json", `{"sightings":{}}`)
	engine, err := antenna.New(path, receiver.URL, 12*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	for i := 0; i < 4; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := engine.Poll(context.Background()); err != nil {
				t.Error(err)
			}
		}()
	}
	wg.Wait()
	if max.Load() != 1 {
		t.Fatal("overlapping receiver requests")
	}
	ctx, cancel := context.WithCancel(context.Background())
	engine.Start(ctx)
	engine.Start(ctx)
	time.Sleep(40 * time.Millisecond)
	cancel()
	if err = engine.Wait(); err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile(path)
	if err != nil || !bytes.Contains(raw, []byte(`"hex":"abc"`)) {
		t.Fatal("shutdown did not retain observed history", err)
	}
}
