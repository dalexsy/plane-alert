#!/usr/bin/env bash
# magicmirror: heal planes kiosk after dryl-auth / admin tunnel outages.
# Long-running user service (not a timer). Auth recovery never restarts Chromium.
# Page recovery belongs to the page healer and kiosk health watch.
set -euo pipefail

CHECK_URL="${KIOSK_WATCHDOG_URL:-https://admin.dryl.io/}"
# Prefer local dryl-auth when co-located; kiosk-only Pi falls back to admin.
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

recover_kiosk_if_needed() {
  if is_quiet_hours; then
    log "$(date -Iseconds) quiet hours (22:00-07:00 Berlin) — leave Chromium untouched after auth recovery"
    return 0
  fi
  # Auth connectivity is not page health. A healthy display must keep its process
  # and document, even when the remote admin endpoint flaps repeatedly.
  # The existing page healer inspects the live tab and reloads only a broken page.
  log "auth recovered — inspect page without restarting Chromium"
  if ! python3 /usr/local/sbin/planes-kiosk-page-heal.py; then
    log "page inspection failed — leave Chromium running; kiosk health watch retains recovery ownership"
  fi
}

main() {

was_down=0
down_since=""

log "started (poll ${POLL_SEC}s, quiet 22:00-07:00 Berlin, auth recovery never restarts Chromium)"

while true; do
  if endpoint_up; then
    if [ "${was_down}" -eq 1 ]; then
      log "$(date -Iseconds) admin/auth RECOVERED (was down since ${down_since:-unknown})"
      log "waiting ${STABILISE_SEC}s for tunnel to stabilise..."
      sleep "${STABILISE_SEC}"
      if endpoint_up; then
        recover_kiosk_if_needed
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

}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main
fi
