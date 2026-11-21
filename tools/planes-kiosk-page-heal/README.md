# planes-kiosk-page-heal

Go replacement for the retired Python CDP soft-heal on magicmirror (`.74`).

```powershell
go test ./tools/planes-kiosk-page-heal
go run ./tools/planes-kiosk-page-heal/cmd/install
```

Install cross-compiles `linux/arm64`, copies to `/usr/local/sbin/planes-kiosk-page-heal`, and deletes legacy `planes-kiosk-page-heal.py`.

`planes-kiosk-watch.sh` invokes the binary (optional `PLANES_KIOSK_PAGE_HEAL_FORCE=1`).
