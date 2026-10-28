package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

type buildInfoPayload struct {
	Service     string `json:"service"`
	Version     string `json:"version"`
	GitSha      string `json:"gitSha"`
	GitShaShort string `json:"gitShaShort"`
	BuiltAt     string `json:"builtAt"`
	Branch      string `json:"branch"`
}

func writeBuildInfo(repo string) error {
	functionsDir := filepath.Join(repo, "functions")
	version := "0.0.0"
	pkgPath := filepath.Join(repo, "package.json")
	if raw, err := os.ReadFile(pkgPath); err == nil {
		var pkg struct {
			Version string `json:"version"`
		}
		if json.Unmarshal(raw, &pkg) == nil && pkg.Version != "" {
			version = pkg.Version
		}
	}
	sha, err := gitOutput(repo, "rev-parse", "HEAD")
	if err != nil {
		return err
	}
	branch, err := gitOutput(repo, "rev-parse", "--abbrev-ref", "HEAD")
	if err != nil {
		return err
	}
	payload := buildInfoPayload{
		Service:     "planes-api",
		Version:     version,
		GitSha:      sha,
		GitShaShort: sha[:12],
		BuiltAt:     time.Now().UTC().Format(time.RFC3339Nano),
		Branch:      branch,
	}
	for _, out := range []string{
		filepath.Join(functionsDir, "build-info.json"),
		filepath.Join(functionsDir, "lib", "build-info.json"),
	} {
		if err := writeJSONFile(out, payload); err != nil {
			return err
		}
	}
	fmt.Printf("[ok] planes-api build-info %s @ %s\n", payload.Version, payload.GitShaShort)
	return nil
}

func gitOutput(repo string, args ...string) (string, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = repo
	out, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("git %s: %w", strings.Join(args, " "), err)
	}
	return strings.TrimSpace(string(out)), nil
}

func writeJSONFile(path string, payload buildInfoPayload) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return err
	}
	raw = append(raw, '\n')
	return os.WriteFile(path, raw, 0o644)
}
