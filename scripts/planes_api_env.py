#!/usr/bin/env python3
"""Preserve dryl-prod planes-api .env across deploy:fast copies.

Local functions/.env must never replace the Pi file. Keys that live only on
the host (PLANES_KIOSK_PLAY_TOKEN, PLANES_KIOSK_PLAY_URL, Pushover) stay.
"""
from __future__ import annotations

import re
import shutil
import tempfile
from pathlib import Path

REMOTE_ROOT = "/home/pi/planes-api"
STAGING = "/home/pi/.dryl-deploy/planes-api"
REMOTE_ENV = f"{REMOTE_ROOT}/.env"
STAGING_ENV = f"{STAGING}/.env"
ENV_BACKUP = "/home/pi/.dryl-deploy/planes-api.env.predeploy"

PROTECTED_ENV_KEYS = frozenset(
    {
        "PLANES_KIOSK_PLAY_TOKEN",
        "PLANES_KIOSK_PLAY_URL",
        "PUSHOVER_API_TOKEN",
        "PUSHOVER_USER_KEY",
        "PUSHOVER_TOKEN",
        "PUSHOVER_USER",
    }
)

_SFTP_PUT_ENV = re.compile(
    r"""sftp\.put\s*\([^)]*\.env""",
    re.IGNORECASE,
)


def parse_env_entries(text: str) -> list[tuple[str | None, str]]:
    """Return (key-or-None, raw-line) pairs. Blank/comment lines have no key."""
    entries: list[tuple[str | None, str]] = []
    for raw in text.splitlines():
        stripped = raw.strip()
        if not stripped or stripped.startswith("#") or "=" not in raw:
            entries.append((None, raw))
            continue
        key = raw.split("=", 1)[0].strip()
        if not key or key.startswith("#"):
            entries.append((None, raw))
            continue
        entries.append((key, raw))
    return entries


def env_key_values(text: str) -> dict[str, str]:
    values: dict[str, str] = {}
    for key, raw in parse_env_entries(text):
        if key is None:
            continue
        values[key] = raw.split("=", 1)[1]
    return values


def merge_env_texts(pi_text: str, local_text: str) -> str:
    """Keep every existing Pi key; add only keys that are missing locally.

    Never replace PLANES_KIOSK_PLAY_TOKEN / PLAY_URL / Pushover keys that
    already exist on the host — those are included in "every existing Pi key".
    """
    kept_keys: set[str] = set()
    lines: list[str] = []
    for key, raw in parse_env_entries(pi_text):
        lines.append(raw)
        if key is not None:
            kept_keys.add(key)
    for key, raw in parse_env_entries(local_text):
        if key is None:
            continue
        if key in kept_keys:
            continue
        if key in PROTECTED_ENV_KEYS and key in kept_keys:
            continue
        lines.append(raw)
        kept_keys.add(key)
    if not lines:
        return ""
    return "\n".join(lines) + "\n"


def would_upload_local_env_to_staging() -> bool:
    """Install must never sftp.put functions/.env into STAGING."""
    return False


def resolve_env_after_copy(
    *,
    pi_env: str | None,
    local_env: str | None,
    staging_env: str | None,
) -> str | None:
    """Live .env after `cp -a STAGING/. REMOTE_ROOT/` plus preserve/restore.

    Staging .env is ignored (unlinked / restored). Existing Pi text wins.
    Local is used only to seed a missing Pi file, via merge into empty.
    """
    del staging_env  # never applied over a pre-existing Pi .env
    if pi_env is not None:
        return pi_env
    if local_env is None:
        return None
    return merge_env_texts("", local_env)


