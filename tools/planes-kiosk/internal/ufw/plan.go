package ufw

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

const (
	AlertPort   = 8796
	KnownProdIP = "192.168.178.79"
	Comment     = "planes-kiosk-alert from dryl-prod"
)

var (
	numbered = regexp.MustCompile(`^\[\s*(\d+)\s*\]\s*(.+)$`)
	wideSrc  = regexp.MustCompile(`(?i)\bAnywhere\b|0\.0\.0\.0/0|::/0`)
	ipv4     = regexp.MustCompile(`^(?:\d{1,3}\.){3}\d{1,3}$`)
)

func IsIPv4(value string) bool {
	if !ipv4.MatchString(value) {
		return false
	}
	for _, part := range strings.Split(value, ".") {
		n, _ := strconv.Atoi(part)
		if n < 0 || n > 255 {
			return false
		}
	}
	return true
}

func UsableProdIP(host string) bool {
	if !IsIPv4(host) {
		return false
	}
	if host == "0.0.0.0" || host == "127.0.0.1" {
		return false
	}
	return !strings.HasSuffix(host, ".74")
}

func ParseNumbered(status string) []struct {
	Num  int
	Body string
} {
	var rules []struct {
		Num  int
		Body string
	}
	for _, raw := range strings.Split(status, "\n") {
		m := numbered.FindStringSubmatch(strings.TrimSpace(raw))
		if m == nil {
			continue
		}
		n, _ := strconv.Atoi(m[1])
		rules = append(rules, struct {
			Num  int
			Body string
		}{n, m[2]})
	}
	return rules
}

func isAlertPortRule(body string, port int) bool {
	return regexp.MustCompile(fmt.Sprintf(`^%d(/tcp)?\b`, port)).MatchString(strings.TrimSpace(body))
}

func IsWideSource(body string) bool { return wideSrc.MatchString(body) }

func isProdSource(body, prodIP string) bool {
	if IsWideSource(body) {
		return false
	}
	idx := strings.Index(body, prodIP)
	for idx >= 0 {
		beforeOK := idx == 0 || body[idx-1] < '0' || body[idx-1] > '9'
		after := idx + len(prodIP)
		afterOK := after >= len(body) || body[after] < '0' || body[after] > '9'
		if beforeOK && afterOK {
			return true
		}
		next := strings.Index(body[idx+1:], prodIP)
		if next < 0 {
			break
		}
		idx += 1 + next
	}
	return false
}

func Plan(status, prodIP string, port int) (deletes []int, needAdd bool) {
	haveProd := false
	for _, rule := range ParseNumbered(status) {
		if !isAlertPortRule(rule.Body, port) {
			continue
		}
		if !strings.Contains(strings.ToUpper(rule.Body), "ALLOW") {
			continue
		}
		if isProdSource(rule.Body, prodIP) {
			haveProd = true
			continue
		}
		deletes = append(deletes, rule.Num)
	}
	// high → low
	for i := 0; i < len(deletes); i++ {
		for j := i + 1; j < len(deletes); j++ {
			if deletes[j] > deletes[i] {
				deletes[i], deletes[j] = deletes[j], deletes[i]
			}
		}
	}
	return deletes, !haveProd
}

func AllowCmd(prodIP string, port int) (string, error) {
	if !UsableProdIP(prodIP) {
		return "", fmt.Errorf("refusing non-prod ufw source %q", prodIP)
	}
	return fmt.Sprintf(
		"ufw allow from %s to any port %d proto tcp comment '%s'",
		prodIP, port, Comment,
	), nil
}

func RemoteCommands(deletes []int, needAdd bool, prodIP string) ([]string, error) {
	cmds := make([]string, 0, len(deletes)+1)
	for _, num := range deletes {
		cmds = append(cmds, fmt.Sprintf("printf 'y\\n' | sudo ufw delete %d", num))
	}
	if needAdd {
		allow, err := AllowCmd(prodIP, AlertPort)
		if err != nil {
			return nil, err
		}
		cmds = append(cmds, "sudo "+allow)
	}
	return cmds, nil
}
