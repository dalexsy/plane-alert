package install

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/dalexsy/plane-alert/tools/planes-kiosk/internal/ufw"
)

func FindRepoRoot() (string, error) {
	wd, err := os.Getwd()
	if err != nil {
		return "", err
	}
	candidates := []string{
		wd,
		filepath.Join(wd, ".."),
		filepath.Join(wd, "..", ".."),
		filepath.Join(wd, "..", "..", ".."),
	}
	for _, c := range candidates {
		if _, err := os.Stat(filepath.Join(c, "scripts", "mirror-kiosk", "planes-kiosk.sh")); err == nil {
			return c, nil
		}
		if _, err := os.Stat(filepath.Join(c, "tools", "planes-kiosk", "go.mod")); err == nil {
			// climbed into tools/planes-kiosk — repo is parent.parent
			root := filepath.Clean(filepath.Join(c, "..", ".."))
			if _, err := os.Stat(filepath.Join(root, "scripts", "mirror-kiosk")); err == nil {
				return root, nil
			}
		}
	}
	return "", fmt.Errorf("plane-alert repo root not found from %s", wd)
}

func Run(launch bool) error {
	repo, err := FindRepoRoot()
	if err != nil {
		return err
	}
	bins, err := buildLinuxArm64(repo)
	if err != nil {
		return err
	}
	fmt.Printf("[planes-kiosk] %s@%s prod=%s\n", KioskUser, KioskHost, ProdIP)

	for _, f := range staticFiles() {
		local := filepath.Join(repo, f.LocalRel)
		if _, err := os.Stat(local); err != nil {
			return fmt.Errorf("missing %s", local)
		}
		if err := scpTo(local, f.RemoteTmp); err != nil {
			return fmt.Errorf("scp %s: %w", f.LocalRel, err)
		}
	}
	uploads := []struct{ local, remote string }{
		{bins.Session, "/tmp/planes-kiosk-session"},
		{bins.AlertListen, "/tmp/planes-kiosk-alert-listen"},
		{bins.PageHeal, "/tmp/planes-kiosk-page-heal"},
	}
	for _, u := range uploads {
		if err := scpTo(u.local, u.remote); err != nil {
			return fmt.Errorf("scp %s: %w", u.local, err)
		}
	}

	if out, err := sshRun("mkdir -p /tmp/kiosk-alerts /home/pi/.config/planes-kiosk/alerts"); err != nil {
		return fmt.Errorf("mkdir alerts: %w: %s", err, out)
	}
	alertsDir := filepath.Join(repo, "src", "assets", "alerts")
	for _, name := range alertMP3s {
		local := filepath.Join(alertsDir, name)
		if _, err := os.Stat(local); err != nil {
			fmt.Printf("[warn] missing kiosk alert mp3: %s\n", local)
			continue
		}
		if err := scpTo(local, "/tmp/kiosk-alerts/"+name); err != nil {
			return err
		}
	}

	gateway := "192.168.178.1"
	script := installRemoteScript(gateway, launch)
	out, err := sshRun(script)
	fmt.Print(out)
	if err != nil {
		return fmt.Errorf("remote install: %w", err)
	}

	fmt.Printf("[kiosk-alert] persist ufw %d/tcp from %s only\n", ufw.AlertPort, ProdIP)
	if err := applyUFW(ProdIP); err != nil {
		return err
	}
	fmt.Println("[ok] planes kiosk installed")
	return nil
}

func applyUFW(prodIP string) error {
	status, err := sshRun("sudo ufw status numbered || true")
	if err != nil {
		return err
	}
	fmt.Print(status)
	deletes, needAdd := ufw.Plan(status, prodIP, ufw.AlertPort)
	cmds, err := ufw.RemoteCommands(deletes, needAdd, prodIP)
	if err != nil {
		return err
	}
	if len(cmds) > 0 {
		out, err := sshRun("set -euo pipefail\n" + strings.Join(cmds, "\n"))
		fmt.Print(out)
		if err != nil {
			return err
		}
	}
	verify, err := sshRun("sudo ufw status numbered || true")
	fmt.Print(verify)
	if err != nil {
		return err
	}
	if strings.Contains(strings.ToLower(verify), "status: inactive") {
		added, _ := sshRun("sudo ufw show added || true")
		fmt.Print(added)
		needle := fmt.Sprintf("from %s to any port %d", prodIP, ufw.AlertPort)
		if !strings.Contains(added, needle) {
			return fmt.Errorf("ufw inactive and %s not recorded", needle)
		}
		return nil
	}
	del, add := ufw.Plan(verify, prodIP, ufw.AlertPort)
	if len(del) > 0 || add {
		return fmt.Errorf("ufw %d is not locked to %s only", ufw.AlertPort, prodIP)
	}
	return nil
}

func Restart() error {
	fmt.Printf("[planes-kiosk] restarting on %s@%s\n", KioskUser, KioskHost)
	out, err := sshRun("/usr/local/sbin/planes-kiosk-restart.sh")
	fmt.Print(out)
	if err != nil {
		return err
	}
	fmt.Println("[ok] planes kiosk restarted")
	return nil
}
