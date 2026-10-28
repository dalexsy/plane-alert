// planes-api-build-gate replaces removed fleet MJS deploy gates (see ticket
// spec:obj.ticket.dev.13ed1334078841cea4210205cd014327). Orchestration lives in
// Go; behavioral checks run via compiled functions npm test (node:test).
package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

func main() {
	repo, err := repoRoot()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	steps := []struct {
		label string
		dir   string
		cmd   []string
	}{
		{"shared package", filepath.Join(repo, "shared"), []string{"npm", "run", "build"}},
		{
			"prepare functions shared-package",
			repo,
			[]string{"node", filepath.Join(repo, "scripts", "prepare-functions-shared.js")},
		},
		{"functions TypeScript", filepath.Join(repo, "functions"), []string{"npm", "run", "build"}},
	}
	for _, step := range steps {
		fmt.Printf("[gate] %s\n", step.label)
		c := exec.Command(step.cmd[0], step.cmd[1:]...)
		c.Dir = step.dir
		c.Stdout = os.Stdout
		c.Stderr = os.Stderr
		if err := c.Run(); err != nil {
			fmt.Fprintf(os.Stderr, "[fail] %s\n", step.label)
			os.Exit(1)
		}
	}
	fmt.Println("[gate] planes-api build-info")
	if err := writeBuildInfo(repo); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	steps = []struct {
		label string
		dir   string
		cmd   []string
	}{
		{
			"planes-api .env preserve",
			repo,
			[]string{"python", filepath.Join(repo, "scripts", "planes_api_env.py")},
		},
		{"functions gates (node:test)", filepath.Join(repo, "functions"), []string{"npm", "run", "test:gates"}},
	}
	for _, step := range steps {
		fmt.Printf("[gate] %s\n", step.label)
		c := exec.Command(step.cmd[0], step.cmd[1:]...)
		c.Dir = step.dir
		c.Stdout = os.Stdout
		c.Stderr = os.Stderr
		if err := c.Run(); err != nil {
			fmt.Fprintf(os.Stderr, "[fail] %s\n", step.label)
			os.Exit(1)
		}
	}
	fmt.Println("[ok] planes-api build gates")
}

func repoRoot() (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}
	for {
		if _, err := os.Stat(filepath.Join(dir, "functions", "package.json")); err == nil {
			if _, err := os.Stat(filepath.Join(dir, "shared", "package.json")); err == nil {
				return dir, nil
			}
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", fmt.Errorf("plane-alert repo root not found from %s", dir)
		}
		dir = parent
	}
}
