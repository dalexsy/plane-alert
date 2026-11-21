package recovery

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/dalexsy/plane-alert/tools/planes-kiosk/internal/remote"
)

const adsURL = "https://planes.dryl.io/api/planes/adsbPointProxy?lat=52.4605886&lon=13.523268&radiusKm=100"
const fiURL = "https://opendata.adsb.fi/api/v2/lat/52.4605886/lon/13.523268/dist/54"

type Result struct {
	Fails   []string
	Markers int
	AcN     int
}

func must(ok bool, msg string, r *Result) {
	if ok {
		fmt.Printf("[ok] %s\n", msg)
		return
	}
	r.Fails = append(r.Fails, msg)
	fmt.Printf("[fail] %s\n", msg)
}

func Run() (Result, error) {
	r := Result{Markers: -1, AcN: -1}
	fmt.Printf("[verify:kiosk-recovery] %s@%s\n", remote.KioskUser, remote.KioskHost)

	unit, err := remote.SSH("grep -E 'PLANES_KIOSK_AUTH_URL|127.0.0.1:8790|admin.dryl.io' /etc/systemd/system/planes-kiosk-watch.service || true")
	if err != nil {
		return r, err
	}
	must(strings.Contains(unit, "admin.dryl.io") && !strings.Contains(unit, "127.0.0.1:8790"),
		"watch.service AUTH_URL uses admin.dryl.io (not local :8790)", &r)

	watch, err := remote.SSH("cat /usr/local/sbin/planes-kiosk-watch.sh")
	if err != nil {
		return r, err
	}
	wl := strings.ToLower(watch)
	must(strings.Contains(wl, "do not require session.jar") && strings.Contains(watch, "adsbPointProxy"),
		"plane_data_valid works without session.jar", &r)
	must(strings.Contains(wl, "edge hosts auth") || strings.Contains(wl, "not restarting local dryl-auth"),
		"watch does not restart masked local dryl-auth", &r)
	must(strings.Contains(watch, "PLANES_KIOSK_PAGE_HEAL_FORCE=1") || strings.Contains(wl, "soft page heal"),
		"data strikes trigger soft page heal", &r)
	must(strings.Contains(watch, "is_quiet_hours") && strings.Contains(watch, "22:00-07:00"),
		"quiet hours still skip Chromium kill flash", &r)
	must(strings.Contains(watch, "balcony_needs_headroom") && strings.Contains(watch, "renice"),
		"balcony headroom yield/renice still present", &r)
	must(strings.Contains(watch, "/usr/local/sbin/planes-kiosk-page-heal") &&
		!strings.Contains(watch, "planes-kiosk-page-heal.py"),
		"watch invokes Go page-heal binary", &r)

	healBin, _ := remote.SSH(
		"test -x /usr/local/sbin/planes-kiosk-page-heal && " +
			"test ! -e /usr/local/sbin/planes-kiosk-page-heal.py && " +
			"strings /usr/local/sbin/planes-kiosk-page-heal | grep -E 'empty-stuck|markerCount' | head -5 || true")
	must(strings.Contains(healBin, "empty-stuck") && strings.Contains(healBin, "markerCount"),
		"Go page-heal binary detects empty-stuck (no legacy .py)", &r)

	session, _ := remote.SSH(
		"set +e; sudo -u pi /home/pi/bin/planes-kiosk-session --verify-only; echo EXIT:$?")
	must(strings.Contains(session, "EXIT:0"), "session verify exit 0 via admin.dryl.io", &r)

	r.AcN = curlAcCount(adsURL)
	fiN := curlAcCount(fiURL)
	must(r.AcN >= 0, fmt.Sprintf("public ADS-B reachable (ac=%d)", r.AcN), &r)
	if fiN >= 3 {
		must(r.AcN >= 1, fmt.Sprintf("proxy not empty while adsb.fi has traffic (ac=%d fi=%d)", r.AcN, fiN), &r)
	}

	healOut, _ := remote.SSH("/usr/local/sbin/planes-kiosk-page-heal 2>&1 || true")
	fmt.Print(strings.TrimSpace(healOut) + "\n")
	if m := regexp.MustCompile(`markers=(\d+)`).FindStringSubmatch(healOut); len(m) == 2 {
		r.Markers, _ = strconv.Atoi(m[1])
	}
	must(r.Markers >= 1 && strings.Contains(healOut, "ok "),
		fmt.Sprintf("page-heal ok with live markers (markers=%d ac=%d)", r.Markers, r.AcN), &r)
	must(strings.Contains(healOut, "href=https://planes.dryl.io"),
		"Kallax live tab is planes.dryl.io (mirror-verify canary)", &r)

	userActive, _ := remote.SSH(
		"sudo -u pi bash -lc 'export XDG_RUNTIME_DIR=/run/user/$(id -u); " +
			"export DBUS_SESSION_BUS_ADDRESS=unix:path=$XDG_RUNTIME_DIR/bus; " +
			"systemctl --user is-active planes-kiosk.service' 2>&1 || true")
	pgrep, _ := remote.SSH("pgrep -af planes-kiosk-chromium | head -1 || true")
	must(strings.Contains(userActive, "active") && strings.Contains(pgrep, "planes-kiosk-chromium"),
		"user planes-kiosk.service active + chromium running", &r)
	return r, nil
}

func curlAcCount(url string) int {
	out, err := remote.SSH(fmt.Sprintf(
		"curl -sf -m 12 -A 'Mozilla/5.0 (X11; Linux aarch64) Chrome/120.0.0.0' '%s' 2>/dev/null || true", url))
	if err != nil || strings.TrimSpace(out) == "" {
		return -1
	}
	var payload struct {
		Ac       []json.RawMessage `json:"ac"`
		Aircraft []json.RawMessage `json:"aircraft"`
	}
	if json.Unmarshal([]byte(out), &payload) != nil {
		return -1
	}
	if n := len(payload.Ac); n > 0 {
		return n
	}
	return len(payload.Aircraft)
}
