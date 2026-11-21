package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

const (
	cdpListURL = "http://127.0.0.1:9222/json/list"
	planesURL  = "https://planes.dryl.io/?kiosk=1"
	adsURL     = "https://planes.dryl.io/api/planes/adsbPointProxy" +
		"?lat=52.4605886&lon=13.523268&radiusKm=100"
	reloadWait = 8 * time.Second
)

type pageState struct {
	Href        string `json:"href"`
	Title       string `json:"title"`
	AppRootLen  int    `json:"appRootLen"`
	HasMap      bool   `json:"hasMap"`
	MarkerCount int    `json:"markerCount"`
	BodyLen     int    `json:"bodyLen"`
}

const pageStateJS = `(() => ({
  href: location.href,
  title: document.title || '',
  appRootLen: ((document.querySelector('app-root')||{}).innerHTML||'').length,
  hasMap: !!document.querySelector('.leaflet-container, canvas, app-map, #map'),
  markerCount: document.querySelectorAll(
    '.leaflet-marker-pane .leaflet-marker-icon, .leaflet-marker-icon'
  ).length,
  bodyLen: (document.body && document.body.innerText || '').trim().length
}))()`

func forceHeal() bool {
	v := strings.TrimSpace(strings.ToLower(os.Getenv("PLANES_KIOSK_PAGE_HEAL_FORCE")))
	return v == "1" || v == "true" || v == "yes"
}

func isBlank(state pageState) bool {
	href := strings.TrimSpace(strings.ToLower(state.Href))
	if href == "about:blank" || href == "about:blank/" || href == "" {
		return true
	}
	if !strings.Contains(href, "planes.dryl.io") && strings.Contains(href, "about:") {
		return true
	}
	if strings.Contains(href, "planes.dryl.io") && state.AppRootLen < 200 && state.BodyLen < 20 && !state.HasMap {
		return true
	}
	if strings.Contains(href, "planes.dryl.io") && strings.TrimSpace(state.Title) == "" && state.AppRootLen < 200 && !state.HasMap {
		return true
	}
	return false
}

func adsbCount() int {
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(adsURL)
	if err != nil {
		return -1
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return -1
	}
	var payload struct {
		AC []json.RawMessage `json:"ac"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return -1
	}
	return len(payload.AC)
}

func isEmptyStuck(state pageState) bool {
	if !strings.Contains(strings.ToLower(state.Href), "planes.dryl.io") {
		return false
	}
	if !state.HasMap || state.MarkerCount > 0 {
		return false
	}
	return adsbCount() >= 3
}

func needsHeal(state pageState) string {
	if forceHeal() {
		return "force"
	}
	if isBlank(state) {
		return "blank"
	}
	if isEmptyStuck(state) {
		return fmt.Sprintf("empty-stuck api=%d markers=0", adsbCount())
	}
	return ""
}
