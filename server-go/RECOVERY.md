# Go Plane Alert API recovery

Initial recovery serves live aircraft, reverse geocoding, saved antenna
sightings and delivered military history on the existing loopback port 8795.
The service opens the installed /home/pi/planes-api/data stores without
initializing or compacting them. Missing/corrupt stores remain
visible errors. Unknown stored fields stay on disk; public history uses an
allowlist and current validated device filtering.

Aircraft provider bodies, concurrency and last-good cache are bounded. Provider
failures do not become empty successful responses. Cached aircraft are marked
stale and expire after fifteen minutes. The unit enforces 256 MiB memory,
zero swap and bounded CPU/tasks. Only the antenna data directory is writable;
the separate registration/history store remains explicitly read-only.

The configured home antenna is polled by one bounded Go loop. It retains all
stored sightings and unknown fields, updates live API snapshots in memory,
coalesces disk persistence to at most once per minute, and flushes pending
observations on graceful shutdown. Idle/failed polls do not rewrite files.
One original and one previous snapshot are retained; unexpected outside edits
or corrupt files stop persistence rather than replacing household history.
The listener is acquired before collection starts, preventing overlapping
writers during a failed second startup. Notification registration/delivery
and manual sighting writes remain held; health reports those separately.

Run `go test ./...` and `go vet ./...` in server-go. Native staging sets
PLANE_SERVICE_BINARY to exercise the actual PC-built ARM64 binary against
isolated temporary data. Never send household alerts to test this recovery.
