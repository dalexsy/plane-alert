package alert

import (
	"bufio"
	"net"
	"os"
	"strconv"
	"strings"
)

const DefaultPort = 8796

func LoadEnvFile(path string) map[string]string {
	out := map[string]string{}
	f, err := os.Open(path)
	if err != nil {
		return out
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" || strings.HasPrefix(line, "#") || !strings.Contains(line, "=") {
			continue
		}
		key, val, _ := strings.Cut(line, "=")
		out[strings.TrimSpace(key)] = strings.Trim(strings.TrimSpace(val), `"'`)
	}
	return out
}

func mergedEnv(path string) map[string]string {
	m := LoadEnvFile(path)
	for _, e := range os.Environ() {
		key, val, ok := strings.Cut(e, "=")
		if ok {
			m[key] = val
		}
	}
	return m
}

func PlayToken(envFile string) string {
	return strings.TrimSpace(mergedEnv(envFile)["PLANES_KIOSK_PLAY_TOKEN"])
}

func ListenPort(envFile string) int {
	raw := strings.TrimSpace(mergedEnv(envFile)["PLANES_KIOSK_ALERT_LISTEN_PORT"])
	if raw == "" {
		return DefaultPort
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n < 1 || n > 65535 {
		return DefaultPort
	}
	return n
}

func IsLANIP(ip string) bool {
	addr := net.ParseIP(ip)
	if addr == nil {
		return false
	}
	return addr.IsLoopback() || addr.IsPrivate() || addr.IsLinkLocalUnicast()
}
