#!/usr/bin/env python3
"""Confirm Jabra can play a planes alert MP3 on magicmirror."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "directory" / "scripts"))
from pi_dryl_common import connect_pi, magicmirror_settings, run_remote

host, user, _ = magicmirror_settings()
c = connect_pi(host, user)
cmd = r"""
set -e
MP3=/tmp/planes-alert-test.mp3
curl -fsSL -o "$MP3" https://planes.dryl.io/assets/alerts/tiny_little_life_forms.mp3
# Prefer mpg123 / ffplay / pw-cat
if command -v mpg123 >/dev/null 2>&1; then
  sudo -u pi XDG_RUNTIME_DIR=/run/user/1000 timeout 8 mpg123 -q "$MP3" && echo PLAY_OK_mpg123
elif command -v ffplay >/dev/null 2>&1; then
  sudo -u pi XDG_RUNTIME_DIR=/run/user/1000 timeout 8 ffplay -nodisp -autoexit -loglevel quiet "$MP3" && echo PLAY_OK_ffplay
else
  # decode to wav then pw-play
  if command -v ffmpeg >/dev/null 2>&1; then
    ffmpeg -y -i "$MP3" -f wav /tmp/planes-alert-test.wav >/dev/null 2>&1
    sudo -u pi XDG_RUNTIME_DIR=/run/user/1000 timeout 8 pw-play /tmp/planes-alert-test.wav && echo PLAY_OK_pwplay
  else
    echo NO_PLAYER
    exit 1
  fi
fi
"""
print(run_remote(c, cmd, sudo=False))
c.close()
