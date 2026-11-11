package tests

import (
	"encoding/json"
	"io"
	"net/http/httptest"
	"strings"
	"testing"

	"dryl-planes/internal/api"
)

func TestDeviceRoutesReportNotificationsOff(t *testing.T) {
	h := (&api.App{}).Handler()
	calls := []struct{ method, path string }{
		{"POST", "/registerDevice"},
		{"GET", "/checkDevice"},
		{"POST", "/checkDevice"},
	}
	for _, call := range calls {
		var body io.Reader
		if call.method == "POST" {
			body = strings.NewReader(`{}`)
		}
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest(call.method, call.path, body))
		if w.Code != 200 {
			t.Fatalf("%s %s: %d %s", call.method, call.path, w.Code, w.Body)
		}
		var got struct {
			Success bool   `json:"success"`
			Skipped bool   `json:"skipped"`
			Reason  string `json:"reason"`
		}
		if json.Unmarshal(w.Body.Bytes(), &got) != nil || got.Success || !got.Skipped || got.Reason != "Plane notifications are off" || strings.Contains(w.Body.String(), "restored") {
			t.Fatalf("%s %s: %s", call.method, call.path, w.Body)
		}
	}
	other := httptest.NewRecorder()
	h.ServeHTTP(other, httptest.NewRequest("POST", "/sendNotification", strings.NewReader(`{}`)))
	if other.Code != 503 || !strings.Contains(other.Body.String(), "being restored in Go") {
		t.Fatalf("catch-all: %d %s", other.Code, other.Body)
	}
}
