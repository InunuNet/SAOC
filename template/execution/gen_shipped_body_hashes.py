#!/usr/bin/env python3
"""gen_shipped_body_hashes.py -- record every agent body Athanor ever shipped.

Writes .agent/agents/.shipped-body-hashes.json ({role: [sha256, ...]}) as the union of the
existing file, every committed version of <role>.md under .agent/agents, template/.agent/agents,
.claude/agents and .grok/agents (what Athanor rendered and shipped) in git history, and the working-tree body. sync_agents_core.py uses it to tell an
untouched legacy provider file (safe to re-render) from a customised one. Run it from the
project root whenever a canonical agent body changes, then copy the file to template/.
"""
import json
import subprocess
import sys
from pathlib import Path

from sync_agents_core import CANONICAL_DIR, HASHES_PATH, body_hash_variants, split_front

AGENT_DIRS = (".agent/agents", "template/.agent/agents", ".claude/agents", ".grok/agents")


def git(*args):
    result = subprocess.run(["git", *args], capture_output=True, check=False)
    return result.stdout.decode("utf-8", errors="replace") if result.returncode == 0 else ""


def history_bodies(path):
    for sha in git("log", "--format=%H", "--", path).split():
        text = git("show", f"{sha}:{path}")
        if text:
            yield split_front(text)[1]


def main():
    try:
        data = json.loads(HASHES_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        data = {}
    for canonical in sorted(CANONICAL_DIR.glob("*.md")):
        role = canonical.stem
        hashes = set(data.get(role, []))
        bodies = [split_front(canonical.read_text(encoding="utf-8"))[1]]
        for directory in AGENT_DIRS:
            bodies.extend(history_bodies(f"{directory}/{role}.md"))
        for body in bodies:
            hashes |= body_hash_variants(body)
        data[role] = sorted(hashes)
    HASHES_PATH.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"wrote {HASHES_PATH} ({len(data)} roles)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
