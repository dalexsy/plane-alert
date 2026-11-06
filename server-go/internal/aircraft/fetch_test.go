package aircraft

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"math"
	"net/http"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

type transport func(*http.Request) (*http.Response, error)

func (fn transport) RoundTrip(r *http.Request) (*http.Response, error) { return fn(r) }
func response(body string) *http.Response {
	return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(body)), Header: http.Header{}}
}
func TestNonemptyProviderPreservesAircraftFieldsAndLastGood(t *testing.T) {
	var failed atomic.Bool
	f := Fetcher{Client: &http.Client{Transport: transport(func(r *http.Request) (*http.Response, error) {
		if failed.Load() {
			return nil, errors.New("fixture unavailable")
		}
		if r.URL.Host == "good.test" {
			return response(`{"ac":[{"hex":"ABC123","future":{"precise":9007199254740993}}]}`), nil
		}
		return response(`{"ac":[]}`), nil
	})}, URLs: func(float64, float64, float64) []string { return []string{"https://empty.test", "https://good.test"} }}
	rows, stale, err := f.Fetch(context.Background(), 52, 13, 100)
	if err != nil || stale || len(rows) != 1 {
		t.Fatal(rows, stale, err)
	}
	if !strings.Contains(string(rows[0]["future"]), "9007199254740993") {
		t.Fatal("unknown field changed")
	}
	failed.Store(true)
	rows, stale, err = f.Fetch(context.Background(), 52, 13, 100)
	if err != nil || !stale || len(rows) != 1 {
		t.Fatal("lastgood lost", rows, stale, err)
	}
	f.mu.Lock()
	for key, v := range f.cache {
		v.At = time.Now().Add(-16 * time.Minute)
		f.cache[key] = v
	}
	f.mu.Unlock()
	if _, _, err = f.Fetch(context.Background(), 52, 13, 100); err == nil {
		t.Fatal("expired fallback hidden as success")
	}
}
func TestUnavailableFeedsNeverReturnEmptySuccess(t *testing.T) {
	f := Fetcher{Client: &http.Client{Transport: transport(func(*http.Request) (*http.Response, error) { return nil, errors.New("fixture offline") })}}
	if rows, _, err := f.Fetch(context.Background(), 52, 13, 100); err == nil || len(rows) > 0 {
		t.Fatal("outage hidden", rows, err)
	}
}
func TestOpenSkyUnitsAndAircraftIdentity(t *testing.T) {
	f := Fetcher{Client: &http.Client{Transport: transport(func(r *http.Request) (*http.Response, error) {
		return response(`{"states":[["abc123"," CALL ","Germany",0,0,13,52,1000,false,100,90,1,null,1100,"1234"]]}`), nil
	})}}
	rows, err := f.openSky(context.Background(), 52, 13, 100)
	if err != nil || len(rows) != 1 {
		t.Fatal(rows, err)
	}
	var speed float64
	_ = json.Unmarshal(rows[0]["gs"], &speed)
	if string(rows[0]["hex"]) != `"ABC123"` || string(rows[0]["alt_baro"]) != "3281" || string(rows[0]["baro_rate"]) != "197" || math.Abs(speed-194.384) > 0.00001 {
		t.Fatal(rows)
	}
}
