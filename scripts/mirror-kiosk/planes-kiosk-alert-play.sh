#!/usr/bin/env bash
# Play one kiosk MP3 on magicmirror (.74) to the Jabra SPEAK 510.
# planes-api is dryl-prod (.79) only — leftover planes-api.service on .74
# stays disabled. This script is the audio-local path (LAN listener).
# Proven: pw-play --volume=0.7 /home/pi/planes-api/assets/alerts/hercules.mp3
# Sink: wpctl default = Jabra SPEAK 510 Analog Stereo. Not HDMI. Not pactl.
set -euo pipefail

PRINT_CMD=0
if [[ "${1:-}" == "--print-cmd" ]]; then
  PRINT_CMD=1
  shift
elif [[ "${1:-}" == "--self-test" ]]; then
  SELF_DIR="$(cd "$(dirname "$0")" && pwd)"
  REPO_ALERTS="$(cd "${SELF_DIR}/../../src/assets/alerts" && pwd)"
  out="$(
    PLANES_KIOSK_ALERTS_DIR="${REPO_ALERTS}" \
    PLANES_KIOSK_PWPLAY="/usr/bin/pw-play" \
    PLANES_KIOSK_WPCTL="/bin/true" \
    "$0" --print-cmd hercules
  )"
  case "${out}" in
    "/usr/bin/pw-play --volume=0.7 ${REPO_ALERTS}/hercules.mp3") ;;
    *)
      echo "planes-kiosk-alert-play self-test failed: ${out}" >&2
      exit 1
      ;;
  esac
  echo "[ok] planes-kiosk-alert-play self-test"
  exit 0
fi

VARIANT="${1:-default}"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/1000}"
VOLUME="${PLANES_KIOSK_PWPLAY_VOLUME:-0.7}"
PLAYER="${PLANES_KIOSK_PWPLAY:-/usr/bin/pw-play}"

case "${VARIANT}" in
  hercules) FILE="hercules.mp3" ;;
  a400) FILE="iago.mp3" ;;
  *) FILE="precious_little_life_forms.mp3" ;;
esac

resolve_mp3() {
  local dir
  for dir in \
    "${PLANES_KIOSK_ALERTS_DIR:-}" \
    "/home/pi/planes-api/assets/alerts" \
    "/home/pi/.config/planes-kiosk/alerts"
  do
    [[ -n "${dir}" && -f "${dir}/${FILE}" ]] || continue
    printf '%s\n' "${dir}/${FILE}"
    return 0
  done
  return 1
}

ensure_jabra_default() {
  local wpctl="${PLANES_KIOSK_WPCTL:-/usr/bin/wpctl}"
  [[ -x "${wpctl}" ]] || return 0
  local status line id
  status="$("${wpctl}" status 2>/dev/null || true)"
  line="$(printf '%s\n' "${status}" | grep -F 'Jabra SPEAK 510 Analog Stereo' | head -n 1 || true)"
  [[ -n "${line}" ]] || return 0
  id="$(printf '%s\n' "${line}" | sed -n 's/^[^0-9]*\([0-9][0-9]*\)\. Jabra SPEAK 510 Analog Stereo.*/\1/p')"
  [[ -n "${id}" ]] || return 0
  "${wpctl}" set-default "${id}" >/dev/null 2>&1 || true
}

MP3="$(resolve_mp3 || true)"
if [[ -z "${MP3}" ]]; then
  echo "planes-kiosk-alert-play: missing ${FILE} (leftover planes-api assets or kiosk alerts dir)" >&2
  exit 1
fi

if [[ "${PRINT_CMD}" == "1" ]]; then
  printf '%s --volume=%s %s\n' "${PLAYER}" "${VOLUME}" "${MP3}"
  exit 0
fi

if [[ ! -x "${PLAYER}" ]]; then
  echo "planes-kiosk-alert-play: ${PLAYER} missing (kiosk-only; prod has aplay only)" >&2
  exit 1
fi

ensure_jabra_default
exec "${PLAYER}" --volume="${VOLUME}" "${MP3}"
