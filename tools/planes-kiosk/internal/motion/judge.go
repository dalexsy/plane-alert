package motion

import (
	"encoding/json"
	"fmt"
)

type Probe struct {
	StoredAnimations string `json:"storedAnimations"`
	RunningCount     int    `json:"runningCount"`
	TimedTransitions int    `json:"timedTransitions"`
	MovedMarkers     int    `json:"movedMarkers"`
	Decorative       struct {
		RainKids    int `json:"rainKids"`
		SwallowKids int `json:"swallowKids"`
		LeafKids    int `json:"leafKids"`
	} `json:"decorative"`
	SeenCollapsed      bool `json:"seenCollapsed"`
	SeenRows           int  `json:"seenRows"`
	DetachedPlaneRows  int  `json:"detachedPlaneRows"`
	DetachedPaths      int  `json:"detachedPaths"`
}

func Judge(raw json.RawMessage) (Probe, []string, error) {
	var p Probe
	if err := json.Unmarshal(raw, &p); err != nil {
		return p, nil, err
	}
	var fails []string
	if p.StoredAnimations != "false" {
		fails = append(fails, fmt.Sprintf("stored animationsEnabled=%q (diagnostic)", p.StoredAnimations))
	}
	if p.RunningCount > 0 {
		fails = append(fails, fmt.Sprintf("%d running Web Animations", p.RunningCount))
	}
	if p.TimedTransitions > 0 {
		fails = append(fails, fmt.Sprintf("%d markers with non-zero transition", p.TimedTransitions))
	}
	if p.MovedMarkers > 0 {
		fails = append(fails, fmt.Sprintf("%d markers interpolated over 2.5s while motion off", p.MovedMarkers))
	}
	if p.Decorative.RainKids > 0 {
		fails = append(fails, fmt.Sprintf("decorative rainKids=%d (RAF overlay still live)", p.Decorative.RainKids))
	}
	if p.Decorative.SwallowKids > 0 {
		fails = append(fails, fmt.Sprintf("decorative swallowKids=%d (RAF overlay still live)", p.Decorative.SwallowKids))
	}
	if p.Decorative.LeafKids > 0 {
		fails = append(fails, fmt.Sprintf("decorative leafKids=%d (RAF overlay still live)", p.Decorative.LeafKids))
	}
	if p.SeenCollapsed && p.SeenRows > 0 {
		fails = append(fails, fmt.Sprintf("collapsed history still renders %d plane rows", p.SeenRows))
	}
	if p.DetachedPlaneRows > 10 {
		fails = append(fails, fmt.Sprintf("retained detached plane rows=%d", p.DetachedPlaneRows))
	}
	if p.DetachedPaths > 20 {
		fails = append(fails, fmt.Sprintf("retained detached flight paths=%d", p.DetachedPaths))
	}
	return p, fails, nil
}
