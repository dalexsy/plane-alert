package main

import (
	"os"
	"testing"
)

func TestIsBlank(t *testing.T) {
	cases := []struct {
		name  string
		state pageState
		want  bool
	}{
		{"about blank", pageState{Href: "about:blank"}, true},
		{"empty href", pageState{Href: ""}, true},
		{"thin shell", pageState{Href: "https://planes.dryl.io/?kiosk=1", AppRootLen: 10, BodyLen: 5}, true},
		{"healthy", pageState{Href: "https://planes.dryl.io/?kiosk=1", AppRootLen: 500, HasMap: true, Title: "Plane Alert", BodyLen: 200}, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := isBlank(tc.state); got != tc.want {
				t.Fatalf("isBlank=%v want %v", got, tc.want)
			}
		})
	}
}

func TestNeedsHealForce(t *testing.T) {
	t.Setenv("PLANES_KIOSK_PAGE_HEAL_FORCE", "1")
	state := pageState{
		Href: "https://planes.dryl.io/?kiosk=1", AppRootLen: 500, HasMap: true,
		Title: "Plane Alert", BodyLen: 200, MarkerCount: 5,
	}
	if got := needsHeal(state); got != "force" {
		t.Fatalf("needsHeal=%q want force", got)
	}
	_ = os.Unsetenv("PLANES_KIOSK_PAGE_HEAL_FORCE")
}

func TestNeedsHealHealthy(t *testing.T) {
	t.Setenv("PLANES_KIOSK_PAGE_HEAL_FORCE", "")
	state := pageState{
		Href: "https://planes.dryl.io/?kiosk=1", AppRootLen: 500, HasMap: true,
		Title: "Plane Alert", BodyLen: 200, MarkerCount: 5,
	}
	if got := needsHeal(state); got != "" {
		t.Fatalf("needsHeal=%q want empty", got)
	}
}
