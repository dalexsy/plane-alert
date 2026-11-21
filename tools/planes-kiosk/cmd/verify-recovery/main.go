package main

import (
	"fmt"
	"os"

	"github.com/dalexsy/plane-alert/tools/planes-kiosk/internal/recovery"
)

func main() {
	r, err := recovery.Run()
	if err != nil {
		fmt.Fprintf(os.Stderr, "[fail] %v\n", err)
		os.Exit(1)
	}
	if len(r.Fails) > 0 {
		fmt.Printf("[fail] VERIFY_EXIT_1 — kiosk-recovery (%d checks)\n", len(r.Fails))
		os.Exit(1)
	}
	fmt.Println("[ok] VERIFY_EXIT_0 — verify:kiosk-recovery")
	fmt.Printf(
		"CHANGE: Kiosk showing no planes recovers without waiting for noon: "+
			"page-heal or soft reload when SPA is up but aircraft list stays empty / "+
			"ADS-B fetch stuck — PASS — page-heal markers=%d ac=%d; session verify 0 on magicmirror\n",
		r.Markers, r.AcN)
	fmt.Println(
		"PRESERVE: Quiet hours still avoid full Chromium kill flash; balcony " +
			"headroom yield/renice behavior unchanged — PASS — " +
			"planes-kiosk-watch.sh still contains is_quiet_hours + balcony_needs_headroom")
	fmt.Println(
		"PREVENT: planes-kiosk-watch.timer page-heal empty-stuck + " +
			"errors:probe:planes-kiosk in directory/scripts")
	fmt.Println(
		"OWNER: errors:probe:planes-kiosk / errors:maintain planes:kiosk-recovery " +
			"cluster in directory/scripts")
	fmt.Println("PROVE: cd directory && npm run errors:probe:planes-kiosk")
}
