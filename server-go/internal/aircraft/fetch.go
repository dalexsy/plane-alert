package aircraft

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"sync"
	"time"
)

type Row = map[string]json.RawMessage
type cached struct {
	Rows  []Row
	At    time.Time
	Bytes int
}
type Fetcher struct {
	Client *http.Client
	mu     sync.Mutex
	cache  map[string]cached
	URLs   func(float64, float64, float64) []string
}

func (f *Fetcher) get(ctx context.Context, url string, target any) error {
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "PlaneAlert/Go (+https://planes.dryl.io)")
	req.Header.Set("Accept", "application/json")
	client := f.Client
	if client == nil {
		client = &http.Client{Timeout: 8 * time.Second}
	}
	res, err := client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return fmt.Errorf("upstream status %d", res.StatusCode)
	}
	raw, err := io.ReadAll(io.LimitReader(res.Body, (2<<20)+1))
	if err != nil || len(raw) > 2<<20 {
		return errors.New("upstream body unavailable/oversized")
	}
	return json.Unmarshal(raw, target)
}
func (f *Fetcher) Fetch(ctx context.Context, lat, lon, radius float64) ([]Row, bool, error) {
	if math.IsNaN(lat) || math.IsNaN(lon) || math.IsNaN(radius) || math.IsInf(lat, 0) || math.IsInf(lon, 0) || math.IsInf(radius, 0) || lat < -90 || lat > 90 || lon < -180 || lon > 180 || radius <= 0 || radius > 500 {
		return nil, false, errors.New("invalid aircraft query")
	}
	ctx, cancel := context.WithTimeout(ctx, 12*time.Second)
	defer cancel()
	urls := []string{fmt.Sprintf("https://opendata.adsb.fi/api/v2/lat/%g/lon/%g/dist/%g", lat, lon, radius/1.852), fmt.Sprintf("https://api.adsb.lol/v2/point/%g/%g/%g", lat, lon, radius/1.852), fmt.Sprintf("https://api.airplanes.live/v2/point/%g/%g/%g", lat, lon, radius/1.852)}
	if f.URLs != nil {
		urls = f.URLs(lat, lon, radius)
	}
	results := make(chan []Row, len(urls))
	for _, url := range urls {
		go func(url string) {
			var data struct {
				AC       []Row `json:"ac"`
				Aircraft []Row `json:"aircraft"`
			}
			if f.get(ctx, url, &data) != nil {
				results <- nil
				return
			}
			if len(data.Aircraft) > len(data.AC) {
				data.AC = data.Aircraft
			}
			results <- data.AC
		}(url)
	}
	key := fmt.Sprintf("%.2f_%.2f_%.0f", lat, lon, radius)
	for range urls {
		select {
		case rows := <-results:
			if len(rows) > 0 {
				f.remember(key, rows)
				return rows, false, nil
			}
		case <-ctx.Done():
			return f.fallback(key)
		}
	}
	rows, err := f.openSky(ctx, lat, lon, radius)
	if err == nil && len(rows) > 0 {
		f.remember(key, rows)
		return rows, false, nil
	}
	return f.fallback(key)
}
func (f *Fetcher) remember(key string, rows []Row) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.cache == nil {
		f.cache = map[string]cached{}
	}
	weight := 0
	for _, row := range rows {
		weight += 256
		for k, v := range row {
			weight += 64 + len(k) + len(v)
		}
	}
	if weight > 2<<20 || len(rows) > 2000 {
		return
	}
	delete(f.cache, key)
	total := weight
	for _, v := range f.cache {
		total += v.Bytes
	}
	for len(f.cache) >= 4 || total > 8<<20 {
		oldest := ""
		var at time.Time
		for k, v := range f.cache {
			if oldest == "" || v.At.Before(at) {
				oldest, at = k, v.At
			}
		}
		total -= f.cache[oldest].Bytes
		delete(f.cache, oldest)
	}
	f.cache[key] = cached{Rows: rows, At: time.Now(), Bytes: weight}
}
func (f *Fetcher) fallback(key string) ([]Row, bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	v, ok := f.cache[key]
	if ok && time.Since(v.At) <= 15*time.Minute {
		return v.Rows, true, nil
	}
	return nil, false, errors.New("aircraft providers unavailable")
}
