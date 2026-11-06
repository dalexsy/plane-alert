package tests

import (
	"bytes"
	"dryl-planes/internal/api"
	"dryl-planes/internal/push"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func write(t *testing.T, root, name, body string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(root, name), []byte(body), 0600); err != nil {
		t.Fatal(err)
	}
}
func get(h http.Handler, path string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest("GET", path, nil))
	return w
}
func TestAntennaHistoryReadOnlyQueriesAndCorruption(t *testing.T) {
	root := t.TempDir()
	original := `{"lastPollOk":true,"sightings":{"aaa":{"hex":"aaa","lastFlight":"CALL","flights":["OLD"],"lastSeen":100,"closestNm":2,"lastMessages":99},"bbb":{"hex":"bbb","lastFlight":"OTHER","flights":[],"lastSeen":200,"closestNm":null}}}`
	write(t, root, "antenna-sightings.json", original)
	h := (&api.App{Root: root}).Handler()
	w := get(h, "/antennaSightings?q=old&sort=closest")
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"hex":"aaa"`) || strings.Contains(w.Body.String(), "lastMessages") || strings.Contains(w.Body.String(), `"hex":"bbb"`) {
		t.Fatal(w.Code, w.Body)
	}
	got, _ := os.ReadFile(filepath.Join(root, "antenna-sightings.json"))
	if !bytes.Equal(got, []byte(original)) {
		t.Fatal("read rewrote history")
	}
	write(t, root, "antenna-sightings.json", `{"sightings":`)
	w = get(h, "/antennaSightings")
	if w.Code != 503 {
		t.Fatal("corruption hidden", w.Code)
	}
}
func TestMilitaryHistoryKeyIsolationAndCooldowns(t *testing.T) {
	root := t.TempDir()
	validation := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"status":1,"devices":["phone"]}`))
	}))
	defer validation.Close()
	key := strings.Repeat("a", 30)
	other := strings.Repeat("b", 30)
	write(t, root, "planes-api-store.json", `{"future":{"exact":9007199254740993},"military-history":{"`+key+`__abc":{"icao":"abc","firstSeen":10,"lastSeen":20,"callsign":"EXISTING"},"`+other+`__private":{"icao":"private"}},"notification-cooldowns":{"`+key+`__phone__abc":{"lastSent":50}},"deviceTokens":{}}`)
	h := (&api.App{Root: root, Push: push.Client{Token: "fixture", ValidateURL: validation.URL}}).Handler()
	w := get(h, "/getMilitaryHistory?pushoverUserKey="+key)
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"callsign":"EXISTING"`) || !strings.Contains(w.Body.String(), `"notificationDelivered":true`) || strings.Contains(w.Body.String(), "private") {
		t.Fatal(w.Code, w.Body)
	}
	w = get(h, "/getMilitaryHistory?pushoverUserKey=invalid")
	if w.Code != 400 {
		t.Fatal(w.Code)
	}
}
