package antenna

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"
)

func (e *Engine) Poll(ctx context.Context) error {
	e.pollMu.Lock()
	defer e.pollMu.Unlock()
	request, err := http.NewRequestWithContext(ctx, "GET", e.feed, nil)
	if err != nil {
		return err
	}
	response, err := e.client.Do(request)
	var data struct {
		AC       []Object `json:"ac"`
		Aircraft []Object `json:"aircraft"`
		Now      float64  `json:"now"`
	}
	if err == nil {
		defer response.Body.Close()
		if response.StatusCode != 200 {
			err = errors.New("receiver HTTP failure")
		} else {
			raw, readErr := io.ReadAll(io.LimitReader(response.Body, (2<<20)+1))
			if readErr != nil || len(raw) > 2<<20 {
				err = errors.New("receiver response unavailable/oversized")
			} else if json.Unmarshal(raw, &data) != nil || (data.AC == nil && data.Aircraft == nil) {
				err = errors.New("invalid receiver payload")
			}
		}
	}
	now := time.Now().UnixMilli()
	if err == nil && data.Now > 1e9 {
		at := int64(data.Now * 1000)
		if at < now-120000 || at > now+300000 {
			err = errors.New("receiver timestamp is stale or in future")
		} else {
			now = at
		}
	}
	e.mu.Lock()
	defer e.mu.Unlock()
	if ctx.Err() != nil {
		return ctx.Err()
	}
	set(e.state, "feedUrl", e.feed)
	set(e.state, "lastPollAt", time.Now().UnixMilli())
	if err != nil {
		e.lastError = "Antenna receiver unavailable or invalid"
		set(e.state, "lastPollOk", false)
		set(e.state, "lastPollError", "Antenna receiver unavailable or invalid")
		_ = e.publish()
		return err
	}
	aircraft := data.Aircraft
	if len(data.AC) > len(aircraft) {
		aircraft = data.AC
	}
	if len(aircraft) > 2000 {
		e.lastError = "Antenna receiver aircraft limit exceeded"
		return errors.New("receiver aircraft limit")
	}
	oldRows, oldState := e.rows, e.state
	next := map[string]Object{}
	for k, v := range e.rows {
		next[k] = v
	}
	state := Object{}
	for k, v := range e.state {
		state[k] = v
	}
	e.rows, e.state = next, state
	changed := false
	for _, ac := range aircraft {
		hex := stringsLowerHex(ac)
		if row := upsert(e.rows[hex], ac, now); row != nil {
			e.rows[hex] = row
			changed = true
		}
	}
	set(e.state, "lastPollOk", true)
	set(e.state, "lastPollError", nil)
	set(e.state, "lastAircraft", len(aircraft))
	set(e.state, "updatedAt", now)
	if err = e.publish(); err != nil {
		e.rows, e.state = oldRows, oldState
		e.lastError = "Antenna store capacity reached; existing history retained"
		return err
	}
	e.dirty = e.dirty || changed
	e.lastError = ""
	if e.dirty && time.Since(e.lastPersist) >= time.Minute {
		if err = e.persist(); err != nil {
			set(e.state, "lastPollOk", false)
			e.lastError = "Antenna state persistence failed"
			set(e.state, "lastPollError", "Antenna state persistence failed")
			_ = e.publish()
			return err
		}
		e.diskRaw = e.raw
		e.lastPersist = time.Now()
		e.dirty = false
	}
	return nil
}
