package main

import (
	"fmt"
	"os"
	"strings"

	"github.com/dalexsy/plane-alert/tools/planes-kiosk/internal/cdp"
	"github.com/dalexsy/plane-alert/tools/planes-kiosk/internal/probe"
)

func main() {
	targets, err := cdp.List("http://127.0.0.1:9222/json")
	if err != nil {
		fmt.Fprintf(os.Stderr, "probe failed: %v\n", err)
		os.Exit(1)
	}
	target, ok := cdp.FirstPlanesPage(targets)
	if !ok {
		for _, t := range targets {
			if t.Type == "page" && t.WebSocketDebuggerURL != "" {
				target = t
				ok = true
				break
			}
		}
	}
	if !ok {
		fmt.Fprintln(os.Stderr, "probe failed: no page")
		os.Exit(1)
	}
	client, err := cdp.Dial(target.WebSocketDebuggerURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "probe failed: %v\n", err)
		os.Exit(1)
	}
	defer client.Close()
	_, _ = client.Call("Runtime.enable", nil)
	value, err := client.Evaluate(probe.ProbeJS)
	if err != nil {
		fmt.Fprintf(os.Stderr, "probe failed: %v\n", err)
		os.Exit(1)
	}
	fmt.Println(strings.TrimSpace(string(value)))
}
