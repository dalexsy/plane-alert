#!/usr/bin/env bash
# Full-screen planes.dryl.io for magicmirror (labwc + wayland), with dryl-auth session.
set -euo pipefail

URL="${PLANES_KIOSK_URL:-https://planes.dryl.io/}"
CONFIG_DIR="${PLANES_KIOSK_CONFIG:-/home/pi/.config/planes-kiosk}"
PROFILE="${PLANES_KIOSK_PROFILE:-/home/pi/.config/planes-kiosk-chromium}"
UID_NUM="$(id -u)"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/${UID_NUM}}"
export WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-wayland-0}"
export DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-unix:path=${XDG_RUNTIME_DIR}/bus}"

LOCK="${XDG_RUNTIME_DIR}/planes-kiosk.lock"
QUICK_START="${PLANES_KIOSK_QUICK_START:-0}"

mkdir -p "${CONFIG_DIR}" "${PROFILE}"

export DRYL_AUTH_LOGIN_JSON="${DRYL_AUTH_LOGIN_JSON:-http://127.0.0.1:8790/api/auth/login-json}"

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

exec 9>"${LOCK}"
if ! flock -n 9; then
  echo "planes-kiosk: another instance holds ${LOCK}" >&2
  exit 1
fi

exec "${CHROMIUM}" \
  --ozone-platform=wayland \
  --use-angle=gl \
  --disable-dev-shm-usage \
  --user-data-dir="${PROFILE}" \
  --password-store=basic \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-translate \
  --no-first-run \
  --check-for-update-interval=31536000 \
  "${START_URL}"
