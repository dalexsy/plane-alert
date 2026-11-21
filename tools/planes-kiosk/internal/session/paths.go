package session

import (
	"os"
	"path/filepath"
)

const (
	CookieName         = "dryl_session"
	DefaultLoginURL    = "https://admin.dryl.io/api/auth/login-json"
	DefaultVerifyURL   = "https://admin.dryl.io/api/auth/verify"
	DefaultPlanesURL   = "https://planes.dryl.io/"
	chromiumEpochOffset = 11644473600
	browserUA = "Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 " +
		"(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

type Paths struct {
	ConfigDir string
	Profile   string
	CredsFile string
	JarFile   string
	LoginURL  string
	VerifyURL string
	PlanesURL string
}

func DefaultPaths() Paths {
	config := envOr("PLANES_KIOSK_CONFIG", "/home/pi/.config/planes-kiosk")
	return Paths{
		ConfigDir: config,
		Profile:   envOr("PLANES_KIOSK_PROFILE", "/home/pi/.config/planes-kiosk-chromium"),
		CredsFile: filepath.Join(config, "credentials.env"),
		JarFile:   filepath.Join(config, "session.jar"),
		LoginURL:  envOr("DRYL_AUTH_LOGIN_JSON", DefaultLoginURL),
		VerifyURL: envOr("DRYL_AUTH_VERIFY_URL", DefaultVerifyURL),
		PlanesURL: envOr("PLANES_KIOSK_URL", DefaultPlanesURL),
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
