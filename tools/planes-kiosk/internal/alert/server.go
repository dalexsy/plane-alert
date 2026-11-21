package alert

import (
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"strings"
)

type Config struct {
	EnvFile    string
	PlayScript string
	ListenHost string
}

func DefaultConfig() Config {
	return Config{
		EnvFile: envOr("PLANES_KIOSK_ALERT_ENV", "/home/pi/.config/planes-kiosk/alert-play.env"),
		PlayScript: envOr("PLANES_KIOSK_ALERT_PLAY", "/home/pi/bin/planes-kiosk-alert-play.sh"),
		ListenHost: "0.0.0.0",
	}
}

func envOr(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}

type handler struct{ cfg Config }

func (h handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	if !IsLANIP(host) {
		writeJSON(w, 403, map[string]any{"ok": false, "error": "lan-only"})
		return
	}
	switch {
	case r.Method == http.MethodGet && (r.URL.Path == "/" || r.URL.Path == "/health"):
		writeJSON(w, 200, map[string]any{"ok": true, "service": "planes-kiosk-alert"})
	case r.Method == http.MethodPost && r.URL.Path == "/play":
		h.handlePlay(w, r)
	default:
		writeJSON(w, 404, map[string]any{"ok": false, "error": "not-found"})
	}
}

func (h handler) handlePlay(w http.ResponseWriter, r *http.Request) {
	expected := PlayToken(h.cfg.EnvFile)
	hdrs := map[string]string{}
	for k, vals := range r.Header {
		if len(vals) > 0 {
			hdrs[k] = vals[0]
		}
	}
	if !SecretsMatch(ReadToken(hdrs), expected) {
		writeJSON(w, 401, map[string]any{"ok": false, "error": "unauthorized"})
		return
	}
	raw, _ := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	body, err := DecodeBody(raw)
	if err != nil {
		writeJSON(w, 400, map[string]any{"ok": false, "error": "bad-json"})
		return
	}
	variant := VariantFromBody(body)
	stdout, stderr, code, playErr := PlayVariant(h.cfg.PlayScript, variant)
	if playErr != nil {
		writeJSON(w, 500, map[string]any{"ok": false, "error": trim(playErr.Error(), 200)})
		return
	}
	if code != 0 {
		errMsg := strings.TrimSpace(stderr)
		if errMsg == "" {
			errMsg = strings.TrimSpace(stdout)
		}
		if errMsg == "" {
			errMsg = "play-failed"
		}
		writeJSON(w, 500, map[string]any{"ok": false, "error": trim(errMsg, 300), "variant": variant})
		return
	}
	icao, _ := body["icao"].(string)
	writeJSON(w, 200, map[string]any{"ok": true, "variant": variant, "icao": icao})
}

func writeJSON(w http.ResponseWriter, status int, payload map[string]any) {
	data, _ := json.Marshal(payload)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write(data)
}

func trim(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}

func Serve(cfg Config) error {
	token := PlayToken(cfg.EnvFile)
	if token == "" {
		return fmt.Errorf("PLANES_KIOSK_PLAY_TOKEN missing (set env or %s)", cfg.EnvFile)
	}
	port := ListenPort(cfg.EnvFile)
	addr := fmt.Sprintf("%s:%d", cfg.ListenHost, port)
	fmt.Printf("planes-kiosk-alert listening on %s\n", addr)
	return http.ListenAndServe(addr, handler{cfg: cfg})
}

func SelfTest() {
	must(IsLANIP("127.0.0.1"))
	must(IsLANIP("::1"))
	must(IsLANIP("192.168.178.79"))
	must(IsLANIP("192.168.178.74"))
	must(!IsLANIP("8.8.8.8"))
	must(!IsLANIP("not-an-ip"))
	must(VariantFromBody(map[string]any{"variant": "hercules"}) == "hercules")
	must(VariantFromBody(map[string]any{"model": "Lockheed C-130 Hercules"}) == "hercules")
	must(VariantFromBody(map[string]any{"model": "Airbus A400M"}) == "a400")
	must(VariantFromBody(map[string]any{}) == "default")
	must(SecretsMatch("abc", "abc"))
	must(!SecretsMatch("abc", "abd"))
	must(!SecretsMatch("", "abc"))
	must(ReadToken(map[string]string{"Authorization": "Bearer secret"}) == "secret")
	fmt.Println("[ok] planes-kiosk-alert-listen self-test")
}

func must(ok bool) {
	if !ok {
		panic("self-test assertion failed")
	}
}
