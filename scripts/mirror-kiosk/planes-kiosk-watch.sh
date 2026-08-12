#!/bin/bash
# magicmirror (Kallax): keep planes kiosk alive — network, session, wrong URL, white screen.
set -euo pipefail

URL="${PLANES_KIOSK_URL:-https://planes.dryl.io/?kiosk=1}"
GATEWAY="${PLANES_KIOSK_WATCH_GATEWAY:-192.168.178.1}"
# Post-split: dryl-auth is on dryl-prod, not magicmirror. Public admin is the truth.
AUTH_URL="${PLANES_KIOSK_AUTH_URL:-https://admin.dryl.io/}"
PROFILE="${PLANES_KIOSK_PROFILE:-/home/pi/.config/planes-kiosk-chromium}"
KIOSK_MATCH="user-data-dir=${PROFILE}"
STATE_DIR="/run/planes-kiosk-watch"
# Pi reports multi-core CPU as >100%; map/globe tabs sit ~150% while healthy.
# GPU process alone at ~80% freezes balcony HLS — watch that too (was renderer-only).
CPU_HIGH="${PLANES_KIOSK_CPU_HIGH:-180}"
GPU_CPU_HIGH="${PLANES_KIOSK_GPU_CPU_HIGH:-60}"
CPU_STRIKES_NEEDED="${PLANES_KIOSK_CPU_STRIKES:-4}"
RESTART_COOLDOWN_SEC="${PLANES_KIOSK_RESTART_COOLDOWN:-1800}"
MISSING_COOLDOWN_SEC="${PLANES_KIOSK_MISSING_COOLDOWN:-600}"
SESSION_STRIKES_NEEDED="${PLANES_KIOSK_SESSION_STRIKES:-3}"
AUTH_STRIKES_NEEDED="${PLANES_KIOSK_AUTH_STRIKES:-3}"
# Empty NIGHTLY disables 4am flash (sleep / bright white). Noon alone is fine.
NIGHTLY_HOUR="${PLANES_KIOSK_NIGHTLY_HOUR:-}"
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
DATA_STRIKES_FILE="${STATE_DIR}/data-strikes"
SESSION_JAR="/home/pi/.config/planes-kiosk/session.jar"
LAN_FAIL_MAX="${PLANES_KIOSK_LAN_FAIL_MAX:-4}"
# Set when heal_cloudflared_tunnel saw an error page (1033/530/000) this cycle —
# Chromium's already-rendered tab is stale even if the tunnel heals same-cycle,
# because nothing else ever tells that tab to reload (kiosk stuck on Error 1033).
PAGE_ERROR_SEEN=0

log() { logger -t planes-kiosk-watch "$*"; }

mkdir -p "${STATE_DIR}"

can_restart() {
  local reason="${1:-}"
  local cooldown="${RESTART_COOLDOWN_SEC}"
  # True death only may use a shorter (still multi-minute) cooldown.
  if [ "${reason}" = "chromium-missing" ] || [ "${reason}" = "chromium-no-renderer" ] || [ "${reason}" = "restart-failed" ]; then
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

# balcony-log HLS remux shares this 2GB Pi. When load is high, RAM is tight,
# or remux chunks go stale, never resurrect Chromium — that is the daily
# /watch freeze loop. Chromium's renderer/gpu/utility processes alone run
# ~700MB RSS on this box; once free RAM drops low the kernel leans on zram
# swap, and swap churn is what shows up as multi-second /watch stalls.
balcony_needs_headroom() {
  local load1 chunk_age mem_avail_kb
  load1="$(awk '{print $1}' /proc/loadavg)"
  mem_avail_kb="$(awk '/MemAvailable/ {print $2}' /proc/meminfo)"
  chunk_age="$(
    curl -sf -m 2 http://127.0.0.1:3838/api/live/status 2>/dev/null \
      | python3 -c 'import sys,json
try:
 d=json.load(sys.stdin); v=d.get("video") or {}
    print(int(v.get("lastChunkAgeMs") or 0))
except Exception:
 print(0)' 2>/dev/null || echo 0
  )"
  awk -v l="${load1}" -v a="${chunk_age}" -v m="${mem_avail_kb}" 'BEGIN {
    if (l+0 >= 3.0) exit 0
    if (a+0 >= 4000) exit 0
    if (m+0 > 0 && m+0 < 300000) exit 0
    exit 1
  }'
}

yield_kiosk_to_balcony() {
  local pid
  if ! balcony_needs_headroom; then
    return 0
  fi
  if ! kiosk_chromium_running; then
    return 0
  fi
  log "balcony needs headroom — renicing planes-kiosk chromium to +15"
  while read -r pid; do
    [ -z "${pid}" ] && continue
    renice -n 15 -p "${pid}" >/dev/null 2>&1 || true
  done < <(pgrep -f "${KIOSK_MATCH}" 2>/dev/null || true)
}

