# planes-kiosk (Go)

Replaces retired Python kiosk helpers on magicmirror (`.74`).

| Command | Binary / action |
|---|---|
| `go run -C tools/planes-kiosk ./cmd/session` | `/home/pi/bin/planes-kiosk-session` |
| `go run -C tools/planes-kiosk ./cmd/alert-listen` | `/home/pi/bin/planes-kiosk-alert-listen` |
| `go run -C tools/planes-kiosk ./cmd/install` | full install (builds arm64 + SCP) |
| `go run -C tools/planes-kiosk ./cmd/install --launch` | install + restart Chromium |
| `go run -C tools/planes-kiosk ./cmd/restart` | remote restart |
| `go run -C tools/planes-kiosk ./cmd/verify-recovery` | recovery gates on `.74` |
| `go run -C tools/planes-kiosk ./cmd/verify-motion` | CDP motion-off gate + screenshot |
| `go run -C tools/planes-kiosk ./cmd/capture` | grim → `directory/logs/.../kiosk-latest.png` |
| `go run -C tools/planes-kiosk ./cmd/probe-cpu` | Chromium CPU + CDP paint probe |
| `go run -C tools/planes-kiosk ./cmd/deploy` | authorized `pi-deploy-dryl-site.py planes` |

npm: `kiosk:planes`, `install:kiosk-watch`, `kiosk:restart`, `verify:kiosk-alert`,
`verify:kiosk-recovery`, `verify:kiosk-motion`, `capture:kiosk`, `probe:kiosk-cpu`, `deploy:dryl`.
