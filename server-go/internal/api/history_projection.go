package api

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
)

var userKey = regexp.MustCompile(`^[A-Za-z0-9]{30}$`)
var slugPattern = regexp.MustCompile(`[^a-z0-9]+`)

func slug(v string) string {
	s := strings.Trim(slugPattern.ReplaceAllString(strings.ToLower(strings.TrimSpace(v)), "-"), "-")
	if s == "" {
		return "default"
	}
	return s
}
func historyProjection(v Object) Object {
	out := Object{}
	for _, k := range []string{"icao", "firstSeen", "lastSeen", "sightingCount", "notificationDelivered", "notifiedDeviceName", "notifiedDeviceCount", "notifiedDeviceNames", "notificationLocation", "callsign", "model", "operator", "country", "registration", "lat", "lon", "altitude", "bearing", "cardinal"} {
		if raw, ok := v[k]; ok {
			out[k] = raw
		}
	}
	if raw, ok := out["notificationLocation"]; ok {
		var location Object
		if json.Unmarshal(raw, &location) == nil {
			safe := Object{}
			for _, k := range []string{"lat", "lon", "address"} {
				if value, ok := location[k]; ok {
					safe[k] = value
				}
			}
			set(out, "notificationLocation", safe)
		} else {
			delete(out, "notificationLocation")
		}
	}
	return out
}

func locationKey(v Object) string {
	return fmt.Sprintf("%.3f,%.3f", number(v, "lat"), number(v, "lon"))
}
func set(v Object, k string, value any) { v[k], _ = json.Marshal(value) }
