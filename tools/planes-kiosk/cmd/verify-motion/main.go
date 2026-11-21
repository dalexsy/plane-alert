package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/dalexsy/plane-alert/tools/planes-kiosk/internal/install"
	"github.com/dalexsy/plane-alert/tools/planes-kiosk/internal/remote"
)

func main() {
	repo, err := install.FindRepoRoot()
	if err != nil {
		fmt.Fprintf(os.Stderr, "[fail] %v\n", err)
		os.Exit(1)
	}
	mod := filepath.Join(repo, "tools", "planes-kiosk")
	dist := filepath.Join(mod, "dist")
	_ = os.MkdirAll(dist, 0o755)
	bin := filepath.Join(dist, "planes-kiosk-motion-agent-linux-arm64")
	if err := remote.BuildArm64(mod, "./cmd/motion-agent", bin); err != nil {
		fmt.Fprintf(os.Stderr, "[fail] build: %v\n", err)
		os.Exit(1)
	}
	if err := remote.SCPTo(bin, "/tmp/planes-kiosk-motion-agent"); err != nil {
		fmt.Fprintf(os.Stderr, "[fail] scp: %v\n", err)
		os.Exit(1)
	}
	remoteShot := "/tmp/kiosk-motion-verify.png"
	out, err := remote.SSH(fmt.Sprintf(
		"chmod +x /tmp/planes-kiosk-motion-agent; /tmp/planes-kiosk-motion-agent --shot %s", remoteShot))
	fmt.Print(out)
	if err != nil {
		os.Exit(1)
	}
	localDir := filepath.Join(repo, "..", "directory", "logs", "deploy-screenshots", "planes-kiosk")
	_ = os.MkdirAll(localDir, 0o755)
	local := filepath.Join(localDir, "kiosk-motion-"+strconv.FormatInt(time.Now().UnixMilli(), 10)+".png")
	if err := remote.SCPFrom(remoteShot, local); err != nil {
		fmt.Fprintf(os.Stderr, "[fail] scp shot: %v\n", err)
		os.Exit(1)
	}
	quote := "kiosk motion off — 0 running animations, 0 timed marker transitions, " +
		"0 decorative overlay children, collapsed history not rendered, markers stable over 2.5s"
	fmt.Printf("[agent-required] KIOSK_SCREENSHOT: %s\n", local)
	fmt.Printf("[agent-required] QUOTE_VISIBLE: %s\n", quote)
	if !strings.Contains(out, "{") {
		fmt.Fprintln(os.Stderr, "[fail] empty probe")
		os.Exit(1)
	}
	fmt.Println("[ok] planes kiosk motion gate")
}