# Berlin civil hour 22–07: never full-restart Chromium (bright bedroom flash).
# Matches planes quiet-hours + daytime-only restart timer policy.
is_quiet_hours() {
  local hour
  hour="$(TZ=Europe/Berlin date +%H | sed 's/^0//')"
  [ "${hour:-0}" -ge 22 ] || [ "${hour:-0}" -lt 7 ]
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
  # Overnight: never flash the Kallax (auth recover, missing process, noon, etc.).
  # Cookie heal / tunnel heal still run elsewhere without killing Chromium.
  if is_quiet_hours; then
    log "skip restart (quiet hours 22:00-07:00 Berlin): ${reason}"
    return 0
  fi
  # Soft reasons never full-reload Chromium (home flash storm). Cookie/data
  # heals happen elsewhere; noon refresh is the only scheduled reload.
  case "${reason}" in
    plane-data-unhealthy|session-stale|internet-restored|page-error-healed|runaway-kiosk-cpu)
      log "skip restart (soft — leave tab up): ${reason}"
      return 0
      ;;
  esac
  # Any restart under balcony pressure or load≥2.0 — leave kiosk alone.
  if balcony_needs_headroom; then
    log "skip restart (balcony headroom): ${reason}"
    return 0
  fi
  load1="$(awk '{print $1}' /proc/loadavg)"
  if awk -v l="${load1}" 'BEGIN { exit !(l+0 >= 2.0) }'; then
    log "skip restart (load ${load1}): ${reason}"
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
  if curl -sf -m 6 -o /dev/null https://1.1.1.1/cdn-cgi/trace; then
    heal_cloudflared_tunnel
    sleep 5
    curl -sf -m 8 -o /dev/null "${URL}"
    return $?
  fi
  return 1
}

