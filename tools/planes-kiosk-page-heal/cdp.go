package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

type cdpTarget struct {
	Type                 string `json:"type"`
	URL                  string `json:"url"`
	WebSocketDebuggerURL string `json:"webSocketDebuggerUrl"`
}

type cdpClient struct {
	conn *websocket.Conn
	next int
}

func listCDPTargets() ([]cdpTarget, error) {
	client := &http.Client{Timeout: 4 * time.Second}
	resp, err := client.Get(cdpListURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var targets []cdpTarget
	if err := json.NewDecoder(resp.Body).Decode(&targets); err != nil {
		return nil, err
	}
	return targets, nil
}

func firstPageTarget(targets []cdpTarget) (cdpTarget, bool) {
	for _, t := range targets {
		if t.Type == "page" && t.WebSocketDebuggerURL != "" {
			return t, true
		}
	}
	return cdpTarget{}, false
}

func dialCDP(wsURL string) (*cdpClient, error) {
	dialer := websocket.Dialer{HandshakeTimeout: 15 * time.Second}
	conn, _, err := dialer.Dial(wsURL, nil)
	if err != nil {
		return nil, err
	}
	return &cdpClient{conn: conn}, nil
}

func (c *cdpClient) Close() error {
	return c.conn.Close()
}

func (c *cdpClient) call(method string, params map[string]any) (json.RawMessage, error) {
	c.next++
	id := c.next
	payload := map[string]any{"id": id, "method": method}
	if params != nil {
		payload["params"] = params
	}
	if err := c.conn.WriteJSON(payload); err != nil {
		return nil, err
	}
	deadline := time.Now().Add(15 * time.Second)
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

func (c *cdpClient) evaluate(expression string) (pageState, error) {
	raw, err := c.call("Runtime.evaluate", map[string]any{
		"expression":    expression,
		"awaitPromise":  true,
		"returnByValue": true,
	})
	if err != nil {
		return pageState{}, err
	}
	var envelope struct {
		Result struct {
			Subtype     string          `json:"subtype"`
			Description string          `json:"description"`
			Value       json.RawMessage `json:"value"`
		} `json:"result"`
	}
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return pageState{}, err
	}
	if envelope.Result.Subtype == "error" {
		return pageState{}, fmt.Errorf("%s", envelope.Result.Description)
	}
	var state pageState
	if err := json.Unmarshal(envelope.Result.Value, &state); err != nil {
		return pageState{}, err
	}
	return state, nil
}

func (c *cdpClient) pageState() (pageState, error) {
	return c.evaluate(pageStateJS)
}

func (c *cdpClient) softReload(state pageState) (pageState, error) {
	if _, err := c.call("Page.enable", nil); err != nil {
		return pageState{}, err
	}
	href := strings.ToLower(state.Href)
	if strings.Contains(href, "planes.dryl.io") {
		if _, err := c.call("Page.reload", map[string]any{"ignoreCache": true}); err != nil {
			return pageState{}, err
		}
	} else if _, err := c.call("Page.navigate", map[string]any{"url": planesURL}); err != nil {
		return pageState{}, err
	}
	time.Sleep(reloadWait)
	return c.pageState()
}
