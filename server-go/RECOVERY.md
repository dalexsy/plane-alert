# Go Plane Alert API recovery

Initial recovery serves live aircraft, reverse geocoding, saved antenna
sightings and delivered military history on the existing loopback port 8795.
The service reads the installed /home/pi/planes-api/data stores without
initializing, compacting or rewriting them. Missing/corrupt stores remain
visible errors. Unknown stored fields stay on disk; public history uses an
allowlist and current validated device filtering.

Aircraft provider bodies, concurrency and last-good cache are bounded. Provider
failures do not become empty successful responses. Cached aircraft are marked
stale and expire after fifteen minutes. The unit enforces 256 MiB memory,
zero swap and bounded CPU/tasks, and has no writable household paths.

Notification registration/delivery, manual sighting writes and antenna polling
are still held. Health explicitly reports processing/polling disabled. This is
an initial data recovery slice, not complete Plane Alert restoration.

Run `go test ./...` and `go vet ./...` in server-go. Native staging sets
PLANE_SERVICE_BINARY to exercise the actual PC-built ARM64 binary against
isolated temporary data. Never send household alerts to test this recovery.
