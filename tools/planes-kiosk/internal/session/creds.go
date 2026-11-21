package session

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

func LoadCredentials(p Paths) (user, password string, err error) {
	user = strings.TrimSpace(os.Getenv("DRYL_KIOSK_USER"))
	password = strings.TrimSpace(os.Getenv("DRYL_KIOSK_PASSWORD"))
	if user != "" && password != "" {
		return user, password, nil
	}
	f, err := os.Open(p.CredsFile)
	if err != nil {
		return "", "", fmt.Errorf("missing %s (see credentials.env.example)", p.CredsFile)
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" || strings.HasPrefix(line, "#") || !strings.Contains(line, "=") {
			continue
		}
		key, val, _ := strings.Cut(line, "=")
		val = strings.Trim(strings.TrimSpace(val), `"'`)
		switch strings.TrimSpace(key) {
		case "DRYL_KIOSK_USER":
			user = val
		case "DRYL_KIOSK_PASSWORD":
			password = val
		}
	}
	if user == "" || password == "" {
		return "", "", fmt.Errorf("%s needs DRYL_KIOSK_USER and DRYL_KIOSK_PASSWORD", p.CredsFile)
	}
	return user, password, nil
}
