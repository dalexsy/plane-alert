package api

import "net/http"

func notificationsOff(w http.ResponseWriter, _ *http.Request) {
	JSON(w, 200, struct {
		Success bool   `json:"success"`
		Skipped bool   `json:"skipped"`
		Reason  string `json:"reason"`
	}{Skipped: true, Reason: "Plane notifications are off"})
}