def backup_remote_env_cmd(
    remote_env: str = REMOTE_ENV,
    backup: str = ENV_BACKUP,
) -> str:
    return f"""
python3 - <<'PY'
from pathlib import Path
import shutil
remote = Path({remote_env!r})
backup = Path({backup!r})
backup.parent.mkdir(parents=True, exist_ok=True)
if remote.is_file():
    shutil.copy2(remote, backup)
    print("BACKED_UP_PREDEPLOY_ENV")
else:
    if backup.exists():
        backup.unlink()
    print("NO_PREDEPLOY_ENV")
PY
""".strip()


def restore_remote_env_cmd(
    remote_env: str = REMOTE_ENV,
    backup: str = ENV_BACKUP,
    staging_env: str = STAGING_ENV,
) -> str:
    return f"""
python3 - <<'PY'
from pathlib import Path
import shutil
remote = Path({remote_env!r})
backup = Path({backup!r})
staging = Path({staging_env!r})
if staging.exists():
    staging.unlink()
    print("REMOVED_STAGING_ENV")
if backup.is_file():
    remote.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(backup, remote)
    print("RESTORED_PREDEPLOY_ENV")
else:
    print("NO_PREDEPLOY_ENV_TO_RESTORE")
PY
""".strip()


def apply_env_preserve_to_dirs(
    remote_dir: Path,
    staging_dir: Path,
    local_env: Path | None,
) -> None:
    """Local-filesystem mirror of the install script's .env steps.

    Used by the gate so a second simulated deploy:fast cannot drop
    PLANES_KIOSK_PLAY_TOKEN from a pre-existing Pi .env.
    """
    remote_dir.mkdir(parents=True, exist_ok=True)
    staging_dir.mkdir(parents=True, exist_ok=True)
    remote_env = remote_dir / ".env"
    staging_env = staging_dir / ".env"
    backup = remote_dir.parent / "planes-api.env.predeploy"

    if staging_env.exists():
        staging_env.unlink()

    if remote_env.is_file():
        shutil.copy2(remote_env, backup)
    elif backup.exists():
        backup.unlink()

    for item in staging_dir.iterdir():
        dest = remote_dir / item.name
        if item.is_dir():
            shutil.copytree(item, dest, dirs_exist_ok=True)
        else:
            shutil.copy2(item, dest)

    if staging_env.exists():
        staging_env.unlink()
    if backup.is_file():
        shutil.copy2(backup, remote_env)
        return
    if local_env is not None and local_env.is_file() and not remote_env.is_file():
        shutil.copy2(local_env, remote_env)


def assert_install_source_never_puts_env(source: str) -> None:
    """Fail if the install script would upload or land .env in STAGING."""
    for lineno, raw in enumerate(source.splitlines(), 1):
        code = raw.split("#", 1)[0]
        if not code.strip():
            continue
        if _SFTP_PUT_ENV.search(code):
            dest = code.lower()
            allowed_seed = "env.seed" in dest or "env.predeploy" in dest
            if not allowed_seed:
                raise AssertionError(
                    f"line {lineno}: sftp.put of .env is forbidden "
                    f"(never upload functions/.env over the Pi file): {raw.strip()}"
                )
        if "sftp.put" in code and "STAGING" in code and ".env" in code:
            raise AssertionError(
                f"line {lineno}: must not sftp.put .env into STAGING: {raw.strip()}"
            )
        if re.search(r"""f["'].*STAGING.*/\.env""", code):
            if "unlink" in code or "rm " in code or "rm -f" in source:
                # allow only in restore/remove helpers, not as an sftp dest
                if "sftp.put" in code:
                    raise AssertionError(
                        f"line {lineno}: STAGING/.env sftp destination: {raw.strip()}"
                    )
            elif "sftp.put" in code:
                raise AssertionError(
                    f"line {lineno}: writes STAGING/.env: {raw.strip()}"
                )


