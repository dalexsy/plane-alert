#!/usr/bin/env python3
"""Deploy Plane Alert Pi backend (replaces Firebase Cloud Functions billing)."""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
FUNCTIONS_DIR = REPO_ROOT / "functions"
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from planes_api_env import (  # noqa: E402
    REMOTE_ROOT,
    STAGING,
    backup_remote_env_cmd,
    restore_remote_env_cmd,
    self_test as env_preserve_self_test,
)

SERVICE_NAME = "planes-api.service"
NGINX_SETUP = REPO_ROOT.parent / "directory" / "scripts" / "pi-setup-dryl-host.py"


def _load_pi_common():
    scripts = REPO_ROOT.parent / "directory" / "scripts"
    if str(scripts) not in sys.path:
        sys.path.insert(0, str(scripts))
    from pi_dryl_common import (  # noqa: PLC0415
        connect_pi,
        load_manifest,
        magicmirror_settings,
        run_remote,
        staging_settings,
        upload_directory,
    )

    return {
        "connect_pi": connect_pi,
        "load_manifest": load_manifest,
        "magicmirror_settings": magicmirror_settings,
        "run_remote": run_remote,
        "staging_settings": staging_settings,
        "upload_directory": upload_directory,
    }


def run_local(cmd: list[str], cwd: Path, fail: str) -> None:
    result = subprocess.run(
        cmd,
        cwd=cwd,
        shell=sys.platform == "win32",
        check=False,
    )
    if result.returncode != 0:
        raise SystemExit(result.returncode or fail)


def is_leftover_kiosk_api_host(host: str) -> bool:
    """True for magicmirror .74 — leftover planes-api there must stay disabled."""
    name = host.strip().lower()
    return name.endswith(".74") or name == "magicmirror" or name.startswith(
        "magicmirror."
    )


def build_functions() -> None:
    shared = REPO_ROOT / "shared"
    print("[build] shared package")
    run_local(["npm", "run", "build"], shared, "[fail] shared build")

    print("[build] prepare functions shared-package")
    run_local(
        ["node", str(REPO_ROOT / "scripts" / "prepare-functions-shared.js")],
        REPO_ROOT,
        "[fail] prepare-functions-shared",
    )

    print("[build] functions TypeScript")
    run_local(["npm", "run", "build"], FUNCTIONS_DIR, "[fail] functions build")

    print("[gate] planes-api .env preserve")
    run_local(
        [sys.executable, str(SCRIPT_DIR / "planes_api_env.py")],
        REPO_ROOT,
        "[fail] planes-api .env preserve gate",
    )

    print("[gate] local transaction cooldown")
    run_local(
        ["node", str(FUNCTIONS_DIR / "scripts" / "test-local-transaction.mjs")],
        FUNCTIONS_DIR,
        "[fail] local transaction cooldown gate",
    )

    print("[gate] pushover send gate")
    run_local(
        ["node", str(FUNCTIONS_DIR / "scripts" / "test-pushover-send-gate.mjs")],
        FUNCTIONS_DIR,
        "[fail] pushover send gate",
    )

    print("[gate] row session pushover")
    run_local(
        ["node", str(FUNCTIONS_DIR / "scripts" / "test-row-session-push.mjs")],
        FUNCTIONS_DIR,
        "[fail] row session pushover",
    )

    print("[gate] kiosk alert remote play")
    run_local(
        ["node", str(FUNCTIONS_DIR / "scripts" / "test-kiosk-alert-sound.mjs")],
        FUNCTIONS_DIR,
        "[fail] kiosk alert remote play",
    )

    print("[gate] antenna sightings upsert")
    run_local(
        ["node", str(FUNCTIONS_DIR / "scripts" / "test-antenna-sightings.mjs")],
        FUNCTIONS_DIR,
        "[fail] antenna sightings upsert",
    )



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
        if key in {"PLANES_API_PUSHOVER_ENABLED", "DRYL_ENV", "PLANES_KIOSK_LOCAL_ALERT"}:
            continue
        keep.append(ln)
keep += [
    "DRYL_ENV=staging",
    "PLANES_API_PUSHOVER_ENABLED=0",
    "PLANES_KIOSK_LOCAL_ALERT=0",
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

    pi = _load_pi_common()
    connect_pi = pi["connect_pi"]
    run_remote = pi["run_remote"]
    upload_directory = pi["upload_directory"]
    host, user, _ = (
        pi["staging_settings"]() if staging else pi["magicmirror_settings"]()
    )
    if not staging and is_leftover_kiosk_api_host(host):
        raise SystemExit(
            "[fail] planes-api is dryl-prod (.79) only — do not re-enable "
            f"the leftover unit on kiosk host {host}"
        )
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

    # Never sftp.put local functions/.env — Pi keys stay on the host.
    # Staging must not contain a .env so `cp -a` cannot clobber prod.
    if (FUNCTIONS_DIR / ".env").is_file():
        print("[env] leaving Pi .env in place (local functions/.env is not uploaded)")
    else:
        print("[warn] functions/.env missing — existing Pi .env is still left in place")
    run_remote(client, f"rm -f {STAGING}/.env")
    print(run_remote(client, backup_remote_env_cmd(), timeout=30))

    run_remote(
        client,
        f"cp -a {STAGING}/. {REMOTE_ROOT}/",
    )
    print(run_remote(client, restore_remote_env_cmd(), timeout=30))
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
    expected_sha = subprocess.check_output(
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
    run_local(
        [sys.executable, str(NGINX_SETUP)],
        NGINX_SETUP.parent,
        "[fail] pi-setup-dryl-host nginx refresh",
    )


def main() -> None:
    if "--self-test" in sys.argv:
        assert is_leftover_kiosk_api_host("192.168.178.74")
        assert is_leftover_kiosk_api_host("magicmirror")
        assert is_leftover_kiosk_api_host("magicmirror.local")
        assert not is_leftover_kiosk_api_host("192.168.178.79")
        assert not is_leftover_kiosk_api_host("dryl-prod")
        print("[ok] leftover kiosk api host guard")
        env_preserve_self_test()
        return

    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-build", action="store_true")
    parser.add_argument("--skip-nginx", action="store_true")
    parser.add_argument(
        "--staging",
        action="store_true",
        help="Install on dryl-staging and mute live Pushover",
    )
    args = parser.parse_args()
    pi = _load_pi_common()
    _ = pi["load_manifest"]()
    deploy(
        skip_build=args.skip_build,
        skip_nginx=args.skip_nginx,
        staging=args.staging,
    )


if __name__ == "__main__":
    main()
