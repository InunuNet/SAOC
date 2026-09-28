#!/usr/bin/env python3
"""check_help_documented.py — every target `make help` prints is documented.

The Makefile Targets section of AGENTS.md drifted three times because the
only thing keeping it in step with `make help` was someone remembering. A
target added to help and not to the section is invisible to every agent that
reads the instructions instead of the Makefile, which is all of them: the
section IS the discovery surface, so an omission there is a target that
effectively does not exist.

This asserts the goal directly rather than a proxy for it: it runs `make
help`, extracts the target names it actually printed, and requires each one
to appear in the documented list. It does not check the reverse direction --
a documented target that help no longer prints is a different defect, and
conflating them would make one failure hide the other.

Exit 0 when every printed target is documented, 1 otherwise (naming the
missing ones), 2 when `make help` could not be run at all.
"""
import re
import subprocess
import sys
from pathlib import Path

DOC_PATH = Path("AGENTS.md")
SECTION_HEADING = "Makefile Targets"
HELP_TARGET_RE = re.compile(r"^\s+make\s+([A-Za-z0-9][A-Za-z0-9_-]*)\b")
DOC_TARGET_RE = re.compile(r"^-\s+`([A-Za-z0-9][A-Za-z0-9_-]*)`")


def help_targets() -> list[str]:
    try:
        proc = subprocess.run(
            ["make", "help"], capture_output=True, text=True, timeout=60)
    except Exception as exc:
        print(f"could not run `make help`: {exc}", file=sys.stderr)
        sys.exit(2)
    if proc.returncode != 0:
        print(f"`make help` exited {proc.returncode}", file=sys.stderr)
        sys.exit(2)
    seen, out = set(), []
    for line in proc.stdout.splitlines():
        m = HELP_TARGET_RE.match(line)
        if m and m.group(1) not in seen:
            seen.add(m.group(1))
            out.append(m.group(1))
    return out


def documented_targets(text: str) -> set[str]:
    """Target names listed under the Makefile Targets heading.

    Bounded by the next heading of any level, so a later section's bullet
    list can never be counted as documentation for a target.
    """
    lines = text.splitlines()
    start = None
    for i, line in enumerate(lines):
        if line.startswith("#") and SECTION_HEADING in line:
            start = i + 1
            break
    if start is None:
        print(f"{DOC_PATH}: no '{SECTION_HEADING}' heading found",
              file=sys.stderr)
        sys.exit(1)
    found = set()
    for line in lines[start:]:
        if line.startswith("#"):
            break
        m = DOC_TARGET_RE.match(line)
        if m:
            found.add(m.group(1))
    return found


def main() -> None:
    if not DOC_PATH.is_file():
        print(f"{DOC_PATH} not found — run from the project root",
              file=sys.stderr)
        sys.exit(2)
    printed = help_targets()
    if not printed:
        print("`make help` printed no recognisable targets", file=sys.stderr)
        sys.exit(2)
    documented = documented_targets(DOC_PATH.read_text())
    missing = [t for t in printed if t not in documented]
    if missing:
        print(f"{DOC_PATH} '{SECTION_HEADING}' is missing "
              f"{len(missing)} target(s) that `make help` prints:",
              file=sys.stderr)
        for t in missing:
            print(f"  - {t}", file=sys.stderr)
        sys.exit(1)
    print(f"ok {len(printed)} make targets all documented in {DOC_PATH}")


if __name__ == "__main__":
    main()
