#!/bin/bash
# magicmirror (Kallax): keep planes kiosk alive — network, session, wrong URL, white screen.
set -euo pipefail

URL="${PLANES_KIOSK_URL:-https://planes.dryl.io/}"
GATEWAY="${PLANES_KIOSK_WATCH_GATEWAY:-192.168.178.1}"
AUTH_URL="${PLANES_KIOSK_AUTH_URL:-http://127.0.0.1:8790/health}"
PROFILE="${PLANES_KIOSK_PROFILE:-/home/pi/.config/planes-kiosk-chromium}"
KIOSK_MATCH="user-data-dir=${PROFILE}"
STATE_DIR="/run/planes-kiosk-watch"
CPU_HIGH="${PLANES_KIOSK_CPU_HIGH:-45}"
CPU_STRIKES_NEEDED="${PLANES_KIOSK_CPU_STRIKES:-3}"
RESTART_COOLDOWN_SEC="${PLANES_KIOSK_RESTART_COOLDOWN:-300}"
MISSING_COOLDOWN_SEC="${PLANES_KIOSK_MISSING_COOLDOWN:-90}"
SESSION_STRIKES_NEEDED="${PLANES_KIOSK_SESSION_STRIKES:-3}"
AUTH_STRIKES_NEEDED="${PLANES_KIOSK_AUTH_STRIKES:-3}"
NIGHTLY_HOUR="${PLANES_KIOSK_NIGHTLY_HOUR:-4}"
NOON_HOUR="${PLANES_KIOSK_NOON_HOUR:-12}"
PI_USER="${PLANES_KIOSK_USER:-pi}"
PI_UID="$(id -u "${PI_USER}" 2>/dev/null || echo 1000)"
WAYLAND_SOCK="/run/user/${PI_UID}/wayland-0"

CPU_STRIKES_FILE="${STATE_DIR}/cpu-strikes"
NET_DOWN_FILE="${STATE_DIR}/net-down"
RESTART_COOLDOWN_FILE="${STATE_DIR}/last-restart"
LAN_FAIL_FILE="${STATE_DIR}/lan-fails"
AUTH_STRIKES_FILE="${STATE_DIR}/auth-strikes"
SESSION_STRIKES_FILE="${STATE_DIR}/session-strikes"
LAN_FAIL_MAX="${PLANES_KIOSK_LAN_FAIL_MAX:-4}"

log() { logger -t planes-kiosk-watch "$*"; }

mkdir -p "${STATE_DIR}"

can_restart() {
  local reason="${1:-}"
  local cooldown="${RESTART_COOLDOWN_SEC}"
  if [ "${reason}" = "chromium-missing" ] || [ "${reason}" = "restart-failed" ] || [ "${reason}" = "session-stale" ]; then
    cooldown="${MISSING_COOLDOWN_SEC}"
  fi
  if [ ! -f "${RESTART_COOLDOWN_FILE}" ]; then
    return 0
  fi
  local last now
  last="$(cat "${RESTART_COOLDOWN_FILE}")"
  now="$(date +%s)"
  [ $((now - last)) -ge "${cooldown}" ]
}

mark_restart() {
  date +%s >"${RESTART_COOLDOWN_FILE}"
  echo 0 >"${CPU_STRIKES_FILE}" 2>/dev/null || true
}

clear_restart_cooldown() {
  rm -f "${RESTART_COOLDOWN_FILE}"
}

do_restart() {
  local reason="$1"
  if ! can_restart "${reason}"; then
    log "skip restart (cooldown): ${reason}"
    return 0
  fi
  if [ ! -S "${WAYLAND_SOCK}" ]; then
    log "skip restart (no wayland): ${reason}"
    return 0
  fi
  log "restarting kiosk: ${reason}"
  if /usr/local/sbin/planes-kiosk-restart.sh; then
    mark_restart
    log "restart ok: ${reason}"
  else
    clear_restart_cooldown
    log "restart failed (no chromium): ${reason}"
  fi
}

