package antenna

import (
	"context"
	"dryl-planes/internal/diskstore"
	"encoding/json"
	"errors"

	"net/http"
	"net/url"
	"sync"
	"time"
)

type Engine struct {
	mu            sync.Mutex
	pollMu        sync.Mutex
	startOnce     sync.Once
	path, feed    string
	state         Object
	rows          map[string]Object
	raw           []byte
	diskRaw       []byte
	lastPersist   time.Time
	poll          time.Duration
	client        *http.Client
	done          chan struct{}
	dirty         bool
	lastError     string
	shutdownError error
}

func New(path, override string, poll time.Duration) (*Engine, error) {
	initial, err := diskstore.Bytes(path)
	if err != nil {
		return nil, err
	}
	var state Object
	err = json.Unmarshal(initial, &state)
	if err != nil {
		return nil, err
	}
	if state == nil {
		return nil, errors.New("invalid antenna store")
	}
	var rows map[string]Object
	if json.Unmarshal(state["sightings"], &rows) != nil || rows == nil {
		return nil, errors.New("invalid saved antenna rows")
	}
	if err := validateRows(rows); err != nil {
		return nil, err
	}
	feed := override
	if feed == "" {
		feed = text(state, "feedUrl")
	}
	u, err := url.Parse(feed)
	if err != nil || u.User != nil || u.RawQuery != "" || u.Fragment != "" || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return nil, errors.New("existing configured antenna feed required")
	}
	if poll < 5*time.Second {
		poll = 12 * time.Second
	}
	if poll > 60*time.Second {
		poll = 60 * time.Second
	}
	e := &Engine{path: path, feed: feed, state: state, rows: rows, poll: poll, lastPersist: time.Now(), done: make(chan struct{}), client: &http.Client{Timeout: 8 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return errors.New("receiver redirect refused") }}}
	e.diskRaw = initial
	if err = e.publish(); err != nil {
		return nil, err
	}
	return e, nil
}
func (e *Engine) Polling() bool { return true }
func (e *Engine) PollMs() int   { return int(e.poll / time.Millisecond) }
func (e *Engine) Snapshot() (Object, error) {
	e.mu.Lock()
	defer e.mu.Unlock()
	var v Object
	err := json.Unmarshal(e.raw, &v)
	if e.lastError != "" {
		set(v, "lastPollOk", false)
		set(v, "lastPollError", e.lastError)
	}
	return v, err
}
func (e *Engine) publish() error {
	set(e.state, "sightings", e.rows)
	raw, err := json.Marshal(e.state)
	if err != nil {
		return err
	}
	if len(raw) > 16<<20 {
		return errors.New("antenna store capacity reached")
	}
	e.raw = raw
	return nil
}
func (e *Engine) Start(ctx context.Context) {
	e.startOnce.Do(func() {
		go func() {
			defer func() { e.shutdownError = e.Flush(); close(e.done) }()
			ticker := time.NewTicker(e.poll)
			defer ticker.Stop()
			for {
				if ctx.Err() != nil {
					return
				}
				_ = e.Poll(ctx)
				select {
				case <-ctx.Done():
					return
				case <-ticker.C:
				}
			}
		}()
	})
}
func (e *Engine) Wait() error { <-e.done; return e.shutdownError }
func (e *Engine) Flush() error {
	e.mu.Lock()
	defer e.mu.Unlock()
	if !e.dirty {
		return nil
	}
	if err := e.persist(); err != nil {
		return err
	}
	e.diskRaw = e.raw
	e.lastPersist = time.Now()
	e.dirty = false
	return nil
}
