package geocode

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCoordinatesFallThroughToReadableSecondary(t *testing.T) {
	for _, secondary := range []struct{ Body, Address string }{{`{"locality":"Paris","principalSubdivision":"Ile-de-France","countryName":"France"}`, "Paris, Ile-de-France"}, {`{"locality":"Berlin","principalSubdivision":"Berlin","countryName":"Germany"}`, "Berlin"}, {`{"locality":"52.4600,13.5200"}`, ""}} {
		primary := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			_, _ = w.Write([]byte(`{"display_name":"52.4600,13.5200"}`))
		}))
		fallback := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { _, _ = w.Write([]byte(secondary.Body)) }))
		w := httptest.NewRecorder()
		(Service{NominatimURL: primary.URL, BigURL: fallback.URL}).ServeHTTP(w, httptest.NewRequest("GET", "/reverseGeocode?lat=52&lon=13", nil))
		primary.Close()
		fallback.Close()
		if w.Code != 200 || strings.Contains(w.Body.String(), "52.4600") || !strings.Contains(w.Body.String(), `"address":"`+secondary.Address+`"`) {
			t.Fatal(w.Code, w.Body)
		}
	}
}
