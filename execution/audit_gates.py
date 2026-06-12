#!/usr/bin/env python3
"""
audit_gates.py — Read learned.md and report per-pair gate bypass counts.

Reads ATHANOR_PROJECT_MEM (or .agent/memory/project/) for learned.md,
parses the ## Gate Bypasses section, and prints a summary table.

Exit: always 0. Missing file or empty section is normal; warnings go to stderr.
"""

import os
import re
import sys
from collections import defaultdict
from pathlib import Path


def _project_mem_dir() -> Path:
    env = os.environ.get("ATHANOR_PROJECT_MEM")
    if env:
        return Path(env)
    return Path(__file__).resolve().parent.parent / ".agent" / "memory" / "project"


def parse_bypass_section(text: str) -> list[dict]:
    """Extract bypass entries from the ## Gate Bypasses section."""
    if "## Gate Bypasses" not in text:
        return []
    after = text.split("## Gate Bypasses", 1)[1]
    # Stop at next ## heading
    section = after.split("\n## ", 1)[0]

    pattern = re.compile(
        r'^- `(?P<ts>[^`]+)` \| `(?P<gate>[^`]+)` \| `(?P<mission>[^`]+)` \| reason: "(?P<reason>.+)"$'
    )
    entries = []
    for line in section.splitlines():
        line = line.strip()
        if not line.startswith("- `"):
            continue
        m = pattern.match(line)
        if m:
            entries.append(m.groupdict())
        else:
            print(f"WARNING: malformed bypass line (skipped): {line!r}", file=sys.stderr)
    return entries


def main():
    learned_path = _project_mem_dir() / "learned.md"

    if not learned_path.exists():
        print("Gate Bypass Audit")
        print("-----------------")
        print("learned.md not found — 0 bypass entries recorded.")
        return

    try:
        text = learned_path.read_text(encoding="utf-8")
    except Exception as e:
        print(f"WARNING: could not read learned.md: {e}", file=sys.stderr)
        print("Gate Bypass Audit")
        print("-----------------")
        print("0 bypass entries (read error).")
        return

    entries = parse_bypass_section(text)

    print("Gate Bypass Audit")
    print("-----------------")

    if not entries:
        print("No bypass entries found (0 total).")
        return

    counts: dict[str, int] = defaultdict(int)
    for e in entries:
        pair = e["gate"].strip()
        counts[pair] += 1

    print(f"Total bypass entries: {len(entries)}")
    print("")
    print(f"{'Gate pair':<30} {'Count':>6}")
    print(f"{'-'*30} {'------':>6}")
    for pair, count in sorted(counts.items()):
        print(f"{pair:<30} {count:>6}")


if __name__ == "__main__":
    main()
    sys.exit(0)
