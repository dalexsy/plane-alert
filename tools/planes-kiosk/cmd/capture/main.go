package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/dalexsy/plane-alert/tools/planes-kiosk/internal/install"
	"github.com/dalexsy/plane-alert/tools/planes-kiosk/internal/remote"
)

const remotePath = "/tmp/planes-kiosk-verification.png"

func main() {
	repo, err := install.FindRepoRoot()
	if err != nil {
		fmt.Fprintf(os.Stderr, "[fail] %v\n", err)
		os.Exit(1)
	}
	out, err := remote.SSH(fmt.Sprintf(
		"XDG_RUNTIME_DIR=/run/user/1000 WAYLAND_DISPLAY=wayland-0 grim %s; test -s %s",
		remotePath, remotePath))
	if err != nil {
		fmt.Fprintf(os.Stderr, "[fail] grim: %v\n%s\n", err, out)
		os.Exit(1)
	}
	if s := strings.TrimSpace(out); s != "" {
		fmt.Println(s)
	}
	local := filepath.Join(repo, "..", "directory", "logs", "deploy-screenshots", "planes", "kiosk-latest.png")
	if err := os.MkdirAll(filepath.Dir(local), 0o755); err != nil {
		fmt.Fprintf(os.Stderr, "[fail] %v\n", err)
		os.Exit(1)
	}
	if err := remote.SCPFrom(remotePath, local); err != nil {
		fmt.Fprintf(os.Stderr, "[fail] scp: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("[agent-required] PLANES_KIOSK_SCREENSHOT: %s\n", local)
}
