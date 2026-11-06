# Continuous household display

The household Plane screen should poll data in place. A backend outage is not
evidence that Chromium needs reloading. Production API recovery uses the Go
service described in server-go/RECOVERY.md; infrastructure identities belong
to Directory's canonical infrastructure map.

The legacy system planes-kiosk-watch.timer forced a soft reload after three
failed API checks, approximately every six minutes. The user-level
planes-kiosk-daytime-restart.timer independently restarted Chromium four times
daily. Both timers are disabled, their associated oneshots are inactive, and
the existing browser process remains running with its normal bounded
Restart=on-failure policy. Do not reinstall those schedules through old scripts.

The frontend no longer schedules noon or daily document navigation, clears
service workers as part of a timer, or adds refresh query parameters. Existing
aircraft polling and saved sightings remain normal application behavior.

Runtime acceptance requires inspecting the actual household browser, observing
live aircraft updates and no top-level navigation across at least two former
watchdog intervals. A page shell, successful health route or home marker alone
does not demonstrate useful aircraft data.
