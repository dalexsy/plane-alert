package session

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

func chromeTime() int64 {
	return (time.Now().Unix() + chromiumEpochOffset) * 1_000_000
}

func ImportCookie(p Paths, token string) error {
	if err := os.MkdirAll(filepath.Join(p.Profile, "Default"), 0o755); err != nil {
		return err
	}
	dbPath := filepath.Join(p.Profile, "Default", "Cookies")
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return err
	}
	defer db.Close()

	created := chromeTime()
	expires := created + 180*24*3600*1_000_000
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS cookies (
		creation_utc INTEGER NOT NULL,
		host_key TEXT NOT NULL,
		name TEXT NOT NULL,
		value TEXT NOT NULL,
		path TEXT NOT NULL,
		expires_utc INTEGER NOT NULL,
		is_secure INTEGER NOT NULL,
		is_httponly INTEGER NOT NULL,
		last_access_utc INTEGER NOT NULL,
		has_expires INTEGER NOT NULL DEFAULT 1,
		is_persistent INTEGER NOT NULL DEFAULT 1,
		priority INTEGER NOT NULL DEFAULT 1,
		encrypted_value BLOB NOT NULL DEFAULT '',
		samesite INTEGER NOT NULL DEFAULT 1
	)`); err != nil {
		return err
	}

	rows, err := db.Query(`PRAGMA table_info(cookies)`)
	if err != nil {
		return err
	}
	cols := map[string]bool{}
	for rows.Next() {
		var cid int
		var name, ctype string
		var notnull, pk int
		var dflt any
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			rows.Close()
			return err
		}
		cols[name] = true
	}
	rows.Close()

	vals := map[string]any{
		"creation_utc": created, "host_key": ".dryl.io", "name": CookieName,
		"value": token, "path": "/", "expires_utc": expires,
		"is_secure": 1, "is_httponly": 1, "last_access_utc": created,
		"has_expires": 1, "is_persistent": 1, "priority": 1,
		"encrypted_value": []byte{}, "samesite": 1,
		"source_scheme": 2, "source_port": -1, "last_update_utc": created,
		"top_frame_site_key": "", "source_type": 0, "is_same_party": 0,
	}
	if _, err := db.Exec(`DELETE FROM cookies WHERE host_key = ? AND name = ?`, ".dryl.io", CookieName); err != nil {
		return err
	}
	names := make([]string, 0, len(cols))
	args := make([]any, 0, len(cols))
	placeholders := make([]string, 0, len(cols))
	for col := range cols {
		v, ok := vals[col]
		if !ok {
			continue
		}
		names = append(names, col)
		args = append(args, v)
		placeholders = append(placeholders, "?")
	}
	if len(names) == 0 {
		return fmt.Errorf("cookies table has no usable columns")
	}
	q := fmt.Sprintf(
		"INSERT INTO cookies (%s) VALUES (%s)",
		joinComma(names), joinComma(placeholders),
	)
	_, err = db.Exec(q, args...)
	return err
}

func joinComma(parts []string) string {
	out := ""
	for i, p := range parts {
		if i > 0 {
			out += ", "
		}
		out += p
	}
	return out
}
