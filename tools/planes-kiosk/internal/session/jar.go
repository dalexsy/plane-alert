package session

import (
	"fmt"
	"net/url"
	"os"
	"strings"
	"time"
)

func ClearJar(p Paths) {
	_ = os.Remove(p.JarFile)
}

func PersistToken(p Paths, token string) error {
	if err := os.MkdirAll(p.ConfigDir, 0o755); err != nil {
		return err
	}
	expires := time.Now().Add(30 * 24 * time.Hour).Unix()
	// Netscape cookie file (MozillaCookieJar-compatible).
	body := fmt.Sprintf(
		"# Netscape HTTP Cookie File\n"+
			"# HttpOnly_.dryl.io\tTRUE\t/\tTRUE\t%d\t%s\t%s\n"+
			".dryl.io\tTRUE\t/\tTRUE\t%d\t%s\t%s\n",
		expires, CookieName, token, expires, CookieName, token,
	)
	return os.WriteFile(p.JarFile, []byte(body), 0o600)
}

func TokenFromJar(p Paths) string {
	data, err := os.ReadFile(p.JarFile)
	if err != nil {
		return ""
	}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		// Optional HttpOnly_ prefix line from some jar writers.
		line = strings.TrimPrefix(line, "#HttpOnly_")
		fields := strings.Split(line, "\t")
		if len(fields) < 7 {
			continue
		}
		if fields[5] == CookieName {
			raw := fields[6]
			if unq, err := url.QueryUnescape(raw); err == nil {
				return unq
			}
			return raw
		}
	}
	return ""
}

func CookieHeader(p Paths) string {
	token := TokenFromJar(p)
	if token == "" {
		return ""
	}
	return CookieName + "=" + token
}
