#!/usr/bin/env python3
"""Merge exported Firestore deviceTokens into the Pi planes-api local store."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
DEFAULT_EXPORT = SCRIPT_DIR / "firestore-export-deviceTokens.json"
REMOTE_STORE = "/home/pi/planes-api/data/planes-api-store.json"
DEVICE_COLLECTION = "deviceTokens"

sys.path.insert(0, str(REPO_ROOT.parent / "directory" / "scripts"))
from pi_dryl_common import connect_pi, load_manifest, run_remote, pi_settings  # noqa: E402


def load_export(path: Path) -> list[dict]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise SystemExit(f"[fail] expected JSON array in {path}")
    return payload


def merge_tokens(store: dict, docs: list[dict]) -> tuple[dict, int]:
    collection = store.setdefault(DEVICE_COLLECTION, {})
    added = 0
    for entry in docs:
        doc_id = entry.get("id")
        data = entry.get("data")
        if not doc_id or not isinstance(data, dict):
            continue
        if doc_id not in collection:
            added += 1
        collection[doc_id] = data
    return store, added


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--export",
        type=Path,
        default=DEFAULT_EXPORT,
        help="firestore-export-deviceTokens.json path",
    )
    args = parser.parse_args()
    if not args.export.is_file():
        raise SystemExit(f"[fail] export not found: {args.export}")

    docs = load_export(args.export)
    if not docs:
        print("[warn] export is empty — nothing to import")
        return

    manifest = load_manifest()
    host, user, _ = pi_settings(manifest)
    client = connect_pi(host, user)

    raw = run_remote(client, f"cat {REMOTE_STORE}", timeout=30)
    try:
        store = json.loads(raw)
    except json.JSONDecodeError:
        store = {}

    merged, added = merge_tokens(store, docs)
    payload = json.dumps(merged, indent=2)
    staging = "/home/pi/.dryl-deploy/planes-api-store.json"
    sftp = client.open_sftp()
    with sftp.file(staging, "w") as remote_file:
        remote_file.write(payload)
    sftp.close()

    run_remote(client, f"cp {staging} {REMOTE_STORE}")
    run_remote(client, "sudo systemctl restart planes-api.service", sudo=True)
    health = run_remote(
        client,
        "curl -s --retry 5 --retry-delay 2 --retry-connrefused http://127.0.0.1:8795/health",
        timeout=60,
    ).strip()
    if '"ok"' not in health:
        raise SystemExit(f"[fail] planes-api health after import: {health}")

    count = len(merged.get(DEVICE_COLLECTION, {}))
    print(f"[ok] imported {len(docs)} docs ({added} new) — store now has {count} device token(s)")
    client.close()


if __name__ == "__main__":
    main()