#!/usr/bin/env python3
"""Merge exported Firestore collections into the Pi planes-api local store."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
REMOTE_STORE = "/home/pi/planes-api/data/planes-api-store.json"

DEFAULT_COLLECTIONS = (
    "deviceTokens",
    "military-history",
    "notification-cooldowns",
)

sys.path.insert(0, str(REPO_ROOT.parent / "directory" / "scripts"))
from pi_dryl_common import connect_pi, load_manifest, run_remote, pi_settings  # noqa: E402


def load_export(path: Path) -> list[dict]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise SystemExit(f"[fail] expected JSON array in {path}")
    return payload


def merge_collection(
    store: dict,
    collection: str,
    docs: list[dict],
) -> int:
    bucket = store.setdefault(collection, {})
    added = 0
    for entry in docs:
        doc_id = entry.get("id")
        data = entry.get("data")
        if not doc_id or not isinstance(data, dict):
            continue
        if doc_id not in bucket:
            added += 1
        bucket[doc_id] = data
    return added


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--collection",
        action="append",
        dest="collections",
        help="collection name (repeatable); defaults to all household collections",
    )
    args = parser.parse_args()
    collections = tuple(args.collections or DEFAULT_COLLECTIONS)

    manifest = load_manifest()
    host, user, _ = pi_settings(manifest)
    client = connect_pi(host, user)

    raw = run_remote(client, f"cat {REMOTE_STORE}", timeout=30)
    try:
        store = json.loads(raw)
    except json.JSONDecodeError:
        store = {}

    summary: list[str] = []
    for collection in collections:
        export_path = SCRIPT_DIR / f"firestore-export-{collection}.json"
        if not export_path.is_file():
            print(f"[warn] skip {collection}: missing {export_path.name}")
            continue
        docs = load_export(export_path)
        added = merge_collection(store, collection, docs)
        total = len(store.get(collection, {}))
        summary.append(f"{collection}: +{added} ({total} total)")

    payload = json.dumps(store, indent=2)
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

    print("[ok] imported collections")
    for line in summary:
        print(f"  {line}")
    client.close()


if __name__ == "__main__":
    main()