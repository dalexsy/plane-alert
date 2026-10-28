#!/usr/bin/env python3
"""Authorized planes.dryl.io deploy (replaces deleted run-full-deploy.mjs gate)."""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DEPLOY = REPO.parent / "directory" / "scripts" / "pi-deploy-dryl-site.py"


def main() -> None:
    if not DEPLOY.is_file():
        raise SystemExit(f"[fail] missing deploy script: {DEPLOY}")
    env = os.environ.copy()
    env["DRYL_AUTHORIZED_DEPLOY"] = "1"
    result = subprocess.run(
        [sys.executable, str(DEPLOY), "planes"],
        cwd=REPO,
        env=env,
    )
    raise SystemExit(result.returncode)


if __name__ == "__main__":
    main()
