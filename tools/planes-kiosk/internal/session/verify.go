package session

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"
)

func VerifySessionCookie(p Paths) bool {
	cookie := CookieHeader(p)
	if cookie == "" {
		return false
	}
	cmd := exec.Command(
		"curl", "-sS", "-m", "10", "-o", "/dev/null", "-w", "%{http_code}",
		"-H", "User-Agent: "+browserUA,
		"-H", "X-Dryl-Host: planes.dryl.io",
		"-H", "Cookie: "+cookie,
		p.VerifyURL,
	)
	out, err := cmd.Output()
	if err != nil {
		return false
	}
	return strings.TrimSpace(string(out)) == "200"
}

func localAuthReachable() bool {
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get("http://127.0.0.1:8790/health")
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == 200
}

func FetchPlanesHTML(p Paths, requireAuth bool) (bool, string) {
	if requireAuth {
		if _, err := os.Stat(p.JarFile); err != nil {
			return false, ""
		}
		if !VerifySessionCookie(p) {
			return false, "auth-verify-failed"
		}
	}
	if requireAuth && localAuthReachable() {
		return fetchLocalNginx(p)
	}
	return fetchPublicPlanes(p, requireAuth)
}

func fetchLocalNginx(p Paths) (bool, string) {
	cookie := CookieHeader(p)
	if cookie == "" {
		return false, "missing-cookie"
	}
	req, err := http.NewRequest(http.MethodGet, "http://127.0.0.1:8080/", nil)
	if err != nil {
		return false, "local-nginx-error"
	}
	req.Host = "planes.dryl.io"
	req.Header.Set("Cookie", cookie)
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return false, "local-nginx-error"
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 120_000))
	text := string(body)
	if resp.StatusCode != 200 {
		return false, "nginx-non-200"
	}
	if !strings.Contains(text, "<app-root") {
		return false, "missing-app-root"
	}
	if strings.Contains(text, "__DRYL_APP_ID__") && !strings.Contains(text, "planes") {
		return false, "wrong-app-id"
	}
	return true, "local-nginx"
}

func fetchPublicPlanes(p Paths, requireAuth bool) (bool, string) {
	cookie := CookieHeader(p)
	if requireAuth && cookie == "" {
		return false, "missing-cookie"
	}
	bodyFile := "/tmp/planes-kiosk-session-body.html"
	args := []string{
		"-sS", "-m", "15", "-L", "-o", bodyFile, "-w", "%{http_code} %{url_effective}",
		"-H", "User-Agent: " + browserUA,
	}
	if cookie != "" {
		args = append(args, "-H", "Cookie: "+cookie)
	}
	args = append(args, p.PlanesURL)
	cmd := exec.Command("curl", args...)
	out, err := cmd.Output()
	if err != nil {
		return false, "curl-error"
	}
	meta := strings.SplitN(strings.TrimSpace(string(out)), " ", 2)
	code, final := "000", p.PlanesURL
	if len(meta) > 0 {
		code = meta[0]
	}
	if len(meta) > 1 {
		final = meta[1]
	}
	if code != "200" {
		return false, "http-" + code
	}
	if strings.Contains(final, "login") {
		return false, final
	}
	raw, err := os.ReadFile(bodyFile)
	if err != nil {
		return false, "body-read-error"
	}
	body := string(raw)
	if len(body) > 120_000 {
		body = body[:120_000]
	}
	if !strings.Contains(body, "<app-root") {
		return false, "missing-app-root"
	}
	if !strings.Contains(body, "main-") && !strings.Contains(body, "scripts") {
		return false, "missing-bundle"
	}
	return true, final
}

func Bootstrap(p Paths) error {
	if token := TokenFromJar(p); token != "" {
		_ = ImportCookie(p, token)
	}
	if ok, reason := FetchPlanesHTML(p, true); ok {
		fmt.Println("[ok] planes session already valid")
		return nil
	} else if reason != "" {
		fmt.Printf("[info] cached session unusable (%s) — logging in again\n", reason)
	}
	ClearJar(p)
	user, pass, err := LoadCredentials(p)
	if err != nil {
		return err
	}
	token, err := LoginJSON(p, user, pass)
	if err != nil {
		return err
	}
	if err := ImportCookie(p, token); err != nil {
		return err
	}
	ok, reason := FetchPlanesHTML(p, true)
	if ok {
		fmt.Println("[ok] dryl_session imported — planes reachable")
		return nil
	}
	if reason == "" {
		reason = "unknown"
	}
	return fmt.Errorf("cookie imported but planes verify still failed (%s)", reason)
}

func VerifyOnly(p Paths) error {
	ok, reason := FetchPlanesHTML(p, false)
	if !ok && reason != "" {
		fmt.Fprintf(os.Stderr, "[verify-only] fail: %s\n", reason)
	}
	if !ok {
		return fmt.Errorf("verify failed")
	}
	return nil
}
