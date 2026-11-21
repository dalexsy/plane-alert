package session

import (
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"os/exec"
	"strings"
)

func LoginJSON(p Paths, user, password string) (string, error) {
	if err := os.MkdirAll(p.ConfigDir, 0o755); err != nil {
		return "", err
	}
	ClearJar(p)
	body, _ := json.Marshal(map[string]string{"username": user, "password": password})
	cmd := exec.Command(
		"curl", "-sS", "-m", "20", "-i", "-X", "POST", p.LoginURL,
		"-H", "Content-Type: application/json",
		"-H", "User-Agent: "+browserUA,
		"-d", string(body),
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("login-json curl failed: %w: %s", err, trim(string(out), 200))
	}
	raw := string(out)
	headerBlob, bodyText, ok := strings.Cut(raw, "\r\n\r\n")
	if !ok {
		headerBlob, bodyText, _ = strings.Cut(raw, "\n\n")
	}
	setCookie := ""
	for _, line := range strings.Split(headerBlob, "\n") {
		lower := strings.ToLower(line)
		if strings.HasPrefix(lower, "set-cookie:") && strings.Contains(lower, strings.ToLower(CookieName)) {
			setCookie = strings.TrimSpace(line[len("set-cookie:"):])
			break
		}
	}
	var payload map[string]any
	if err := json.Unmarshal([]byte(strings.TrimSpace(bodyText)), &payload); err != nil {
		return "", fmt.Errorf("login-json non-JSON: %s", trim(bodyText, 200))
	}
	if okVal, _ := payload["ok"].(bool); !okVal {
		return "", fmt.Errorf("login-json rejected: %v", payload)
	}
	token := tokenFromSetCookie(setCookie)
	if token == "" {
		return "", fmt.Errorf("login ok but no %s cookie in response", CookieName)
	}
	if err := PersistToken(p, token); err != nil {
		return "", err
	}
	return token, nil
}

func tokenFromSetCookie(header string) string {
	if header == "" {
		return ""
	}
	for _, part := range strings.Split(header, ",") {
		for _, segment := range strings.Split(part, ";") {
			segment = strings.TrimSpace(segment)
			if strings.HasPrefix(strings.ToLower(segment), strings.ToLower(CookieName)+"=") {
				raw := strings.Trim(strings.SplitN(segment, "=", 2)[1], `"`)
				if unq, err := url.QueryUnescape(raw); err == nil {
					return unq
				}
				return raw
			}
		}
	}
	return ""
}

func trim(s string, n int) string {
	s = strings.TrimSpace(s)
	if len(s) <= n {
		return s
	}
	return s[:n]
}