heal_cloudflared_tunnel() {
  local body code
  body="$(curl -s -m 10 "${URL}" 2>/dev/null | head -c 240 || true)"
  code="$(curl -s -o /dev/null -w '%{http_code}' -m 10 "${URL}" 2>/dev/null || echo 000)"
  if echo "${body}" | grep -q "Error 1033"; then
    log "Cloudflare 1033 on planes — restarting cloudflared-balcony"
    systemctl restart cloudflared-balcony 2>/dev/null || true
    PAGE_ERROR_SEEN=1
    return 0
  fi
  if [ "${code}" = "530" ] || [ "${code}" = "000" ]; then
    log "planes tunnel HTTP ${code} — restarting cloudflared-balcony"
    systemctl restart cloudflared-balcony 2>/dev/null || true
    PAGE_ERROR_SEEN=1
  fi
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

kiosk_main_cmdline() {
  ps -eo args= 2>/dev/null \
    | grep -F "${PROFILE}" \
    | grep -v grep \
    | grep -v -- '--type=' \
    | head -1 || true
}

kiosk_on_planes_url() {
  local cmdline="$1"
  [ -n "${cmdline}" ] && echo "${cmdline}" | grep -q 'planes\.dryl\.io'
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

plane_data_valid() {
  # planes.dryl.io is public — do not require session.jar (missing jar was a
  # permanent false "no JSON" after auth moved off this Pi).
  local body
  if [ -f "${SESSION_JAR}" ]; then
    body="$(curl -sf -m 15 -b "${SESSION_JAR}" -H 'Cache-Control: no-cache' \
      'https://planes.dryl.io/api/planes/adsbPointProxy?lat=52.4605886&lon=13.523268&radiusKm=100' \
      2>/dev/null || true)"
  else
    body="$(curl -sf -m 15 -H 'Cache-Control: no-cache' \
      'https://planes.dryl.io/api/planes/adsbPointProxy?lat=52.4605886&lon=13.523268&radiusKm=100' \
      2>/dev/null || true)"
  fi
  echo "${body}" | grep -q '^{"ac":\['
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

gpu_cpu_max() {
  local pid cpu max=0
  while read -r pid; do
    [ -z "${pid}" ] && continue
    cpu="$(ps -p "${pid}" -o %cpu= 2>/dev/null | tr -d ' ' | cut -d. -f1 || true)"
    [ -z "${cpu}" ] && continue
    [ "${cpu}" -gt "${max}" ] && max="${cpu}"
  done < <(pgrep -f "chromium --type=gpu-process.*planes-kiosk-chromium" 2>/dev/null || true)
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
  # Noon only — NIGHTLY_HOUR empty by default (no 4am white flash while sleeping).
  for target_hour in "${NOON_HOUR}" ${NIGHTLY_HOUR:+"${NIGHTLY_HOUR}"}; do
    [ -n "${target_hour}" ] || continue
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
    # dryl-auth is masked on magicmirror — never systemctl restart it here.
    log "admin/auth unreachable (${strikes} strikes) — edge hosts auth; not restarting local dryl-auth"
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
    log "internet restored — leave kiosk tab (no full reload)"
  fi
  # Tunnel blip that self-healed: do not flash-reload Chromium at home.
  if [ "${PAGE_ERROR_SEEN}" -eq 1 ]; then
    log "page error healed mid-cycle — leave tab (noon refresh will heal if needed)"
  fi
else
  if [ ! -f "${NET_DOWN_FILE}" ]; then
    log "planes/internet unreachable — still checking kiosk"
    date +%s >"${NET_DOWN_FILE}"
  fi
fi

maybe_scheduled_refresh

cmdline="$(kiosk_main_cmdline)"

if kiosk_on_admin_hub "${cmdline}"; then
  do_restart "wrong-url-admin-hub"
  exit 0
fi

if ! kiosk_on_planes_url "${cmdline}"; then
  log "kiosk not on planes launch URL (user navigation?) — leaving running"
fi

if [ "${internet_up}" -eq 1 ] && [ -f /home/pi/.config/planes-kiosk/credentials.env ]; then
  if ! session_valid; then
    strikes="$(cat "${SESSION_STRIKES_FILE}" 2>/dev/null || echo 0)"
    strikes=$((strikes + 1))
    echo "${strikes}" >"${SESSION_STRIKES_FILE}"
    log "session verify failed (strike ${strikes}/${SESSION_STRIKES_NEEDED}) — refreshing cookie"
    python3 /home/pi/bin/planes-kiosk-session.py >/dev/null 2>&1 || true
    if [ "${strikes}" -ge "${SESSION_STRIKES_NEEDED}" ]; then
      log "session stale after ${strikes} strikes — cookie refreshed; no Chromium reload"
      echo 0 >"${SESSION_STRIKES_FILE}" 2>/dev/null || true
    fi
  else
    echo 0 >"${SESSION_STRIKES_FILE}" 2>/dev/null || true
  fi
fi

if [ "${internet_up}" -eq 0 ]; then
  exit 0
fi

if ! plane_data_valid; then
  strikes="$(cat "${DATA_STRIKES_FILE}" 2>/dev/null || echo 0)"
  strikes=$((strikes + 1))
  echo "${strikes}" >"${DATA_STRIKES_FILE}"
  log "aircraft API returned no JSON data (${strikes}/3)"
  if [ "${strikes}" -ge 3 ]; then
    # Soft-reload the tab (page-heal) — API may be fine while SPA is stuck empty.
    log "aircraft API returned no JSON data (${strikes}/3) — soft page heal"
    if [ -x /usr/local/sbin/planes-kiosk-page-heal.py ]; then
      PLANES_KIOSK_PAGE_HEAL_FORCE=1 python3 /usr/local/sbin/planes-kiosk-page-heal.py 2>&1 \
        | logger -t planes-kiosk-watch || true
    fi
    echo 0 >"${DATA_STRIKES_FILE}" 2>/dev/null || true
  fi
else
  echo 0 >"${DATA_STRIKES_FILE}" 2>/dev/null || true
fi

cpu_max="$(renderer_cpu_max)"
gpu_max="$(gpu_cpu_max)"
if [ "${cpu_max}" -ge "${CPU_HIGH}" ] || [ "${gpu_max}" -ge "${GPU_CPU_HIGH}" ]; then
  strikes="$(cat "${CPU_STRIKES_FILE}" 2>/dev/null || echo 0)"
  strikes=$((strikes + 1))
  echo "${strikes}" >"${CPU_STRIKES_FILE}"
  log "high kiosk CPU renderer=${cpu_max}% gpu=${gpu_max}% (strike ${strikes}/${CPU_STRIKES_NEEDED})"
  if [ "${strikes}" -ge "${CPU_STRIKES_NEEDED}" ]; then
    log "high kiosk CPU renderer=${cpu_max}% gpu=${gpu_max}% — renice only (no reload)"
    while read -r pid; do
      [ -z "${pid}" ] && continue
      renice -n 15 -p "${pid}" >/dev/null 2>&1 || true
    done < <(pgrep -f "${KIOSK_MATCH}" 2>/dev/null || true)
    echo 0 >"${CPU_STRIKES_FILE}" 2>/dev/null || true
  fi
else
  echo 0 >"${CPU_STRIKES_FILE}" 2>/dev/null || true
fi

# Soft-heal about:blank / empty app-root without killing Chromium (no bedroom flash).
if [ "${internet_up}" -eq 1 ] && [ -x /usr/local/sbin/planes-kiosk-page-heal.py ]; then
  python3 /usr/local/sbin/planes-kiosk-page-heal.py 2>&1 | logger -t planes-kiosk-watch || true
elif [ "${internet_up}" -eq 1 ] && [ -x /home/pi/bin/planes-kiosk-page-heal.py ]; then
  python3 /home/pi/bin/planes-kiosk-page-heal.py 2>&1 | logger -t planes-kiosk-watch || true
fi

yield_kiosk_to_balcony
