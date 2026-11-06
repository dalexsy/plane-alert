package tests

import (
	"dryl-planes/internal/api"
	"dryl-planes/internal/push"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHistoryOnlyProjectsDeliveredCurrentDeviceRows(t *testing.T) {
	root := t.TempDir()
	key := strings.Repeat("a", 30)
	validation := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"status":1,"devices":["Current Phone"]}`))
	}))
	defer validation.Close()
	write(t, root, "planes-api-store.json", `{"military-history":{"`+key+`__abc":{"icao":"abc","internalSecret":"DO_NOT_EXPOSE","notificationLocation":{"lat":52,"lon":13,"internalSecret":"DO_NOT_EXPOSE"}},"`+key+`__raw":{"icao":"raw"}},"notification-cooldowns":{"`+key+`__current-phone__abc":{"lastSent":50},"`+key+`__retired-phone__old":{"lastSent":60}},"deviceTokens":{"`+key+`__current-phone":{"deviceName":"Current Phone","location":{"lat":52,"lon":13}}}}`)
	h := (&api.App{Root: root, Push: push.Client{Token: "fixture", ValidateURL: validation.URL}}).Handler()
	w := get(h, "/getMilitaryHistory?pushoverUserKey="+key)
	if w.Code != 200 || strings.Contains(w.Body.String(), "DO_NOT_EXPOSE") || strings.Contains(w.Body.String(), `"icao":"raw"`) || strings.Contains(w.Body.String(), `"icao":"old"`) || !strings.Contains(w.Body.String(), `"icao":"abc"`) {
		t.Fatal(w.Code, w.Body)
	}
	write(t, root, "planes-api-store.json", `{"unrelated":{}}`)
	w = get(h, "/getMilitaryHistory?pushoverUserKey="+key)
	if w.Code != 503 {
		t.Fatal("wrong store hidden", w.Code)
	}
}
func TestNonFiniteMapCoordinatesAreBadRequests(t *testing.T) {
	h := (&api.App{Root: t.TempDir()}).Handler()
	for _, query := range []string{"lat=NaN&lon=0&radiusKm=100", "lat=0&lon=Inf&radiusKm=100", "lat=0&lon=0&radiusKm=NaN"} {
		w := get(h, "/adsbPointProxy?"+query)
		if w.Code != 400 {
			t.Fatal(query, w.Code)
		}
	}
}