def assert_install_source_restores_env(source: str) -> None:
    if "cp -a" not in source or "STAGING" not in source:
        raise AssertionError("install script must still copy STAGING into REMOTE_ROOT")
    if "RESTORED_PREDEPLOY_ENV" not in source and "restore_remote_env_cmd" not in source:
        raise AssertionError(
            "after cp -a STAGING/. REMOTE_ROOT/, restore the pre-deploy Pi .env"
        )
    if "BACKED_UP_PREDEPLOY_ENV" not in source and "backup_remote_env_cmd" not in source:
        raise AssertionError("backup the Pi .env before the staging copy")


def _read_install_source() -> str:
    return (Path(__file__).resolve().parent / "pi-install-planes-api.py").read_text(
        encoding="utf-8"
    )


def self_test() -> None:
    source = _read_install_source()
    assert_install_source_never_puts_env(source)
    assert_install_source_restores_env(source)
    assert would_upload_local_env_to_staging() is False

    pi = (
        "PLANES_KIOSK_PLAY_TOKEN=keep-token\n"
        "PLANES_KIOSK_PLAY_URL=http://192.168.178.74:8796/play\n"
        "PUSHOVER_API_TOKEN=pi-push\n"
        "HOST_ONLY=1\n"
    )
    local = (
        "PLANES_KIOSK_PLAY_TOKEN=laptop-token\n"
        "PUSHOVER_API_TOKEN=laptop-push\n"
        "NEW_FROM_LOCAL=1\n"
    )
    merged = merge_env_texts(pi, local)
    values = env_key_values(merged)
    assert values["PLANES_KIOSK_PLAY_TOKEN"] == "keep-token"
    assert values["PLANES_KIOSK_PLAY_URL"] == "http://192.168.178.74:8796/play"
    assert values["PUSHOVER_API_TOKEN"] == "pi-push"
    assert values["HOST_ONLY"] == "1"
    assert values["NEW_FROM_LOCAL"] == "1"
    assert "laptop-token" not in merged
    assert "laptop-push" not in merged

    kept = resolve_env_after_copy(pi_env=pi, local_env=local, staging_env=local)
    assert kept == pi
    seeded = resolve_env_after_copy(pi_env=None, local_env=local, staging_env=local)
    assert env_key_values(seeded or "")["NEW_FROM_LOCAL"] == "1"

    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        remote = root / "planes-api"
        staging = root / "staging"
        local_path = root / "functions.env"
        remote.mkdir()
        staging.mkdir()
        (remote / ".env").write_text(pi, encoding="utf-8")
        local_path.write_text(local, encoding="utf-8")
        (staging / "package.json").write_text("{}\n", encoding="utf-8")
        # Accidental staging .env must not win — unlink + restore.
        (staging / ".env").write_text(local, encoding="utf-8")
        apply_env_preserve_to_dirs(remote, staging, local_path)
        first = (remote / ".env").read_text(encoding="utf-8")
        assert env_key_values(first)["PLANES_KIOSK_PLAY_TOKEN"] == "keep-token"
        assert "HOST_ONLY=1" in first
        # Second deploy:fast with a local .env that omits the kiosk token.
        local_path.write_text("PUSHOVER_API_TOKEN=laptop-again\n", encoding="utf-8")
        (staging / ".env").write_text("PLANES_KIOSK_PLAY_TOKEN=clobber\n", encoding="utf-8")
        apply_env_preserve_to_dirs(remote, staging, local_path)
        second = (remote / ".env").read_text(encoding="utf-8")
        assert env_key_values(second)["PLANES_KIOSK_PLAY_TOKEN"] == "keep-token"
        assert "HOST_ONLY=1" in second
        assert "clobber" not in second

    try:
        assert_install_source_never_puts_env(
            'sftp.put(str(env_local), f"{STAGING}/.env")'
        )
    except AssertionError:
        pass
    else:
        raise AssertionError("gate must fail if install sftp.puts functions/.env")

    print("[ok] planes-api .env preserve gate")
    print("[ok] second deploy:fast keeps PLANES_KIOSK_PLAY_TOKEN")


if __name__ == "__main__":
    self_test()
