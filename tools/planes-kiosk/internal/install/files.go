package install

import "path/filepath"

type fileSpec struct {
	LocalRel string
	RemoteTmp string
}

func staticFiles() []fileSpec {
	base := filepath.Join("scripts", "mirror-kiosk")
	return []fileSpec{
		{filepath.Join(base, "planes-kiosk.sh"), "/tmp/planes-kiosk.sh"},
		{filepath.Join(base, "planes-kiosk-restart.sh"), "/tmp/planes-kiosk-restart.sh"},
		{filepath.Join(base, "planes-kiosk-watch.sh"), "/tmp/planes-kiosk-watch.sh"},
		{filepath.Join(base, "planes-kiosk-alert-play.sh"), "/tmp/planes-kiosk-alert-play.sh"},
		{filepath.Join(base, "kiosk-watchdog.sh"), "/tmp/kiosk-watchdog.sh"},
		{filepath.Join(base, "kiosk-watchdog.service"), "/tmp/kiosk-watchdog.service"},
		{filepath.Join(base, "planes-kiosk.desktop"), "/tmp/planes-kiosk.desktop"},
		{filepath.Join(base, "planes-kiosk.service"), "/tmp/planes-kiosk.service"},
		{filepath.Join(base, "planes-kiosk-alert.service"), "/tmp/planes-kiosk-alert.service"},
		{filepath.Join(base, "planes-kiosk-watch.service"), "/tmp/planes-kiosk-watch.service"},
		{filepath.Join(base, "planes-kiosk-watch.timer"), "/tmp/planes-kiosk-watch.timer"},
		{filepath.Join(base, "credentials.env.example"), "/tmp/credentials.env.example"},
		{filepath.Join(base, "alert-play.env.example"), "/tmp/alert-play.env.example"},
	}
}

var alertMP3s = []string{
	"precious_little_life_forms.mp3",
	"hercules.mp3",
	"iago.mp3",
}
