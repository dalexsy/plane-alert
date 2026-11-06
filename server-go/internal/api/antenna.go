package api

import (
	"encoding/json"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"
	_ "time/tzdata"
)

func (a *App) antenna(w http.ResponseWriter, r *http.Request) {
	blob, err := Read(a.path("antenna-sightings.json"))
	if err != nil {
		JSON(w, 503, map[string]string{"error": "Saved antenna sightings unavailable"})
		return
	}
	var sightings map[string]Object
	if json.Unmarshal(blob["sightings"], &sightings) != nil || sightings == nil {
		JSON(w, 503, map[string]string{"error": "Invalid saved antenna sightings"})
		return
	}
	q := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q")))
	limit := 500
	if value := r.URL.Query().Get("limit"); value != "" {
		if n, err := strconv.Atoi(value); err == nil {
			limit = max(1, min(2000, n))
		}
	}
	today := r.URL.Query().Get("today")
	loc, _ := time.LoadLocation("Europe/Berlin")
	day := time.Now().In(loc).Format("2006-01-02")
	rows := []Object{}
	for _, v := range sightings {
		if v == nil || text(v, "hex") == "" {
			JSON(w, 503, map[string]string{"error": "Invalid saved antenna row"})
			return
		}
		if (today == "true" || today == "1" || today == "today") && time.UnixMilli(int64(number(v, "lastSeen"))).In(loc).Format("2006-01-02") != day {
			continue
		}
		var flights []string
		_ = json.Unmarshal(v["flights"], &flights)
		match := strings.Contains(strings.ToLower(text(v, "hex")), q) || strings.Contains(strings.ToLower(text(v, "lastFlight")), q)
		for _, flight := range flights {
			match = match || strings.Contains(strings.ToLower(flight), q)
		}
		if !match {
			continue
		}
		row := Object{}
		for k, value := range v {
			if k != "lastMessages" {
				row[k] = value
			}
		}
		rows = append(rows, row)
	}
	sort.SliceStable(rows, func(i, j int) bool {
		if r.URL.Query().Get("sort") == "closest" {
			left, right := string(rows[i]["closestNm"]), string(rows[j]["closestNm"])
			missingLeft, missingRight := left == "null" || left == "", right == "null" || right == ""
			if missingLeft != missingRight {
				return !missingLeft
			}
			if !missingLeft && number(rows[i], "closestNm") != number(rows[j], "closestNm") {
				return number(rows[i], "closestNm") < number(rows[j], "closestNm")
			}
		}
		return number(rows[i], "lastSeen") > number(rows[j], "lastSeen")
	})
	matched := len(rows)
	if len(rows) > limit {
		rows = rows[:limit]
	}
	result := map[string]any{"ok": true, "enabled": false, "pollMs": 12000, "uniqueHexes": len(sightings), "matched": matched, "returned": len(rows), "sightings": rows, "pollerHeld": true}
	for _, k := range []string{"feedUrl", "lastPollAt", "lastPollOk", "lastPollError", "lastAircraft"} {
		if v, ok := blob[k]; ok {
			result[k] = v
		}
	}
	JSON(w, 200, result)
}
