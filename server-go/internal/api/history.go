package api

import (
	"encoding/json"

	"net/http"

	"sort"
	"strings"
)

func (a *App) history(w http.ResponseWriter, r *http.Request) {
	key := r.URL.Query().Get("pushoverUserKey")
	if r.Method == "POST" {
		var input struct {
			Key string `json:"pushoverUserKey"`
		}
		if json.NewDecoder(r.Body).Decode(&input) != nil {
			JSON(w, 400, map[string]string{"error": "Invalid JSON"})
			return
		}
		key = input.Key
	}
	if !userKey.MatchString(key) {
		JSON(w, 400, map[string]string{"error": "Valid pushoverUserKey required"})
		return
	}
	blob, err := Read(a.path("planes-api-store.json"))
	if err != nil {
		JSON(w, 503, map[string]string{"error": "Saved aircraft history unavailable"})
		return
	}
	collections := map[string]map[string]Object{}
	found := false
	for _, name := range []string{"military-history", "notification-cooldowns", "deviceTokens"} {
		rows := map[string]Object{}
		if raw, ok := blob[name]; ok {
			found = true
			if json.Unmarshal(raw, &rows) != nil || rows == nil {
				JSON(w, 503, map[string]string{"error": "Invalid saved aircraft collection"})
				return
			}
		}
		collections[name] = rows
	}
	if !found {
		JSON(w, 503, map[string]string{"error": "Unexpected saved aircraft store"})
		return
	}
	devices, err := a.Push.Devices(r.Context(), key)
	if err != nil {
		JSON(w, 503, map[string]string{"error": "Current alert devices unavailable"})
		return
	}
	active := map[string]bool{}
	for _, name := range devices {
		active[slug(name)] = true
	}
	history := map[string]Object{}
	prefix := key + "__"
	for id, v := range collections["military-history"] {
		if !strings.HasPrefix(id, prefix) {
			continue
		}
		hex := strings.ToLower(text(v, "icao"))
		if hex != "" {
			history[hex] = v
		}
	}
	type group struct {
		At       float64
		Devices  map[string]bool
		Location json.RawMessage
	}
	groups := map[string]map[string]*group{}
	for id, v := range collections["notification-cooldowns"] {
		if !strings.HasPrefix(id, prefix) || number(v, "lastSent") <= 0 {
			continue
		}
		parts := strings.Split(strings.TrimPrefix(id, prefix), "__")
		hex := strings.ToLower(parts[len(parts)-1])
		if hex == "" || strings.HasPrefix(hex, "proximity_") {
			continue
		}
		device := strings.Join(parts[:len(parts)-1], "__")
		if device != "" && len(active) > 0 && !active[slug(device)] {
			continue
		}
		groupKey := device
		if groupKey == "" {
			groupKey = "unknown"
		}
		var location json.RawMessage
		for did, d := range collections["deviceTokens"] {
			if strings.HasPrefix(did, prefix) && (slug(text(d, "deviceSlug")) == slug(device) || slug(text(d, "deviceName")) == slug(device)) {
				location = d["location"]
				var loc Object
				if json.Unmarshal(location, &loc) == nil {
					groupKey = locationKey(loc)
				}
				break
			}
		}
		if groups[hex] == nil {
			groups[hex] = map[string]*group{}
		}
		g := groups[hex][groupKey]
		if g == nil {
			g = &group{Devices: map[string]bool{}, Location: location}
			groups[hex][groupKey] = g
		}
		if device != "" {
			g.Devices[device] = true
		}
		if at := number(v, "lastSent"); at > g.At {
			g.At = at
		}
	}
	for hex, byLocation := range groups {
		v := history[hex]
		if v == nil {
			v = Object{}
			set(v, "icao", hex)
		}
		var latest *group
		first := float64(0)
		for _, g := range byLocation {
			if latest == nil || g.At > latest.At {
				latest = g
			}
			if first == 0 || g.At < first {
				first = g.At
			}
		}
		if number(v, "firstSeen") == 0 {
			set(v, "firstSeen", first)
		}
		set(v, "lastSeen", latest.At)
		set(v, "sightingCount", len(byLocation))
		set(v, "notificationDelivered", true)
		names := []string{}
		for name := range latest.Devices {
			names = append(names, name)
		}
		sort.Strings(names)
		if len(names) > 0 {
			set(v, "notifiedDeviceNames", names)
			set(v, "notifiedDeviceCount", len(names))
			if len(names) == 1 {
				set(v, "notifiedDeviceName", names[0])
			} else {
				delete(v, "notifiedDeviceName")
			}
		}
		if len(v["notificationLocation"]) == 0 && len(latest.Location) > 0 {
			v["notificationLocation"] = latest.Location
		}
		history[hex] = v
	}
	rows := []Object{}
	for hex := range groups {
		rows = append(rows, historyProjection(history[hex]))
	}
	sort.SliceStable(rows, func(i, j int) bool { return number(rows[i], "lastSeen") > number(rows[j], "lastSeen") })
	JSON(w, 200, map[string]any{"success": true, "history": rows, "count": len(rows)})
}
