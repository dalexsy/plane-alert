#!/usr/bin/env python3
"""Deploy Plane Alert Pi backend (replaces Firebase Cloud Functions billing)."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
FUNCTIONS_DIR = REPO_ROOT / "functions"

sys.path.insert(0, str(REPO_ROOT.parent / "directory" / "scripts"))

from pi_dryl_common import (  # noqa: E402
    connect_pi,
    load_manifest,
    magicmirror_settings,
    run_remote,
    run_subprocess,
    staging_settings,
    upload_directory,
)

REMOTE_ROOT = "/home/pi/planes-api"
STAGING = "/home/pi/.dryl-deploy/planes-api"
SERVICE_NAME = "planes-api.service"
NGINX_SETUP = REPO_ROOT.parent / "directory" / "scripts" / "pi-setup-dryl-host.py"


def build_functions() -> None:
    shared = REPO_ROOT / "shared"
    print("[build] shared package")
    result = run_subprocess(
        ["npm", "run", "build"],
        cwd=shared,
        shell=sys.platform == "win32",
    )
    if result.returncode != 0:
        raise SystemExit(result.returncode or "[fail] shared build")

    print("[build] prepare functions shared-package")
    result = run_subprocess(
        ["node", str(REPO_ROOT / "scripts" / "prepare-functions-shared.js")],
        cwd=REPO_ROOT,
        shell=sys.platform == "win32",
    )
    if result.returncode != 0:
        raise SystemExit(result.returncode or "[fail] prepare-functions-shared")

    print("[build] functions TypeScript")
    result = run_subprocess(
        ["npm", "run", "build"],
        cwd=FUNCTIONS_DIR,
        shell=sys.platform == "win32",
    )
    if result.returncode != 0:
        raise SystemExit(result.returncode or "[fail] functions build")

    print("[gate] local transaction cooldown")
    result = run_subprocess(
        ["node", str(FUNCTIONS_DIR / "scripts" / "test-local-transaction.mjs")],
        cwd=FUNCTIONS_DIR,
        shell=sys.platform == "win32",
    )
    if result.returncode != 0:
        raise SystemExit(
            result.returncode or "[fail] local transaction cooldown gate"
        )

    print("[gate] pushover send gate")
    result = run_subprocess(
        ["node", str(FUNCTIONS_DIR / "scripts" / "test-pushover-send-gate.mjs")],
        cwd=FUNCTIONS_DIR,
        shell=sys.platform == "win32",
    )
    if result.returncode != 0:
        raise SystemExit(result.returncode or "[fail] pushover send gate")

    print("[gate] row session pushover")
    result = run_subprocess(
        ["node", str(FUNCTIONS_DIR / "scripts" / "test-row-session-push.mjs")],
        cwd=FUNCTIONS_DIR,
        shell=sys.platform == "win32",
    )
    if result.returncode != 0:
        raise SystemExit(result.returncode or "[fail] row session pushover")


def sanitize_staging_env_cmd() -> str:
    return r"""
python3 - <<'PY'
from pathlib import Path
p = Path("/home/pi/planes-api/.env")
p.parent.mkdir(parents=True, exist_ok=True)
keep = []
if p.exists():
    for ln in p.read_text(encoding="utf-8").splitlines():
        key = ln.split("=", 1)[0].strip()
        if key in {"PLANES_API_PUSHOVER_ENABLED", "DRYL_ENV"}:
            continue
        keep.append(ln)
