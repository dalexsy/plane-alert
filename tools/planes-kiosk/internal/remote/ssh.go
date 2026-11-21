package remote

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
)

func SSH(script string) (string, error) {
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

func SCPTo(local, remoteTmp string) error {
	dest := fmt.Sprintf("%s@%s:%s", KioskUser, KioskHost, remoteTmp)
	cmd := exec.Command("scp", "-o", "BatchMode=yes", "-o", "ConnectTimeout=15", local, dest)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

func SCPFrom(remotePath, local string) error {
	src := fmt.Sprintf("%s@%s:%s", KioskUser, KioskHost, remotePath)
	cmd := exec.Command("scp", "-o", "BatchMode=yes", "-o", "ConnectTimeout=15", src, local)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

func BuildArm64(moduleDir, pkg, outPath string) error {
	cmd := exec.Command("go", "build", "-o", outPath, pkg)
	cmd.Dir = moduleDir
	cmd.Env = append(os.Environ(),
		"GOOS=linux", "GOARCH=arm64", "CGO_ENABLED=0", "GOARM64=v8.0",
	)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}
