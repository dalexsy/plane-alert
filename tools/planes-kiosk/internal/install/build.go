package install

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

type builtBins struct {
	Session    string
	AlertListen string
	PageHeal   string
}

func buildLinuxArm64(repoRoot string) (builtBins, error) {
	dist := filepath.Join(repoRoot, "tools", "planes-kiosk", "dist")
	if err := os.MkdirAll(dist, 0o755); err != nil {
		return builtBins{}, err
	}
	env := append(os.Environ(),
		"GOOS=linux", "GOARCH=arm64", "CGO_ENABLED=0", "GOARM64=v8.0",
	)
	out := builtBins{
		Session:     filepath.Join(dist, "planes-kiosk-session-linux-arm64"),
		AlertListen: filepath.Join(dist, "planes-kiosk-alert-listen-linux-arm64"),
		PageHeal:    filepath.Join(dist, "planes-kiosk-page-heal-linux-arm64"),
	}
	builds := []struct {
		dir string
		pkg string
		out string
	}{
		{filepath.Join(repoRoot, "tools", "planes-kiosk"), "./cmd/session", out.Session},
		{filepath.Join(repoRoot, "tools", "planes-kiosk"), "./cmd/alert-listen", out.AlertListen},
		{filepath.Join(repoRoot, "tools", "planes-kiosk-page-heal"), ".", out.PageHeal},
	}
	for _, b := range builds {
		cmd := exec.Command("go", "build", "-o", b.out, b.pkg)
		cmd.Dir = b.dir
		cmd.Env = env
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		if err := cmd.Run(); err != nil {
			return builtBins{}, fmt.Errorf("go build %s: %w", b.pkg, err)
		}
	}
	return out, nil
}
