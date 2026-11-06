package antenna

import (
	"encoding/json"
	"math"
	"strconv"
	"strings"
)

type Object = map[string]json.RawMessage

func text(v Object, k string) string  { var s string; _ = json.Unmarshal(v[k], &s); return s }
func stringsLowerHex(v Object) string { return strings.ToLower(strings.TrimSpace(text(v, "hex"))) }
func set(v Object, k string, x any)   { v[k], _ = json.Marshal(x) }
func numeric(raw json.RawMessage) *float64 {
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	var n float64
	if json.Unmarshal(raw, &n) != nil {
		var s string
		if json.Unmarshal(raw, &s) != nil || strings.TrimSpace(s) == "" {
			return nil
		}
		var err error
		n, err = strconv.ParseFloat(strings.TrimSpace(s), 64)
		if err != nil {
			return nil
		}
	}
	if math.IsNaN(n) || math.IsInf(n, 0) {
		return nil
	}
	return &n
}
func value(v Object, k string) float64 {
	if n := numeric(v[k]); n != nil {
		return *n
	}
	return 0
}
func upsert(previous, ac Object, now int64) Object {
	hex := strings.ToLower(strings.TrimSpace(text(ac, "hex")))
	if hex == "" || len(hex) > 32 {
		return nil
	}
	row := Object{}
	for k, v := range previous {
		row[k] = v
	}
	flight := strings.Join(strings.Fields(text(ac, "flight")), " ")
	if len(flight) > 80 {
		flight = flight[:80]
	}
	set(row, "hex", hex)
	set(row, "lastSeen", now)
	var flights []string
	_ = json.Unmarshal(row["flights"], &flights)
	if previous == nil {
		set(row, "firstSeen", now)
		set(row, "hits", 0)
		set(row, "messages", 0)
		set(row, "lastFlight", "")
		set(row, "lastMessages", nil)
		for _, k := range []string{"closestNm", "closestDir", "closestAt", "altMin", "altMax"} {
			set(row, k, nil)
		}
		set(row, "category", "")
	}
	if flight != "" {
		next := []string{flight}
		for _, v := range flights {
			if v != flight && len(next) < 8 {
				next = append(next, v)
			}
		}
		flights = next
		set(row, "lastFlight", flight)
	}
	if flights == nil {
		flights = []string{}
	}
	set(row, "flights", flights)
	set(row, "hits", value(row, "hits")+1)
	if incoming := numeric(ac["messages"]); incoming != nil && *incoming >= 0 {
		if last := numeric(row["lastMessages"]); last != nil {
			delta := *incoming
			if *incoming >= *last {
				delta = *incoming - *last
			}
			set(row, "messages", value(row, "messages")+delta)
		}
		set(row, "lastMessages", *incoming)
	}
	if distance := numeric(ac["r_dst"]); distance != nil && *distance >= 0 {
		old := numeric(row["closestNm"])
		if old == nil || *distance < *old {
			set(row, "closestNm", *distance)
			set(row, "closestDir", numeric(ac["r_dir"]))
			set(row, "closestAt", now)
		}
	}
	if alt := numeric(ac["alt_baro"]); alt != nil {
		low, high := numeric(row["altMin"]), numeric(row["altMax"])
		if low == nil || *alt < *low {
			set(row, "altMin", *alt)
		}
		if high == nil || *alt > *high {
			set(row, "altMax", *alt)
		}
	}
	if category := strings.TrimSpace(text(ac, "category")); category != "" && len(category) < 32 {
		set(row, "category", category)
	}
	return row
}
