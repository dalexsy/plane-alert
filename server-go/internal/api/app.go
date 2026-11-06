package api

import (
	"dryl-planes/internal/aircraft"
	"dryl-planes/internal/geocode"
	"dryl-planes/internal/push"
	"encoding/json"
	"errors"
	"io"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
)

type Object = map[string]json.RawMessage
type App struct {
	Root, Revision string
	Aircraft       aircraft.Fetcher
	Push           push.Client
	Antenna        interface {
		Snapshot() (Object, error)
		Polling() bool
		PollMs() int
	}
	slots chan struct{}
}

func JSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
func Read(path string) (Object, error) {
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
	if err != nil || len(raw) > 16<<20 {
		return nil, errors.New("store read failed")
	}
	var value Object
	if json.Unmarshal(raw, &value) != nil || value == nil {
		return nil, errors.New("invalid saved data")
	}
	return value, nil
}
func text(v Object, k string) string    { var s string; _ = json.Unmarshal(v[k], &s); return s }
func number(v Object, k string) float64 { var n float64; _ = json.Unmarshal(v[k], &n); return n }
func (a *App) path(name string) string  { return filepath.Join(a.Root, name) }
func (a *App) Handler() http.Handler {
	mux := http.NewServeMux()
	a.slots = make(chan struct{}, 4)
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		JSON(w, 200, map[string]any{"ok": true, "backend": "go-planes", "revision": a.Revision, "notificationProcessingEnabled": false, "antennaPollingEnabled": a.Antenna != nil && a.Antenna.Polling()})
	})
	mux.HandleFunc("GET /adsbPointProxy", func(w http.ResponseWriter, r *http.Request) {
		lat, e1 := strconv.ParseFloat(r.URL.Query().Get("lat"), 64)
		lon, e2 := strconv.ParseFloat(r.URL.Query().Get("lon"), 64)
		radius, e3 := strconv.ParseFloat(r.URL.Query().Get("radiusKm"), 64)
		if e1 != nil || e2 != nil || e3 != nil || math.IsNaN(lat) || math.IsNaN(lon) || math.IsNaN(radius) || math.IsInf(lat, 0) || math.IsInf(lon, 0) || math.IsInf(radius, 0) || lat < -90 || lat > 90 || lon < -180 || lon > 180 || radius <= 0 || radius > 500 {
			JSON(w, 400, map[string]string{"error": "lat, lon, radiusKm required"})
			return
		}
		rows, stale, err := a.Aircraft.Fetch(r.Context(), lat, lon, radius)
		if err != nil {
			status := 502
			if lat < -90 || lat > 90 || lon < -180 || lon > 180 || radius <= 0 || radius > 500 {
				status = 400
			}
			JSON(w, status, map[string]string{"error": "Aircraft data unavailable or invalid query"})
			return
		}
		JSON(w, 200, map[string]any{"ac": rows, "stale": stale})
	})
	mux.HandleFunc("GET /antennaSightings", a.antenna)
	mux.HandleFunc("GET /reverseGeocode", geocode.Handler)
	mux.HandleFunc("GET /getMilitaryHistory", a.history)
	mux.HandleFunc("POST /getMilitaryHistory", a.history)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		JSON(w, 503, map[string]string{"error": "This Plane Alert API is being restored in Go"})
	})
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "OPTIONS" {
			w.Header().Set("Allow", "GET,POST,OPTIONS")
			w.WriteHeader(204)
			return
		}
		select {
		case a.slots <- struct{}{}:
			defer func() { <-a.slots }()
		default:
			JSON(w, 503, map[string]string{"error": "Plane Alert busy"})
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
		w.Header().Set("X-Content-Type-Options", "nosniff")
		mux.ServeHTTP(w, r)
	})
}
