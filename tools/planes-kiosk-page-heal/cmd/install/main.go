// Install cross-compiles planes-kiosk-page-heal for linux/arm64 and installs it
// on magicmirror (.74), removing the legacy Python heal script.
package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

const (
	kioskHost = "192.168.178.74"
	kioskUser = "pi"
	remoteBin = "/usr/local/sbin/planes-kiosk-page-heal"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	toolRoot, err := toolDir()
	if err != nil {
		return err
	}
	out := filepath.Join(toolRoot, "dist", "planes-kiosk-page-heal-linux-arm64")
	if err := os.MkdirAll(filepath.Dir(out), 0o755); err != nil {
		return err
	}
	build := exec.Command("go", "build", "-o", out, ".")
	build.Dir = toolRoot
	build.Env = append(os.Environ(),
		"GOOS=linux", "GOARCH=arm64", "CGO_ENABLED=0", "GOARM64=v8.0",
	)
	build.Stdout = os.Stdout
	build.Stderr = os.Stderr
	if err := build.Run(); err != nil {
		return fmt.Errorf("go build: %w", err)
	}

	remoteTmp := "/tmp/planes-kiosk-page-heal"
	dest := fmt.Sprintf("%s@%s:%s", kioskUser, kioskHost, remoteTmp)
	scp := exec.Command("scp", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", out, dest)
	scp.Stdout = os.Stdout
	scp.Stderr = os.Stderr
	if err := scp.Run(); err != nil {
		return fmt.Errorf("scp: %w", err)
	}

	script := strings.Join([]string{
		"set -eu",
		"sudo install -m 755 " + remoteTmp + " " + remoteBin,
		"sudo rm -f /usr/local/sbin/planes-kiosk-page-heal.py",
		"sudo rm -f /home/pi/bin/planes-kiosk-page-heal.py",
		"rm -f " + remoteTmp,
		remoteBin,
		"command -v " + remoteBin,
		"test ! -e /usr/local/sbin/planes-kiosk-page-heal.py",
	}, "\n")
	ssh := exec.Command(
		"ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10",
		kioskUser+"@"+kioskHost, "bash", "-s",
	)
	ssh.Stdin = strings.NewReader(script)
	ssh.Stdout = os.Stdout
	ssh.Stderr = os.Stderr
	if err := ssh.Run(); err != nil {
		return fmt.Errorf("remote install: %w", err)
	}
	fmt.Println("[ok] installed", remoteBin, "on", kioskHost)
	return nil
}

func toolDir() (string, error) {
	wd, err := os.Getwd()
	if err != nil {
		return "", err
	}
	// Prefer module root when invoked via `go run ./tools/planes-kiosk-page-heal/cmd/install`.
	candidates := []string{
		filepath.Join(wd, "tools", "planes-kiosk-page-heal"),
		wd,
		filepath.Join(wd, ".."),
		filepath.Join(wd, "..", ".."),
	}
	for _, c := range candidates {
		if _, err := os.Stat(filepath.Join(c, "go.mod")); err == nil {
			if _, err := os.Stat(filepath.Join(c, "main.go")); err == nil {
				return c, nil
			}
		}
	}
	return "", fmt.Errorf("planes-kiosk-page-heal module root not found from %s", wd)
}
