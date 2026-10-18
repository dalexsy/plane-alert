#!/usr/bin/env bash
# Auth flapping must never kill or restart a healthy kiosk. No real services touched.
set -euo pipefail
source "${1:-$(dirname "$0")/kiosk-watchdog.sh}"
log() { :; }
systemctl() { echo 'Unexpected systemctl call' >&2; exit 90; }
is_quiet_hours() { return 1; }
sleep() { :; }
if ! declare -F recover_kiosk_if_needed >/dev/null; then
  recover_kiosk_if_needed() { restart_kiosk_if_allowed; }
fi
heals=0
python3() {
  [[ "$1" == /usr/local/sbin/planes-kiosk-page-heal.py ]]
  heals=$((heals + 1))
}
for _ in $(seq 1 128); do recover_kiosk_if_needed; done
[[ "$heals" == 128 ]]
is_quiet_hours() { return 0; }
recover_kiosk_if_needed
[[ "$heals" == 128 ]]
# A failed page inspector must also leave the running browser alone.
is_quiet_hours() { return 1; }
python3() { return 1; }
recover_kiosk_if_needed
printf 'kiosk-watchdog.test.sh: PASS (128 recoveries, quiet hours, inspector failure)\n'
