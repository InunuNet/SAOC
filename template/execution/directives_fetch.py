#!/usr/bin/env python3
"""Isolated `gh` transport for the directive channel (spec directive-channel, F1).

This module exists ONLY so that ``execution/directives.py`` -- the file that
parses text written in another repository -- contains no execution primitive at
all (SPEC section 6, T4). The split is the security property:

  * ``directives.py`` reads untrusted content and can run nothing.
  * ``directives_fetch.py`` runs something and is never handed untrusted content.

Nothing directive-derived reaches a command line here. The only inputs to the
shell-out are constants (the pinned repo, the fixed directory path) and the
workspace root. Filenames come back from the GitHub API, so they are validated
against a strict pattern and used only as path components under the local
directives directory -- never as arguments to a command, never through a shell
(``shell=True`` is not used anywhere in this file).
"""

from __future__ import annotations

import base64
import binascii
import json
import re
import subprocess
import sys
from pathlib import Path

ATHANOR_REPO = "InunuNet/Athanor"
REMOTE_DIR = ".agent/directives"
LOCAL_DIR = ".agent/directives"
REF = "main"

# Only files that look exactly like a directive are ever written to disk. A
# remote listing is data from the network: it does not get to choose a path.
SAFE_NAME_RE = re.compile(r"^ATH-\d{8}-[a-z0-9]+(?:-[a-z0-9]+)*\.md$")

GH_TIMEOUT_SECONDS = 30
MAX_FILE_BYTES = 256 * 1024


class FetchError(Exception):
    """The transport could not complete. Never fatal to reading local copies."""


def _gh(*api_args: str) -> str:
    """Run `gh api ...` with a fixed argv. No shell, no interpolation."""
    argv = ["gh", "api", *api_args]
    try:
        completed = subprocess.run(
            argv,
            capture_output=True,
            text=True,
            timeout=GH_TIMEOUT_SECONDS,
            check=False,
        )
    except FileNotFoundError as exc:
        raise FetchError("gh is not installed; the local copy is still readable") from exc
    except subprocess.TimeoutExpired as exc:
        raise FetchError(f"gh timed out after {GH_TIMEOUT_SECONDS}s") from exc
    if completed.returncode != 0:
        raise FetchError((completed.stderr or "gh failed").strip().splitlines()[0])
    return completed.stdout


def list_remote() -> list:
    """Return the validated directive filenames present upstream."""
    raw = _gh(f"repos/{ATHANOR_REPO}/contents/{REMOTE_DIR}?ref={REF}")
    try:
        entries = json.loads(raw)
    except ValueError as exc:
        raise FetchError("gh returned a non-JSON directory listing") from exc
    if not isinstance(entries, list):
        raise FetchError("unexpected directory listing shape")
    names = []
    for entry in entries:
        if not isinstance(entry, dict) or entry.get("type") != "file":
            continue
        name = str(entry.get("name") or "")
        if SAFE_NAME_RE.match(name):
            names.append(name)
    return sorted(names)


def read_remote(name: str) -> str:
    """Fetch one directive's bytes. `name` must already have passed SAFE_NAME_RE."""
    if not SAFE_NAME_RE.match(name):
        raise FetchError(f"refusing to fetch a name that is not a directive: {name!r}")
    raw = _gh(f"repos/{ATHANOR_REPO}/contents/{REMOTE_DIR}/{name}?ref={REF}")
    try:
        payload = json.loads(raw)
        encoded = payload["content"]
    except (ValueError, KeyError, TypeError) as exc:
        raise FetchError(f"{name}: unexpected file payload") from exc
    try:
        data = base64.b64decode(encoded)
    except (binascii.Error, ValueError) as exc:
        raise FetchError(f"{name}: undecodable content") from exc
    if len(data) > MAX_FILE_BYTES:
        raise FetchError(f"{name}: {len(data)} bytes exceeds the {MAX_FILE_BYTES} byte cap")
    return data.decode("utf-8", errors="replace")


def refresh(root: Path, dry_run: bool = False) -> int:
    """Refresh root/.agent/directives from the pinned harness repo.

    Returns a process exit code. A transport failure is reported and returns 1;
    it never deletes or corrupts the local copy that `make update-template`
    already delivered.
    """
    root = Path(root)
    try:
        names = list_remote()
    except FetchError as exc:
        print(f"fetch unavailable: {exc}", file=sys.stderr)
        print("the locally delivered copy is unchanged and still readable", file=sys.stderr)
        return 1

    target = root / LOCAL_DIR
    written, unchanged = 0, 0
    for name in names:
        try:
            text = read_remote(name)
        except FetchError as exc:
            print(f"skipped {name}: {exc}", file=sys.stderr)
            continue
        path = target / name
        if path.exists() and path.read_text(encoding="utf-8") == text:
            unchanged += 1
            continue
        if dry_run:
            print(f"would update {LOCAL_DIR}/{name}")
            written += 1
            continue
        target.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        written += 1

    # Retirement is by supersede or status: withdrawn, NEVER by deletion
    # (GH #1347) -- so a local file missing upstream is left in place and simply
    # reported. Nothing here removes a file.
    local_only = sorted(
        p.name for p in target.glob("*.md") if p.name not in names
    ) if target.is_dir() else []
    for name in local_only:
        print(f"local only (not upstream, left in place): {name}", file=sys.stderr)

    verb = "would update" if dry_run else "updated"
    print(f"{verb} {written}, unchanged {unchanged}, upstream total {len(names)}")
    return 0


def main(argv=None) -> int:
    import argparse

    parser = argparse.ArgumentParser(
        prog="directives_fetch.py",
        description="Isolated gh transport for the directive channel. Copies bytes; "
                    "never parses, formats or forwards directive content.",
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)
    here = Path.cwd().resolve()
    for candidate in [here, *here.parents]:
        if (candidate / ".agent").is_dir():
            return refresh(candidate, dry_run=args.dry_run)
    print("no workspace root (.agent/) found", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