keep += [
    "DRYL_ENV=staging",
    "PLANES_API_PUSHOVER_ENABLED=0",
]
p.write_text("\n".join(keep) + "\n", encoding="utf-8")
print("SANITIZED_ENV_OK")
PY
""".strip()


def deploy(
    skip_build: bool = False,
    skip_nginx: bool = False,
    staging: bool = False,
) -> None:
    if not skip_build:
        build_functions()

    host, user, _ = staging_settings() if staging else magicmirror_settings()
    print(f"[upload] planes-api -> {host}:{REMOTE_ROOT}")

    client = connect_pi(host, user)
    run_remote(client, f"mkdir -p {REMOTE_ROOT}/data")
    run_remote(client, f"rm -rf {STAGING} && mkdir -p {STAGING}/lib {STAGING}/shared-package")

    sftp = client.open_sftp()
    for rel in ("package.json", "package-lock.json"):
        local = FUNCTIONS_DIR / rel
        if local.is_file():
            sftp.put(str(local), f"{STAGING}/{rel}")

    sftp.put(str(SCRIPT_DIR / "planes-api.service"), f"{STAGING}/planes-api.service")
    upload_directory(sftp, FUNCTIONS_DIR / "lib", f"{STAGING}/lib")
    upload_directory(sftp, FUNCTIONS_DIR / "shared-package", f"{STAGING}/shared-package")

    # Kiosk PipeWire chimes (one of: default mil / Hercules / A400). SPA is muted on ?kiosk=1.
    alerts_src = REPO_ROOT / "src" / "assets" / "alerts"
    alert_names = (
        "precious_little_life_forms.mp3",
        "hercules.mp3",
        "iago.mp3",
    )
    run_remote(client, f"mkdir -p {STAGING}/assets/alerts")
    for name in alert_names:
        alert_mp3 = alerts_src / name
        if alert_mp3.is_file():
            sftp.put(str(alert_mp3), f"{STAGING}/assets/alerts/{name}")
        else:
            print(f"[warn] missing kiosk alert mp3: {alert_mp3}")

    # SPA-parity mil lookup (aircraftDb.mil + military-prefixes) for Pi chime.
    run_remote(client, f"mkdir -p {STAGING}/data")
    mil_db = FUNCTIONS_DIR / "src" / "data" / "military-aircraft-db.json"
    if mil_db.is_file():
        sftp.put(str(mil_db), f"{STAGING}/data/{mil_db.name}")
    else:
        print(f"[warn] missing military aircraft db: {mil_db}")
    spa_prefixes = REPO_ROOT / "src" / "assets" / "military-prefixes.json"
    if spa_prefixes.is_file():
        sftp.put(str(spa_prefixes), f"{STAGING}/data/{spa_prefixes.name}")
    else:
        print(f"[warn] missing SPA military prefixes: {spa_prefixes}")
    # Drop edge-trigger state that blocked retries after failed/silent pw-play.
    run_remote(
        client,
        f"rm -f {REMOTE_ROOT}/data/kiosk-chime-in-range-state.json "
        f"{STAGING}/data/kiosk-chime-in-range-state.json",
    )

    for build_info in (
        FUNCTIONS_DIR / "build-info.json",
        FUNCTIONS_DIR / "lib" / "build-info.json",
    ):
        if build_info.is_file():
            sftp.put(str(build_info), f"{STAGING}/{build_info.name}")
            sftp.put(str(build_info), f"{STAGING}/lib/build-info.json")

    env_local = FUNCTIONS_DIR / ".env"
    if staging:
        print("[staging] skipping live Pushover .env — will sanitize on host")
    elif env_local.is_file():
        sftp.put(str(env_local), f"{STAGING}/.env")
    else:
        print("[warn] functions/.env missing — Pushover token must exist on Pi")

    run_remote(
        client,
        f"cp -a {STAGING}/. {REMOTE_ROOT}/",
    )
    if staging:
        print(run_remote(client, sanitize_staging_env_cmd(), timeout=30))
    # npm can keep stale `file:` deps around (esp. @plane-alert/shared).
    # Force a reinstall so new shared exports land on the Pi.
    run_remote(client, f"rm -rf {REMOTE_ROOT}/node_modules/@plane-alert/shared")
    run_remote(client, f"cd {REMOTE_ROOT} && npm install --omit=dev")
    run_remote(
        client,
        f"sudo cp {REMOTE_ROOT}/planes-api.service /etc/systemd/system/{SERVICE_NAME}",
        sudo=True,
    )
    run_remote(client, "sudo systemctl daemon-reload", sudo=True)
    run_remote(client, f"sudo systemctl enable {SERVICE_NAME}", sudo=True)
    run_remote(client, f"sudo systemctl restart {SERVICE_NAME}", sudo=True)
    health = run_remote(
        client,
        "curl -s --retry 5 --retry-delay 2 --retry-connrefused http://127.0.0.1:8795/health",
        timeout=60,
    ).strip()
    if '"ok"' not in health:
        raise SystemExit(f"[fail] planes-api health: {health}")
    compact = health.replace(" ", "")
    if staging and '"pushoverSendEnabled":false' not in compact:
        raise SystemExit(
            f"[fail] staging planes-api still allows Pushover:\n{health}"
        )
    if not staging and '"pushoverSendEnabled":false' in compact:
        raise SystemExit(
            f"[fail] prod planes-api muted Pushover unexpectedly:\n{health}"
        )
    print(health)
    import subprocess as _sp

    expected_sha = _sp.check_output(
        ["git", "rev-parse", "HEAD"],
        cwd=REPO_ROOT,
        text=True,
    ).strip()
    if expected_sha and expected_sha not in health and expected_sha[:12] not in health:
        raise SystemExit(
            f"[fail] planes-api health gitSha mismatch — live health does not contain "
            f"HEAD {expected_sha[:12]}. Stale binary would miss cool-plane alerts.\n{health}"
        )
    client.close()
    print("[ok] planes-api deployed and healthy on :8795")

    if skip_nginx or staging:
        return

    print("[nginx] refresh dryl-apps.conf (planes /api/planes/ proxy)")
    result = run_subprocess(
        [sys.executable, str(NGINX_SETUP)],
        cwd=NGINX_SETUP.parent,
        shell=False,
    )
    if result.returncode != 0:
        raise SystemExit(result.returncode or "[fail] pi-setup-dryl-host nginx refresh")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-build", action="store_true")
    parser.add_argument("--skip-nginx", action="store_true")
    parser.add_argument(
        "--staging",
        action="store_true",
        help="Install on dryl-staging and mute live Pushover",
    )
    args = parser.parse_args()
    _ = load_manifest()
    deploy(
        skip_build=args.skip_build,
        skip_nginx=args.skip_nginx,
        staging=args.staging,
    )


if __name__ == "__main__":
    main()