ping_host() {
  ping -c1 -W3 "$1" >/dev/null 2>&1
}

check_lan() {
  ping_host "${GATEWAY}"
}

check_internet() {
  check_lan || return 1
  if curl -sf -m 8 -o /dev/null "${URL}"; then
    return 0
  fi
  curl -sf -m 6 -o /dev/null https://1.1.1.1/cdn-cgi/trace
}

check_dryl_auth() {
  curl -sf -m 4 -o /dev/null "${AUTH_URL}"
}

kiosk_chromium_running() {
  pgrep -f "${KIOSK_MATCH}" >/dev/null 2>&1
}

kiosk_renderer_running() {
  pgrep -f "chromium --type=renderer.*planes-kiosk-chromium" >/dev/null 2>&1
}

kiosk_chromium_cmdline() {
  ps -eo args= 2>/dev/null | grep -F "${PROFILE}" | grep -v grep | head -1 || true
}

kiosk_on_planes_url() {
  local cmdline="$1"
  echo "${cmdline}" | grep -q 'planes\.dryl\.io'
}

kiosk_on_admin_hub() {
  local cmdline="$1"
  if ! echo "${cmdline}" | grep -q 'admin\.dryl\.io'; then
    return 1
  fi
  if echo "${cmdline}" | grep -q 'login?next='; then
    return 1
  fi
  return 0
}

session_valid() {
  [ -f /home/pi/.config/planes-kiosk/credentials.env ] || return 0
  python3 /home/pi/bin/planes-kiosk-session.py --verify-only
}

renderer_cpu_max() {
  local pid cpu max=0
  while read -r pid; do
    [ -z "${pid}" ] && continue
    cpu="$(ps -p "${pid}" -o %cpu= 2>/dev/null | tr -d ' ' | cut -d. -f1 || true)"
    [ -z "${cpu}" ] && continue
    [ "${cpu}" -gt "${max}" ] && max="${cpu}"
  done < <(pgrep -f "chromium --type=renderer.*planes-kiosk-chromium" 2>/dev/null || true)
  echo "${max}"
}

recover_lan() {
  local fails
  fails="$(cat "${LAN_FAIL_FILE}" 2>/dev/null || echo 0)"
  fails=$((fails + 1))
  echo "${fails}" >"${LAN_FAIL_FILE}"
  log "LAN down (${fails}/${LAN_FAIL_MAX}) gateway=${GATEWAY}"

  if [ "${fails}" -eq 1 ] && command -v wpa_cli >/dev/null 2>&1; then
    local iface
    iface="$(iw dev 2>/dev/null | awk '$1=="Interface"{print $2; exit}')"
    if [ -n "${iface:-}" ]; then
      wpa_cli -i "${iface}" reconnect >/dev/null 2>&1 || true
      log "wpa_cli reconnect on ${iface}"
    fi
    rfkill unblock wifi 2>/dev/null || true
    return 0
  fi

  if [ "${fails}" -lt "${LAN_FAIL_MAX}" ]; then
    systemctl restart NetworkManager 2>/dev/null \
      || systemctl restart dhcpcd 2>/dev/null \
      || systemctl restart networking 2>/dev/null \
      || true
    sleep 8
    if check_lan; then
      echo 0 >"${LAN_FAIL_FILE}" 2>/dev/null || true
      log "LAN recovered after network restart"
    fi
    return 0
  fi

  log "LAN still down after ${LAN_FAIL_MAX} tries — rebooting magicmirror"
  /sbin/reboot
}

maybe_scheduled_refresh() {
  local hour minute stamp label target_hour
  hour="$(date +%H | sed 's/^0//')"
  minute="$(date +%M | sed 's/^0//')"
  for target_hour in "${NIGHTLY_HOUR}" "${NOON_HOUR}"; do
    [ "${hour}" = "${target_hour}" ] || continue
    [ "${minute:-0}" -lt 8 ] || continue
    label="refresh-${target_hour}"
    stamp="${STATE_DIR}/${label}-$(date +%Y-%m-%d)"
    [ -f "${stamp}" ] && continue
    touch "${stamp}"
    do_restart "${label}"
    return 0
  done
}

