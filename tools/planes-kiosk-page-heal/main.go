// planes-kiosk-page-heal soft-reloads Chromium via CDP when the kiosk SPA is
// blank or empty of markers while ADS-B still has aircraft nearby.
package main

import (
	"fmt"
	"os"
)

func main() {
	os.Exit(run())
}

func run() int {
	targets, err := listCDPTargets()
	if err != nil {
		fmt.Fprintf(os.Stderr, "planes-kiosk-page-heal: cdp list failed: %v\n", err)
		return 0
	}
	page, ok := firstPageTarget(targets)
	if !ok {
		fmt.Fprintln(os.Stderr, "planes-kiosk-page-heal: no page target")
		return 0
	}
	client, err := dialCDP(page.WebSocketDebuggerURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "planes-kiosk-page-heal: %v\n", err)
		return 0
	}
	defer client.Close()

	state, err := client.pageState()
	if err != nil {
		fmt.Fprintf(os.Stderr, "planes-kiosk-page-heal: %v\n", err)
		return 0
	}
	reason := needsHeal(state)
	if reason == "" {
		fmt.Printf(
			"planes-kiosk-page-heal: ok href=%s appRootLen=%d hasMap=%v markers=%d\n",
			state.Href, state.AppRootLen, state.HasMap, state.MarkerCount,
		)
		return 0
	}
	fmt.Fprintf(
		os.Stderr,
		"planes-kiosk-page-heal: heal reason=%s href=%s appRootLen=%d markers=%d — soft reload\n",
		reason, state.Href, state.AppRootLen, state.MarkerCount,
	)
	after, err := client.softReload(state)
	if err != nil {
		fmt.Fprintf(os.Stderr, "planes-kiosk-page-heal: %v\n", err)
		return 0
	}
	if needsHeal(after) != "" {
		fmt.Fprintf(
			os.Stderr,
			"planes-kiosk-page-heal: still unhealthy after heal href=%s markers=%d\n",
			after.Href, after.MarkerCount,
		)
		return 1
	}
	fmt.Printf(
		"planes-kiosk-page-heal: healed href=%s title=%s markers=%d\n",
		after.Href, after.Title, after.MarkerCount,
	)
	return 0
}
