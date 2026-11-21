package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/dalexsy/plane-alert/tools/planes-kiosk/internal/install"
	"github.com/dalexsy/plane-alert/tools/planes-kiosk/internal/remote"
)

func main() {
	repo, err := install.FindRepoRoot()
	if err != nil {
		fmt.Fprintf(os.Stderr, "probe failed: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("=== chromium cpu (top 6) ===")
	cpu, err := remote.SSH(
		"ps -C chromium -o pid=,pcpu=,pmem=,rss= --sort=-pcpu | sed -n '1,6p'; echo LOAD; cat /proc/loadavg")
	if err != nil {
		fmt.Fprintf(os.Stderr, "probe failed: %v\n%s\n", err, cpu)
		os.Exit(1)
	}
	fmt.Println(strings.TrimSpace(cpu))

	mod := filepath.Join(repo, "tools", "planes-kiosk")
	dist := filepath.Join(mod, "dist")
	_ = os.MkdirAll(dist, 0o755)
	bin := filepath.Join(dist, "planes-kiosk-probe-cpu-agent-linux-arm64")
	if err := remote.BuildArm64(mod, "./cmd/probe-cpu-agent", bin); err != nil {
		fmt.Fprintf(os.Stderr, "probe failed: build: %v\n", err)
		os.Exit(1)
	}
	if err := remote.SCPTo(bin, "/tmp/planes-kiosk-probe-cpu-agent"); err != nil {
		fmt.Fprintf(os.Stderr, "probe failed: scp: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("=== cdp probe ===")
	out, err := remote.SSH("chmod +x /tmp/planes-kiosk-probe-cpu-agent; /tmp/planes-kiosk-probe-cpu-agent")
	fmt.Print(out)
	if err != nil {
		os.Exit(1)
	}
}
