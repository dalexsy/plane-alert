package alert

import (
	"crypto/subtle"
	"encoding/json"
	"os"
	"os/exec"
	"strings"
	"time"
)

func VariantFromBody(body map[string]any) string {
	raw, _ := body["variant"].(string)
	raw = strings.ToLower(strings.TrimSpace(raw))
	if raw == "hercules" || raw == "a400" || raw == "default" {
		return raw
	}
	model, _ := body["model"].(string)
	model = strings.ToLower(model)
	if strings.Contains(model, "hercules") {
		return "hercules"
	}
	compact := strings.ReplaceAll(model, " ", "")
	if strings.Contains(compact, "a400") || strings.Contains(model, "a-400") {
		return "a400"
	}
	return "default"
}

func SecretsMatch(received, expected string) bool {
	if received == "" || expected == "" {
		return false
	}
	a := []byte(received)
	b := []byte(expected)
	if len(a) != len(b) {
		_ = subtle.ConstantTimeCompare(b, b)
		return false
	}
	return subtle.ConstantTimeCompare(a, b) == 1
}

func ReadToken(headers map[string]string) string {
	lower := map[string]string{}
	for k, v := range headers {
		lower[strings.ToLower(k)] = v
	}
	auth := strings.TrimSpace(lower["authorization"])
	if strings.HasPrefix(strings.ToLower(auth), "bearer ") {
		return strings.TrimSpace(auth[7:])
	}
	return strings.TrimSpace(lower["x-planes-kiosk-play-token"])
}

func PlayVariant(playScript, variant string) (stdout, stderr string, code int, err error) {
	env := os.Environ()
	hasRuntime := false
	for _, e := range env {
		if strings.HasPrefix(e, "XDG_RUNTIME_DIR=") {
			hasRuntime = true
			break
		}
	}
	if !hasRuntime {
		env = append(env, "XDG_RUNTIME_DIR=/run/user/1000")
	}
	cmd := exec.Command(playScript, variant)
	cmd.Env = env
	var outBuf, errBuf strings.Builder
	cmd.Stdout = &outBuf
	cmd.Stderr = &errBuf
	done := make(chan error, 1)
	go func() { done <- cmd.Run() }()
	select {
	case err = <-done:
		code = 0
		if cmd.ProcessState != nil {
			code = cmd.ProcessState.ExitCode()
		}
		if err != nil && code == 0 {
			code = 1
		}
		return outBuf.String(), errBuf.String(), code, nil
	case <-time.After(40 * time.Second):
		_ = cmd.Process.Kill()
		return outBuf.String(), errBuf.String(), -1, errTimeout{}
	}
}

type errTimeout struct{}

func (errTimeout) Error() string { return "play timeout" }

func DecodeBody(raw []byte) (map[string]any, error) {
	if len(raw) == 0 {
		raw = []byte("{}")
	}
	var body map[string]any
	if err := json.Unmarshal(raw, &body); err != nil {
		return nil, err
	}
	return body, nil
}
