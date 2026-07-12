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


def deploy(skip_build: bool = False, skip_nginx: bool = False) -> None:
    if not skip_build:
        build_functions()

    host, user, _ = magicmirror_settings()
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

    env_local = FUNCTIONS_DIR / ".env"
    if env_local.is_file():
        sftp.put(str(env_local), f"{STAGING}/.env")
    else:
        print("[warn] functions/.env missing — Pushover token must exist on Pi")

    run_remote(
        client,
        f"cp -a {STAGING}/. {REMOTE_ROOT}/",
    )
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
    print(health)
    client.close()
    print("[ok] planes-api deployed and healthy on :8795")

    if skip_nginx:
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
    args = parser.parse_args()
    _ = load_manifest()
    deploy(skip_build=args.skip_build, skip_nginx=args.skip_nginx)


if __name__ == "__main__":
    main()
