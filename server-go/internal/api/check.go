package api

import (
	"encoding/json"
	"errors"
	"path/filepath"
)

// CheckData validates installed stores without credentials, network or writes.
func CheckData(root string) error {
	main, err := Read(filepath.Join(root, "planes-api-store.json"))
	if err != nil {
		return err
	}
	known := false
	for _, key := range []string{"deviceTokens", "notification-cooldowns", "military-history", "aircraft-snapshots", "system"} {
		if raw, ok := main[key]; ok {
			known = true
			var collection map[string]Object
			if json.Unmarshal(raw, &collection) != nil || collection == nil {
				return errors.New("invalid saved Plane collection")
			}
			for _, row := range collection {
				if row == nil {
					return errors.New("invalid saved Plane document")
				}
			}
		}
	}
	if !known {
		return errors.New("unexpected Plane store shape")
	}
	antenna, err := Read(filepath.Join(root, "antenna-sightings.json"))
	if err != nil {
		return err
	}
	var sightings map[string]Object
	if json.Unmarshal(antenna["sightings"], &sightings) != nil || sightings == nil {
		return errors.New("invalid saved antenna collection")
	}
	for _, row := range sightings {
		if row == nil || text(row, "hex") == "" {
			return errors.New("invalid saved antenna row")
		}
	}
	return nil
}
