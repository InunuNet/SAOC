#!/usr/bin/env python3
"""A10 (spec directive-channel F1) -- applied-state sits under a WORKSPACE tree.

`.agent/memory/project/directives-applied.json` is the receipt: it is written by
the RECEIVING project and must survive every `make update-template`. Two things
have to hold, and both are manifest facts rather than opinions:

  1. The nearest manifest entry covering the applied-state path is WORKSPACE --
     so an update never overwrites it.
  2. The applied-state path is NOT under `.agent/directives/` (HARNESS). Writing
     it there would leave a modified HARNESS file, which makes the #104 baseline
     guard withhold that path and mark every subsequent delivery partial.

And the mirror fact: `.agent/directives/` itself IS declared HARNESS, so Path A
of update-template carries it downstream with no extra plumbing.
"""

from __future__ import annotations

import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "execution"))

import directives  # noqa: E402

MANIFEST = ROOT / ".agent" / "update-manifest.yaml"

FAILURES: list = []


def check(name: str, cond: bool, detail: str = "") -> None:
    if cond:
        print(f"  ok   {name}")
    else:
        print(f"  FAIL {name} {detail}")
        FAILURES.append(name)


def covering_entry(entries: list, target: str):
    """Longest manifest path that is a prefix of `target` -- the one that wins."""
    best = None
    for entry in entries:
        path = str(entry.get("path") or "")
        if not path:
            continue
        if target == path or target.startswith(path if path.endswith("/") else path + "/"):
            if best is None or len(path) > len(str(best.get("path"))):
                best = entry
    return best


def main() -> int:
    data = yaml.safe_load(MANIFEST.read_text(encoding="utf-8")) or {}
    entries = [e for e in (data.get("paths") or []) if isinstance(e, dict)]
    check("manifest declares paths", bool(entries), f"{MANIFEST} has no paths:")
    if not entries:
        return 1

    applied = directives.APPLIED_PATH
    owner = covering_entry(entries, applied)
    check(f"A10.1 a manifest entry covers {applied}", owner is not None)
    if owner is not None:
        check("A10.2 that entry is WORKSPACE (an update never overwrites the receipt)",
              owner.get("category") == "WORKSPACE",
              f"{owner.get('path')} is {owner.get('category')}")

    check("A10.3 applied-state is NOT under the HARNESS directives dir (#104 guard)",
          not applied.startswith(directives.DIRECTIVES_DIR.rstrip("/") + "/"),
          f"{applied} would be a modified HARNESS file")

    dirs_entry = covering_entry(entries, directives.DIRECTIVES_DIR + "/x.md")
    check(f"A10.4 {directives.DIRECTIVES_DIR}/ is declared in the manifest",
          dirs_entry is not None)
    if dirs_entry is not None:
        check("A10.5 the directives dir is HARNESS (Path A carries it downstream)",
              dirs_entry.get("category") == "HARNESS",
              f"{dirs_entry.get('path')} is {dirs_entry.get('category')}")

    print()
    if FAILURES:
        print(f"FAIL: {len(FAILURES)} check(s): {', '.join(FAILURES)}")
        return 1
    print("PASS: applied-state is WORKSPACE, directives are HARNESS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
