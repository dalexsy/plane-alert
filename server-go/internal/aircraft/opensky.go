package aircraft

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strings"
)

func (f *Fetcher) openSky(ctx context.Context, lat, lon, radius float64) ([]Row, error) {
	delta := radius / 111.32
	longitude := radius / (111.32 * math.Max(math.Cos(lat*math.Pi/180), .01))
	url := fmt.Sprintf("https://opensky-network.org/api/states/all?lamin=%g&lomin=%g&lamax=%g&lomax=%g", lat-delta, lon-longitude, lat+delta, lon+longitude)
	var data struct {
		States [][]json.RawMessage `json:"states"`
	}
	if err := f.get(ctx, url, &data); err != nil {
		return nil, err
	}
	rows := []Row{}
	for _, s := range data.States {
		if len(s) < 15 {
			continue
		}
		var hex, call string
		_ = json.Unmarshal(s[0], &hex)
		_ = json.Unmarshal(s[1], &call)
		if hex == "" || string(s[5]) == "null" || string(s[6]) == "null" {
			continue
		}
		row := Row{}
		set := func(k string, v any) { row[k], _ = json.Marshal(v) }
		set("hex", strings.ToUpper(hex))
		set("flight", strings.TrimSpace(call))
		set("callsign", strings.TrimSpace(call))
		row["lon"], row["lat"], row["gnd"], row["squawk"] = s[5], s[6], s[8], s[14]
		for _, field := range []struct {
			Index  int
			Key    string
			Factor float64
			Round  bool
		}{{7, "alt_baro", 3.28084, true}, {13, "alt_geom", 3.28084, true}, {9, "gs", 1.94384, false}, {10, "track", 1, false}, {11, "baro_rate", 3.28084 * 60, true}} {
			if string(s[field.Index]) == "null" {
				continue
			}
			var n float64
			if json.Unmarshal(s[field.Index], &n) == nil {
				n *= field.Factor
				if field.Round {
					n = math.Round(n)
				}
				set(field.Key, n)
			}
		}
		rows = append(rows, row)
	}
	return rows, nil
}
