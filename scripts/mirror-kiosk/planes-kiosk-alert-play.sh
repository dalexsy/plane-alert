#!/usr/bin/env bash
# Play one kiosk MP3 variant on magicmirror (speaker host).
# Called by planes-kiosk-alert-listen.py — not by planes-api on dryl-prod.
set -euo pipefail

VARIANT="${1:-default}"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/1000}"
ALERTS_DIR="${PLANES_KIOSK_ALERTS_DIR:-/home/pi/.config/planes-kiosk/alerts}"

case "${VARIANT}" in
  hercules) FILE="hercules.mp3" ;;
  a400) FILE="iago.mp3" ;;
  *) FILE="precious_little_life_forms.mp3" ;;
esac

PLAYER=""
for bin in /usr/bin/pw-play /usr/bin/paplay; do
  if [[ -x "${bin}" ]]; then
    PLAYER="${bin}"
    break
  fi
done
if [[ -z "${PLAYER}" ]]; then
  echo "planes-kiosk-alert-play: no pw-play/paplay" >&2
  exit 1
fi
if [[ ! -f "${ALERTS_DIR}/${FILE}" ]]; then
  echo "planes-kiosk-alert-play: missing ${ALERTS_DIR}/${FILE}" >&2
  exit 1
fi

exec "${PLAYER}" "${ALERTS_DIR}/${FILE}"
