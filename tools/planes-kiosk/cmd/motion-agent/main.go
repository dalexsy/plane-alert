package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/dalexsy/plane-alert/tools/planes-kiosk/internal/cdp"
	"github.com/dalexsy/plane-alert/tools/planes-kiosk/internal/motion"
)

func main() {
	shot := flag.String("shot", "/tmp/kiosk-motion.png", "screenshot path")
	flag.Parse()
	targets, err := cdp.List("http://127.0.0.1:9222/json")
	if err != nil {
		fmt.Fprintf(os.Stderr, "[fail] list cdp: %v\n", err)
		os.Exit(1)
	}
	target, ok := cdp.FirstPlanesPage(targets)
	if !ok {
		fmt.Fprintln(os.Stderr, "[fail] no planes.dryl.io Chromium target on :9222")
		os.Exit(1)
	}
	if !strings.Contains(target.URL, "kiosk=1") {
		fmt.Fprintf(os.Stderr, "[fail] kiosk URL missing ?kiosk=1 — %s\n", target.URL)
		os.Exit(1)
	}
	client, err := cdp.Dial(target.WebSocketDebuggerURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "[fail] dial: %v\n", err)
		os.Exit(1)
	}
	defer client.Close()

	value, err := client.Evaluate(motion.ProbeJS)
	if err != nil {
		fmt.Fprintf(os.Stderr, "[fail] evaluate: %v\n", err)
		os.Exit(1)
	}
	var probe map[string]any
	if err := json.Unmarshal(value, &probe); err != nil {
		fmt.Fprintf(os.Stderr, "[fail] probe json: %v\n", err)
		os.Exit(1)
	}
	if dom, err := client.Call("Memory.getDOMCounters", nil); err == nil {
		var counters any
		_ = json.Unmarshal(dom, &counters)
		probe["domCounters"] = counters
	}
	if det, err := client.Call("DOM.getDetachedDomNodes", nil); err == nil {
		var payload struct {
			DetachedNodes []struct {
				TreeNode struct {
					NodeName string `json:"nodeName"`
				} `json:"treeNode"`
			} `json:"detachedNodes"`
		}
		_ = json.Unmarshal(det, &payload)
		probe["detachedRoots"] = len(payload.DetachedNodes)
		rows, paths := 0, 0
		for _, n := range payload.DetachedNodes {
			switch n.TreeNode.NodeName {
			case "APP-PLANE-LIST-ITEM":
				rows++
			case "path":
				paths++
			}
		}
		probe["detachedPlaneRows"] = rows
		probe["detachedPaths"] = paths
	}
	if err := client.Screenshot(*shot); err != nil {
		fmt.Fprintf(os.Stderr, "[fail] screenshot: %v\n", err)
		os.Exit(1)
	}
	out, _ := json.MarshalIndent(probe, "", "  ")
	fmt.Println(string(out))
	raw, _ := json.Marshal(probe)
	_, fails, err := motion.Judge(raw)
	if err != nil {
		fmt.Fprintf(os.Stderr, "[fail] judge: %v\n", err)
		os.Exit(1)
	}
	if len(fails) > 0 {
		for _, f := range fails {
			fmt.Fprintf(os.Stderr, "[fail] %s\n", f)
		}
		os.Exit(1)
	}
	fmt.Fprintf(os.Stderr, "[ok] motion agent shot=%s\n", *shot)
}
