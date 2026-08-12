#!/usr/bin/env bash
# Full-screen planes.dryl.io for magicmirror (labwc + wayland), with dryl-auth session.
set -euo pipefail

URL="${PLANES_KIOSK_URL:-https://planes.dryl.io/?kiosk=1}"
CONFIG_DIR="${PLANES_KIOSK_CONFIG:-/home/pi/.config/planes-kiosk}"
PROFILE="${PLANES_KIOSK_PROFILE:-/home/pi/.config/planes-kiosk-chromium}"
UID_NUM="$(id -u)"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/${UID_NUM}}"
export WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-wayland-0}"
export DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-unix:path=${XDG_RUNTIME_DIR}/bus}"

LOCK="${XDG_RUNTIME_DIR}/planes-kiosk.lock"
WAYLAND_SOCK="${XDG_RUNTIME_DIR}/${WAYLAND_DISPLAY}"
QUICK_START="${PLANES_KIOSK_QUICK_START:-0}"
WAYLAND_WAIT_SEC="${PLANES_KIOSK_WAYLAND_WAIT:-90}"

mkdir -p "${CONFIG_DIR}" "${PROFILE}"

# Auth lives on dryl-prod; kiosk Pi has dryl-auth masked after the 2026-08 split.
export DRYL_AUTH_LOGIN_JSON="${DRYL_AUTH_LOGIN_JSON:-https://admin.dryl.io/api/auth/login-json}"

# User systemd can start before labwc publishes wayland-0 — wait or Chromium exits and Restart= storms.
for _ in $(seq 1 "${WAYLAND_WAIT_SEC}"); do
  if [ -S "${WAYLAND_SOCK}" ]; then
    break
  fi
  sleep 1
done
if [ ! -S "${WAYLAND_SOCK}" ]; then
  echo "planes-kiosk: no wayland socket yet (${WAYLAND_SOCK})" >&2
  exit 1
fi

if [[ "${QUICK_START}" != "1" && -f "${CONFIG_DIR}/credentials.env" ]]; then
  if ! python3 /home/pi/bin/planes-kiosk-session.py; then
    echo "planes-kiosk: session bootstrap failed — continuing anyway" >&2
  fi
fi

if [[ "${QUICK_START}" != "1" ]]; then
  for _ in $(seq 1 90); do
    if curl -sf -o /dev/null -m 4 "${URL}"; then
      break
    fi
    sleep 2
  done
fi

CHROMIUM=""
for bin in /usr/lib/chromium/chromium /usr/bin/chromium /usr/bin/chromium-browser; do
  if [[ -x "${bin}" ]]; then
    CHROMIUM="${bin}"
    break
  fi
done
if [[ -z "${CHROMIUM}" ]]; then
  echo "planes-kiosk: chromium not found" >&2
  exit 1
fi

# Always open planes directly — session cookie is imported into the profile.
# Never land on admin.dryl.io (kiosk must not expose the admin hub).
START_URL="${URL}"

kiosk_chromium_running() {
  pgrep -f "user-data-dir=${PROFILE}" >/dev/null 2>&1
}

exec 9>"${LOCK}"
if ! flock -n 9; then
  if kiosk_chromium_running; then
    # Desktop autostart and user service used to race — treat as healthy so Restart= stops.
    echo "planes-kiosk: already running (lock held)" >&2
    exit 0
  fi
  echo "planes-kiosk: stale lock without chromium — clearing" >&2
  rm -f "${LOCK}"
  exec 9>"${LOCK}"
  if ! flock -n 9; then
    echo "planes-kiosk: cannot acquire ${LOCK}" >&2
    exit 1
  fi
fi

# This Pi also hosts balcony-log's real-time HLS pull/encode (ffmpeg) — a
# dropped CPU slice there means a frozen/choppy stream for everyone watching,
# while a slightly slower kiosk repaint costs nothing visible. Deprioritize
# the kiosk (and its GPU/renderer children, which inherit nice) so it yields
# under contention instead of starving the stream.
NICE_BIN="$(command -v nice || true)"
IONICE_BIN="$(command -v ionice || true)"
LAUNCH=()
if [[ -n "${IONICE_BIN}" ]]; then
  LAUNCH+=("${IONICE_BIN}" -c2 -n7)
fi
if [[ -n "${NICE_BIN}" ]]; then
  # Was -n 10; still starved balcony HLS. Yield harder under 2GB contention.
  LAUNCH+=("${NICE_BIN}" -n 15)
fi

# no-user-gesture-required: kiosk never gets a click; without this, Alert/TTS stay silent
# while system sounds still work (matches "other audio works, plane-alert doesn't").
# Software GL: hardware GPU process was pegging 70–80% on this 2GB Pi and
# freezing balcony.dryl.io/watch every day. Planes map is slower; stream lives.
exec "${LAUNCH[@]}" "${CHROMIUM}" \
  --ozone-platform=wayland \
  --use-gl=swiftshader \
  --disable-gpu \
  --disable-dev-shm-usage \
  --user-data-dir="${PROFILE}" \
  --password-store=basic \
  --autoplay-policy=no-user-gesture-required \
  --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port=9222 \
  --remote-allow-origins=http://127.0.0.1:9222 \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-translate \
  --no-first-run \
  --check-for-update-interval=31536000 \
  --force-prefers-reduced-motion \
  "${START_URL}"
