package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/dalexsy/plane-alert/tools/planes-kiosk/internal/install"
)

func main() {
	repo, err := install.FindRepoRoot()
	if err != nil {
		fmt.Fprintf(os.Stderr, "[fail] %v\n", err)
		os.Exit(1)
	}
	deploy := filepath.Join(repo, "..", "directory", "scripts", "pi-deploy-dryl-site.py")
	if _, err := os.Stat(deploy); err != nil {
		fmt.Fprintf(os.Stderr, "[fail] missing deploy script: %s\n", deploy)
		os.Exit(1)
	}
	python := "python"
	if p, err := exec.LookPath("python3"); err == nil {
		python = p
	} else if p, err := exec.LookPath("python"); err == nil {
		python = p
	}
	cmd := exec.Command(python, deploy, "planes")
	cmd.Dir = repo
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Env = append(os.Environ(), "DRYL_AUTHORIZED_DEPLOY=1")
	if err := cmd.Run(); err != nil {
		if ee, ok := err.(*exec.ExitError); ok {
			os.Exit(ee.ExitCode())
		}
		fmt.Fprintf(os.Stderr, "[fail] %v\n", err)
		os.Exit(1)
	}
}
