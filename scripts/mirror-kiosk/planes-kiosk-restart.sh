#!/usr/bin/env bash
# Restart planes.dryl.io Chromium kiosk via pi's systemd user session (GPU-safe).
set -euo pipefail

PI_USER="${PLANES_KIOSK_USER:-pi}"
PI_UID="$(id -u "${PI_USER}")"
XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/${PI_UID}}"
DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-unix:path=${XDG_RUNTIME_DIR}/bus}"
LOG="${PLANES_KIOSK_LOG:-/home/pi/planes-kiosk.log}"
PROFILE="${PLANES_KIOSK_PROFILE:-/home/pi/.config/planes-kiosk-chromium}"
KIOSK_MATCH="user-data-dir=${PROFILE}"
LOCK="${XDG_RUNTIME_DIR}/planes-kiosk.lock"
USER_UNIT="planes-kiosk.service"

user_systemctl() {
  sudo -u "${PI_USER}" env \
    XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR}" \
    DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS}" \
    systemctl --user "$@"
}

if [ ! -S "${XDG_RUNTIME_DIR}/wayland-0" ]; then
  echo "planes-kiosk-restart: no wayland socket (${XDG_RUNTIME_DIR}/wayland-0)" >&2
  exit 1
fi

user_systemctl stop "${USER_UNIT}" 2>/dev/null || true
pkill -f '/home/pi/bin/planes-kiosk\.sh' 2>/dev/null || true
pkill -f "chromium.*${PROFILE}" 2>/dev/null || true
pkill -f 'chromium.*planes\.dryl' 2>/dev/null || true
sleep 3
rm -f "${LOCK}"
# SIGKILL leaves Session Storage on disk; Chromium can restore kiosk-audio-primed
# and skip the boot chirp that proves MP3 → Jabra after quiet-hours flips.
rm -rf "${PROFILE}/Default/Session Storage"
mkdir -p "${PROFILE}/Default/Session Storage"
chown -R "${PI_USER}:${PI_USER}" "${PROFILE}/Default/Session Storage"

# Wait for labwc — restarting before wayland-0 causes Chromium to exit and Restart= storms.
for _ in $(seq 1 60); do
  if [ -S "${XDG_RUNTIME_DIR}/wayland-0" ]; then
    break
  fi
  sleep 1
done
if [ ! -S "${XDG_RUNTIME_DIR}/wayland-0" ]; then
  echo "planes-kiosk-restart: wayland still missing after wait" >&2
  exit 1
fi

if [ -f /home/pi/.config/planes-kiosk/credentials.env ]; then
  sudo -u "${PI_USER}" env \
    DRYL_AUTH_LOGIN_JSON="${DRYL_AUTH_LOGIN_JSON:-http://127.0.0.1:8790/api/auth/login-json}" \
    python3 /home/pi/bin/planes-kiosk-session.py || true
fi

touch "${LOG}"
chown "${PI_USER}:${PI_USER}" "${LOG}"

user_systemctl reset-failed "${USER_UNIT}" 2>/dev/null || true
user_systemctl daemon-reload 2>/dev/null || true
if ! sudo -u "${PI_USER}" env \
  XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR}" \
  DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS}" \
  systemctl --user start "${USER_UNIT}"; then
  echo "planes-kiosk-restart: user service start failed" >&2
  user_systemctl status "${USER_UNIT}" --no-pager >&2 || true
  exit 1
fi

for _ in $(seq 1 90); do
  if pgrep -f "${KIOSK_MATCH}" >/dev/null 2>&1; then
    exit 0
  fi
  sleep 1
done

echo "planes-kiosk-restart: chromium did not stay up" >&2
user_systemctl status "${USER_UNIT}" --no-pager >&2 || true
tail -8 "${LOG}" >&2 || true
exit 1
