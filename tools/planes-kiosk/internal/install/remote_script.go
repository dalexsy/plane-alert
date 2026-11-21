package install

import (
	"fmt"
	"strings"
)

func installRemoteScript(gateway string, launch bool) string {
	lines := []string{
		"set -euo pipefail",
		"mkdir -p /home/pi/bin /home/pi/.config/autostart /home/pi/.config/systemd/user /home/pi/.config/planes-kiosk/alerts",
		"for f in planes-kiosk.sh planes-kiosk-restart.sh planes-kiosk-watch.sh planes-kiosk-alert-play.sh kiosk-watchdog.sh; do",
		"  sed -i 's/\\r$//' /tmp/$f",
		"done",
		"install -m 755 /tmp/planes-kiosk.sh /home/pi/bin/planes-kiosk.sh",
		"install -m 755 /tmp/planes-kiosk-session /home/pi/bin/planes-kiosk-session",
		"install -m 755 /tmp/planes-kiosk-alert-listen /home/pi/bin/planes-kiosk-alert-listen",
		"install -m 755 /tmp/planes-kiosk-alert-play.sh /home/pi/bin/planes-kiosk-alert-play.sh",
		"sudo install -m 755 /tmp/planes-kiosk-page-heal /usr/local/sbin/planes-kiosk-page-heal",
		"sudo install -m 755 /tmp/planes-kiosk-restart.sh /usr/local/sbin/planes-kiosk-restart.sh",
		"sudo install -m 755 /tmp/planes-kiosk-watch.sh /usr/local/sbin/planes-kiosk-watch.sh",
		"sudo rm -f /usr/local/sbin/planes-kiosk-page-heal.py /home/pi/bin/planes-kiosk-page-heal.py",
		"sudo rm -f /home/pi/bin/planes-kiosk-session.py /home/pi/bin/planes-kiosk-alert-listen.py",
		"install -m 755 /tmp/kiosk-watchdog.sh /home/pi/kiosk-watchdog.sh",
		"install -m 644 /tmp/kiosk-watchdog.service /home/pi/.config/systemd/user/kiosk-watchdog.service",
		"install -m 644 /tmp/planes-kiosk.desktop /home/pi/.config/autostart/planes-kiosk.desktop",
		"install -m 644 /tmp/planes-kiosk.service /home/pi/.config/systemd/user/planes-kiosk.service",
		"install -m 644 /tmp/planes-kiosk-alert.service /home/pi/.config/systemd/user/planes-kiosk-alert.service",
		"install -m 644 /tmp/credentials.env.example /home/pi/.config/planes-kiosk/credentials.env.example",
		"install -m 644 /tmp/alert-play.env.example /home/pi/.config/planes-kiosk/alert-play.env.example",
		"if [ -d /tmp/kiosk-alerts ]; then install -m 644 /tmp/kiosk-alerts/*.mp3 /home/pi/.config/planes-kiosk/alerts/ || true; fi",
		"if [ ! -f /home/pi/.config/planes-kiosk/alert-play.env ]; then",
		"  TOKEN=$(openssl rand -hex 24)",
		"  printf '%s\\n' \"PLANES_KIOSK_PLAY_TOKEN=$TOKEN\" \\",
		"    'PLANES_KIOSK_ALERT_LISTEN_PORT=8796' \\",
		"    'PLANES_KIOSK_ALERTS_DIR=/home/pi/planes-api/assets/alerts' \\",
		"    'PLANES_KIOSK_PWPLAY_VOLUME=0.7' \\",
		"    > /home/pi/.config/planes-kiosk/alert-play.env",
		"  chmod 600 /home/pi/.config/planes-kiosk/alert-play.env",
		"  echo ALERT_PLAY_ENV_CREATED",
		"fi",
		"chown -R pi:pi /home/pi/.config/planes-kiosk /home/pi/bin/planes-kiosk-session /home/pi/bin/planes-kiosk-alert-listen /home/pi/bin/planes-kiosk-alert-play.sh /home/pi/.config/systemd/user/planes-kiosk-alert.service",
		fmt.Sprintf("sed -i 's/PLANES_KIOSK_WATCH_GATEWAY=192.168.178.1/PLANES_KIOSK_WATCH_GATEWAY=%s/' /tmp/planes-kiosk-watch.service", gateway),
		"sudo cp /tmp/planes-kiosk-watch.service /etc/systemd/system/planes-kiosk-watch.service",
		"sudo cp /tmp/planes-kiosk-watch.timer /etc/systemd/system/planes-kiosk-watch.timer",
		"sudo systemctl daemon-reload",
		"sudo systemctl enable --now planes-kiosk-watch.timer",
		"sudo -u pi XDG_RUNTIME_DIR=/run/user/$(id -u pi) DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$(id -u pi)/bus systemctl --user daemon-reload",
		"sudo -u pi XDG_RUNTIME_DIR=/run/user/$(id -u pi) DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$(id -u pi)/bus systemctl --user enable planes-kiosk.service",
		"sudo -u pi XDG_RUNTIME_DIR=/run/user/$(id -u pi) DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$(id -u pi)/bus systemctl --user enable --now kiosk-watchdog.service",
		"sudo -u pi XDG_RUNTIME_DIR=/run/user/$(id -u pi) DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$(id -u pi)/bus systemctl --user enable --now planes-kiosk-alert.service",
		"systemctl is-active planes-kiosk-watch.timer",
		"/home/pi/bin/planes-kiosk-alert-listen --self-test",
		"/home/pi/bin/planes-kiosk-alert-play.sh --self-test || true",
		"sudo systemctl disable --now planes-api.service >/dev/null 2>&1 || true",
		"echo '[kiosk-alert] leftover planes-api.service on .74 left disabled'",
	}
	if launch {
		lines = append(lines, "/usr/local/sbin/planes-kiosk-restart.sh || true")
	}
	return strings.Join(lines, "\n")
}
