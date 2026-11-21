# planes-kiosk (Go)

Replaces retired Python kiosk helpers on magicmirror (`.74`).

| Command | Binary / action |
|---|---|
| `go run -C tools/planes-kiosk ./cmd/session` | `/home/pi/bin/planes-kiosk-session` |
| `go run -C tools/planes-kiosk ./cmd/alert-listen` | `/home/pi/bin/planes-kiosk-alert-listen` |
| `go run -C tools/planes-kiosk ./cmd/install` | full install (builds arm64 + SCP) |
| `go run -C tools/planes-kiosk ./cmd/install --launch` | install + restart Chromium |
| `go run -C tools/planes-kiosk ./cmd/restart` | remote restart |

npm: `kiosk:planes`, `install:kiosk-watch`, `kiosk:restart`, `verify:kiosk-alert`.
