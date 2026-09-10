#!/usr/bin/env python3
"""Verify write_reboot() supports closure_candidates + a path= test seam that never
touches the real reboot.md.

Exit 0 + print "OK" on success. Exit 1 + details on stderr on failure.
"""
import hashlib
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "execution"))

import brain  # noqa: E402

REAL_REBOOT = REPO_ROOT / ".agent/memory/project/reboot.md"


def _hash(path: Path) -> str | None:
    if not path.exists():
        return None
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    before_hash = _hash(REAL_REBOOT)
    before_mtime = REAL_REBOOT.stat().st_mtime if REAL_REBOOT.exists() else None

    with tempfile.NamedTemporaryFile(suffix=".md", delete=False) as tmp:
        tmp_path = Path(tmp.name)

    try:
        brain.write_reboot(
            "test summary",
            closure_candidates=["GH #9999 — test evidence"],
            path=str(tmp_path),
        )

        content = tmp_path.read_text()
        errors = []
        if "## Closure candidates (needs sign-off)" not in content:
            errors.append("missing '## Closure candidates (needs sign-off)' header")
        if "- GH #9999 — test evidence" not in content:
            errors.append("missing '- GH #9999 — test evidence' line")

        after_hash = _hash(REAL_REBOOT)
        after_mtime = REAL_REBOOT.stat().st_mtime if REAL_REBOOT.exists() else None
        if before_hash != after_hash or before_mtime != after_mtime:
            errors.append(
                f"real reboot.md was touched: hash {before_hash} -> {after_hash}, "
                f"mtime {before_mtime} -> {after_mtime}"
            )

        if errors:
            for e in errors:
                print(f"FAIL: {e}", file=sys.stderr)
            print(f"--- temp file content ---\n{content}", file=sys.stderr)
            sys.exit(1)

        print("OK")
        sys.exit(0)
    finally:
        tmp_path.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
