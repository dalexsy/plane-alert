package push

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

type entry struct {
	Devices []string
	At      time.Time
}
type Client struct {
	Token       string
	HTTP        *http.Client
	mu          sync.Mutex
	cache       map[string]entry
	ValidateURL string
}

func (c *Client) Devices(ctx context.Context, key string) ([]string, error) {
	c.mu.Lock()
	v, ok := c.cache[key]
	c.mu.Unlock()
	if ok && time.Since(v.At) < 5*time.Minute {
		return v.Devices, nil
	}
	if c.Token == "" {
		return nil, errors.New("Pushover configuration unavailable")
	}
	endpoint := c.ValidateURL
	if endpoint == "" {
		endpoint = "https://api.pushover.net/1/users/validate.json"
	}
	req, err := http.NewRequestWithContext(ctx, "POST", endpoint, strings.NewReader(url.Values{"token": {c.Token}, "user": {key}}.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	client := c.HTTP
	if client == nil {
		client = &http.Client{Timeout: 8 * time.Second}
	}
	res, err := client.Do(req)
	if err != nil {
		return nil, errors.New("Device validation unavailable")
	}
	defer res.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(res.Body, (256<<10)+1))
	if err != nil || len(raw) > 256<<10 || res.StatusCode != 200 {
		return nil, errors.New("Device validation failed")
	}
	var data struct {
		Status  int      `json:"status"`
		Devices []string `json:"devices"`
	}
	if json.Unmarshal(raw, &data) != nil || data.Status != 1 {
		return nil, errors.New("Device validation rejected")
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.cache == nil {
		c.cache = map[string]entry{}
	}
	if len(c.cache) >= 16 {
		oldest := ""
		var at time.Time
		for k, v := range c.cache {
			if oldest == "" || v.At.Before(at) {
				oldest, at = k, v.At
			}
		}
		delete(c.cache, oldest)
	}
	c.cache[key] = entry{Devices: data.Devices, At: time.Now()}
	return data.Devices, nil
}
