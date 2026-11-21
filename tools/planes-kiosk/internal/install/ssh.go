package install

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"strings"
)

const (
	KioskHost = "192.168.178.74"
	KioskUser = "pi"
	ProdIP    = "192.168.178.79"
)

func sshRun(script string) (string, error) {
	cmd := exec.Command(
		"ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=15",
		KioskUser+"@"+KioskHost, "bash", "-s",
	)
	cmd.Stdin = strings.NewReader(script)
	var out bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &out
	err := cmd.Run()
	return out.String(), err
}

func scpTo(local, remoteTmp string) error {
	dest := fmt.Sprintf("%s@%s:%s", KioskUser, KioskHost, remoteTmp)
	cmd := exec.Command("scp", "-o", "BatchMode=yes", "-o", "ConnectTimeout=15", local, dest)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}
