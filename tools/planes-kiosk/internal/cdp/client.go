package cdp

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

type Target struct {
	Type                 string `json:"type"`
	URL                  string `json:"url"`
	WebSocketDebuggerURL string `json:"webSocketDebuggerUrl"`
}

type Client struct {
	conn *websocket.Conn
	next int
}

func List(url string) ([]Target, error) {
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var targets []Target
	if err := json.NewDecoder(resp.Body).Decode(&targets); err != nil {
		return nil, err
	}
	return targets, nil
}

func FirstPlanesPage(targets []Target) (Target, bool) {
	for _, t := range targets {
		if t.Type == "page" && t.WebSocketDebuggerURL != "" &&
			strings.Contains(t.URL, "planes.dryl.io") {
			return t, true
		}
	}
	return Target{}, false
}

func Dial(wsURL string) (*Client, error) {
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		return nil, err
	}
	return &Client{conn: conn}, nil
}

func (c *Client) Close() error { return c.conn.Close() }

func (c *Client) Call(method string, params map[string]any) (json.RawMessage, error) {
	c.next++
	id := c.next
	payload := map[string]any{"id": id, "method": method}
	if params != nil {
		payload["params"] = params
	}
	if err := c.conn.WriteJSON(payload); err != nil {
		return nil, err
	}
	deadline := time.Now().Add(25 * time.Second)
	for time.Now().Before(deadline) {
		_ = c.conn.SetReadDeadline(deadline)
		var msg struct {
			ID     int             `json:"id"`
			Error  json.RawMessage `json:"error"`
			Result json.RawMessage `json:"result"`
		}
		if err := c.conn.ReadJSON(&msg); err != nil {
			return nil, err
		}
		if msg.ID != id {
			continue
		}
		if len(msg.Error) > 0 && string(msg.Error) != "null" {
			return nil, fmt.Errorf("cdp %s: %s", method, string(msg.Error))
		}
		return msg.Result, nil
	}
	return nil, fmt.Errorf("cdp timeout: %s", method)
}

func (c *Client) Evaluate(expression string) (json.RawMessage, error) {
	raw, err := c.Call("Runtime.evaluate", map[string]any{
		"expression": expression, "awaitPromise": true, "returnByValue": true,
	})
	if err != nil {
		return nil, err
	}
	var env struct {
		Result struct {
			Subtype     string          `json:"subtype"`
			Description string          `json:"description"`
			Value       json.RawMessage `json:"value"`
		} `json:"result"`
	}
	if err := json.Unmarshal(raw, &env); err != nil {
		return nil, err
	}
	if env.Result.Subtype == "error" {
		return nil, fmt.Errorf("%s", env.Result.Description)
	}
	return env.Result.Value, nil
}

func (c *Client) Screenshot(dest string) error {
	raw, err := c.Call("Page.captureScreenshot", map[string]any{
		"format": "png", "fromSurface": true,
	})
	if err != nil {
		return err
	}
	var out struct {
		Data string `json:"data"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return err
	}
	if out.Data == "" {
		return fmt.Errorf("Page.captureScreenshot returned no data")
	}
	bytes, err := base64.StdEncoding.DecodeString(out.Data)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
		return err
	}
	return os.WriteFile(dest, bytes, 0o644)
}
