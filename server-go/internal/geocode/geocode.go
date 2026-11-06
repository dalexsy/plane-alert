package geocode

import (
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
)

type Service struct {
	Client               *http.Client
	NominatimURL, BigURL string
}

var coordinates = regexp.MustCompile(`^-?\d{1,3}\.\d+[,/\s]\s*-?\d{1,3}\.\d+$`)

func readable(value string) bool {
	return strings.TrimSpace(value) != "" && !coordinates.MatchString(strings.TrimSpace(value))
}
func Handler(w http.ResponseWriter, r *http.Request) { (Service{}).ServeHTTP(w, r) }
func (s Service) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	lat, e1 := strconv.ParseFloat(r.URL.Query().Get("lat"), 64)
	lon, e2 := strconv.ParseFloat(r.URL.Query().Get("lon"), 64)
	if e1 != nil || e2 != nil || math.IsNaN(lat) || math.IsNaN(lon) || math.IsInf(lat, 0) || math.IsInf(lon, 0) || lat < -90 || lat > 90 || lon < -180 || lon > 180 {
		JSON(w, 400, map[string]string{"error": "Valid lat/lon required"})
		return
	}
	client := &http.Client{Timeout: 4 * time.Second}
	if s.Client != nil {
		client = s.Client
	}
	fetch := func(url string, target any) bool {
		req, err := http.NewRequestWithContext(r.Context(), "GET", url, nil)
		if err != nil {
			return false
		}
		req.Header.Set("User-Agent", "PlaneAlert/Go (+https://planes.dryl.io)")
		res, err := client.Do(req)
		if err != nil {
			return false
		}
		defer res.Body.Close()
		if res.StatusCode != 200 {
			return false
		}
		raw, err := io.ReadAll(io.LimitReader(res.Body, (256<<10)+1))
		return err == nil && len(raw) <= 256<<10 && json.Unmarshal(raw, target) == nil
	}
	var nominatim struct {
		Address map[string]string `json:"address"`
		Display string            `json:"display_name"`
	}
	primaryURL := fmt.Sprintf("https://nominatim.openstreetmap.org/reverse?lat=%g&lon=%g&format=json&zoom=14", lat, lon)
	if s.NominatimURL != "" {
		primaryURL = s.NominatimURL
	}
	if fetch(primaryURL, &nominatim) {
		primary := ""
		for _, key := range []string{"neighbourhood", "suburb", "village", "town", "city"} {
			if value := nominatim.Address[key]; value != "" {
				primary = value
				break
			}
		}
		second := nominatim.Address["country"]
		if second == "Germany" || second == "Deutschland" {
			second = nominatim.Address["county"]
			if second == "" {
				second = nominatim.Address["state_district"]
			}
		}
		parts := []string{}
		for _, value := range []string{primary, second} {
			if value != "" {
				parts = append(parts, value)
			}
		}
		address := strings.Join(parts, ", ")
		if address == "" {
			address = nominatim.Display
		}
		if readable(address) {
			JSON(w, 200, map[string]any{"ok": true, "address": address, "addressDetails": nominatim.Address, "fallback": false})
			return
		}
	}
	var big struct {
		Locality string `json:"locality"`
		City     string `json:"city"`
		State    string `json:"principalSubdivision"`
		Country  string `json:"countryName"`
	}
	secondaryURL := fmt.Sprintf("https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=%g&longitude=%g&localityLanguage=en", lat, lon)
	if s.BigURL != "" {
		secondaryURL = s.BigURL
	}
	if fetch(secondaryURL, &big) {
		primary := big.Locality
		if primary == "" {
			primary = big.City
		}
		second := big.State
		if second == "" {
			second = big.Country
		}
		if second == primary {
			second = ""
		}
		parts := []string{}
		for _, value := range []string{primary, second} {
			if value != "" {
				parts = append(parts, value)
			}
		}
		address := strings.Join(parts, ", ")
		if readable(address) {
			JSON(w, 200, map[string]any{"ok": true, "address": address, "addressDetails": nil, "fallback": false})
			return
		}
	}
	JSON(w, 200, map[string]any{"ok": true, "address": "", "addressDetails": nil, "fallback": true})
}

func JSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
