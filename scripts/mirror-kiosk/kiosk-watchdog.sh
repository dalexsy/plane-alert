#!/usr/bin/env bash
# magicmirror: heal planes kiosk after dryl-auth / admin tunnel outages.
# Long-running user service (not a timer). Full Chromium restart is daytime-only —
# overnight restarts light the bedroom (see planes-kiosk-daytime-restart.timer).
set -euo pipefail

CHECK_URL="${KIOSK_WATCHDOG_URL:-https://admin.dryl.io/}"
LOCAL_AUTH="${KIOSK_WATCHDOG_AUTH:-http://127.0.0.1:8790/health}"
POLL_SEC="${KIOSK_WATCHDOG_POLL_SEC:-20}"
STABILISE_SEC="${KIOSK_WATCHDOG_STABILISE_SEC:-8}"
PI_USER="${PLANES_KIOSK_USER:-pi}"
PI_UID="$(id -u "${PI_USER}" 2>/dev/null || echo 1000)"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/${PI_UID}}"
export DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-unix:path=${XDG_RUNTIME_DIR}/bus}"

log() {
  local msg="$*"
  echo "[kiosk-watchdog] ${msg}"
  logger -t kiosk-watchdog "${msg}" 2>/dev/null || true
}

# Berlin 22:00–07:00 — never restart Chromium (bright flash in the apartment).
is_quiet_hours() {
  local hour
  hour="$(TZ=Europe/Berlin date +%H | sed 's/^0//')"
  [ "${hour:-0}" -ge 22 ] || [ "${hour:-0}" -lt 7 ]
}

http_code() {
  local url="$1"
  curl -sS -o /dev/null -m 8 -w '%{http_code}' "${url}" 2>/dev/null || echo "000"
}

is_up() {
  local code
  code="$(http_code "$1")"
  case "${code}" in
    200|204|301|302|303|307|308) return 0 ;;
    *) return 1 ;;
  esac
}

# Prefer local dryl-auth health; fall back to public admin (tunnel).
endpoint_up() {
  if is_up "${LOCAL_AUTH}"; then
    return 0
  fi
  is_up "${CHECK_URL}"
}

restart_kiosk_if_allowed() {
  if is_quiet_hours; then
    log "$(date -Iseconds) quiet hours (22:00-07:00 Berlin) — skip Chromium restart after auth recovery"
    return 0
  fi
  log "restarting planes-kiosk.service"
  if systemctl --user restart planes-kiosk.service; then
    sleep 3
    log "planes-kiosk status after restart: $(systemctl --user is-active planes-kiosk.service 2>/dev/null || echo unknown)"
  else
    log "planes-kiosk restart failed"
  fi
}

was_down=0
down_since=""

log "started (poll ${POLL_SEC}s, quiet 22:00-07:00 Berlin, no overnight Chromium restart)"

while true; do
  if endpoint_up; then
    if [ "${was_down}" -eq 1 ]; then
      log "$(date -Iseconds) admin/auth RECOVERED (was down since ${down_since:-unknown})"
      log "waiting ${STABILISE_SEC}s for tunnel to stabilise..."
      sleep "${STABILISE_SEC}"
      if endpoint_up; then
        restart_kiosk_if_allowed
      else
        log "auth still flapping after stabilise wait — leave kiosk alone"
      fi
      was_down=0
      down_since=""
    fi
  else
    if [ "${was_down}" -eq 0 ]; then
      down_since="$(date -Iseconds)"
      log "${down_since} admin/auth DOWN — watching for recovery"
      was_down=1
    fi
  fi
  sleep "${POLL_SEC}"
done