if ! check_lan; then
  recover_lan
  exit 0
fi
echo 0 >"${LAN_FAIL_FILE}" 2>/dev/null || true

if [ ! -S "${WAYLAND_SOCK}" ]; then
  log "no wayland session yet"
  exit 0
fi

if ! kiosk_chromium_running; then
  do_restart "chromium-missing"
  exit 0
fi

if ! kiosk_renderer_running; then
  do_restart "chromium-no-renderer"
  exit 0
fi

if ! check_dryl_auth; then
  strikes="$(cat "${AUTH_STRIKES_FILE}" 2>/dev/null || echo 0)"
  strikes=$((strikes + 1))
  echo "${strikes}" >"${AUTH_STRIKES_FILE}"
  if [ "${strikes}" -ge "${AUTH_STRIKES_NEEDED}" ]; then
    log "dryl-auth unhealthy (${strikes} strikes) — restarting dryl-auth.service"
    systemctl restart dryl-auth.service 2>/dev/null || true
    sleep 3
    echo 0 >"${AUTH_STRIKES_FILE}" 2>/dev/null || true
  fi
else
  echo 0 >"${AUTH_STRIKES_FILE}" 2>/dev/null || true
fi

internet_up=0
if check_internet; then
  internet_up=1
  if [ -f "${NET_DOWN_FILE}" ]; then
    rm -f "${NET_DOWN_FILE}"
    do_restart "internet-restored"
    exit 0
  fi
else
  if [ ! -f "${NET_DOWN_FILE}" ]; then
    log "planes/internet unreachable — still checking kiosk"
    date +%s >"${NET_DOWN_FILE}"
  fi
fi

maybe_scheduled_refresh

cmdline="$(kiosk_chromium_cmdline)"

if kiosk_on_admin_hub "${cmdline}"; then
  do_restart "wrong-url-admin-hub"
  exit 0
fi

if ! kiosk_on_planes_url "${cmdline}"; then
  do_restart "wrong-url-not-planes"
  exit 0
fi

if [ "${internet_up}" -eq 1 ] && [ -f /home/pi/.config/planes-kiosk/credentials.env ]; then
  if ! session_valid; then
    strikes="$(cat "${SESSION_STRIKES_FILE}" 2>/dev/null || echo 0)"
    strikes=$((strikes + 1))
    echo "${strikes}" >"${SESSION_STRIKES_FILE}"
    log "session verify failed (strike ${strikes}/${SESSION_STRIKES_NEEDED}) — refreshing cookie"
    python3 /home/pi/bin/planes-kiosk-session.py >/dev/null 2>&1 || true
    if [ "${strikes}" -ge "${SESSION_STRIKES_NEEDED}" ]; then
      do_restart "session-stale"
      echo 0 >"${SESSION_STRIKES_FILE}" 2>/dev/null || true
      exit 0
    fi
  else
    echo 0 >"${SESSION_STRIKES_FILE}" 2>/dev/null || true
  fi
fi

if [ "${internet_up}" -eq 0 ]; then
  exit 0
fi

cpu_max="$(renderer_cpu_max)"
if [ "${cpu_max}" -ge "${CPU_HIGH}" ]; then
  strikes="$(cat "${CPU_STRIKES_FILE}" 2>/dev/null || echo 0)"
  strikes=$((strikes + 1))
  echo "${strikes}" >"${CPU_STRIKES_FILE}"
  log "high renderer CPU ${cpu_max}% (strike ${strikes}/${CPU_STRIKES_NEEDED})"
  if [ "${strikes}" -ge "${CPU_STRIKES_NEEDED}" ]; then
    do_restart "runaway-renderer-cpu"
  fi
else
  echo 0 >"${CPU_STRIKES_FILE}" 2>/dev/null || true
fi
