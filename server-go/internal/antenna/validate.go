package antenna

import (
	"encoding/json"
	"errors"
	"strings"
)

func validateRows(rows map[string]Object) error {
	for id, row := range rows {
		if row == nil || stringsLowerHex(row) == "" || strings.ToLower(strings.TrimSpace(id)) != stringsLowerHex(row) {
			return errors.New("invalid saved antenna identity")
		}
		var flights []string
		if json.Unmarshal(row["flights"], &flights) != nil || flights == nil {
			return errors.New("invalid saved antenna callsigns")
		}
		for _, key := range []string{"lastFlight", "category"} {
			if raw, ok := row[key]; ok {
				var value string
				if json.Unmarshal(raw, &value) != nil {
					return errors.New("invalid saved antenna text")
				}
			}
		}
		for _, key := range []string{"firstSeen", "lastSeen", "hits", "messages"} {
			var n float64
			if json.Unmarshal(row[key], &n) != nil || string(row[key]) == "null" || n < 0 {
				return errors.New("invalid saved antenna counters")
			}
		}
		for _, key := range []string{"closestNm", "closestDir", "closestAt", "altMin", "altMax", "lastMessages"} {
			if raw, ok := row[key]; ok && string(raw) != "null" {
				var n float64
				if json.Unmarshal(raw, &n) != nil {
					return errors.New("invalid saved antenna statistic")
				}
			}
		}
	}
	return nil
}
