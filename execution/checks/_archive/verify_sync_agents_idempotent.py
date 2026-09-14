#!/usr/bin/env python3
"""
verify_sync_agents_idempotent.py — Run execution/sync_agents.sh a second time
and assert it exits 0, prints a parseable `created=N skipped=M` summary, and
reports created=0 (DECISION.md ruling 13).

This proves idempotency and a clean exit ONLY. It is NOT evidence of
provenance: sync_agents.sh's skip-if-exists logic (sync_agents.sh:113,132) is
a bare `[ -f "$TARGET" ]` existence test with no content, hash, or provenance
comparison, so a hand-written file at the target path satisfies created=0
identically to a sync-generated one. Provenance is proved separately, by
byte-comparing against a fresh sync into an empty temp root
(verify_sync_materialised_apex.py, contract-f2.yaml A9).

Runs sync_agents.sh in a scratch tempdir seeded from the current
.agent/agents, .claude/agents, .gemini/agents state, never against the real
repo tree (contract-f2.yaml A7 was found to mutate .anti/agents.json and
rm -f .anti/register_agents.sh on the live tree; see
idempotency-check-repo-mutation mission).
"""
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SYNC_SCRIPT = REPO_ROOT / "execution" / "sync_agents.sh"
CANONICAL_DIR = REPO_ROOT / ".agent" / "agents"
CLAUDE_DIR = REPO_ROOT / ".claude" / "agents"
GEMINI_DIR = REPO_ROOT / ".gemini" / "agents"


def main() -> int:
    if not SYNC_SCRIPT.exists():
        print(f"FAIL: sync script not found: {SYNC_SCRIPT}", file=sys.stderr)
        return 1

    tmp_dir = tempfile.mkdtemp(prefix="sync_agents_idempotent_")
    try:
        tmp = Path(tmp_dir)
        fixture_canonical = tmp / ".agent" / "agents"
        fixture_claude = tmp / ".claude" / "agents"
        fixture_gemini = tmp / ".gemini" / "agents"
        for d in (fixture_canonical, fixture_claude, fixture_gemini):
            d.mkdir(parents=True)

        for f in CANONICAL_DIR.glob("*.md"):
            shutil.copy2(f, fixture_canonical / f.name)
        for f in CLAUDE_DIR.glob("*.md"):
            shutil.copy2(f, fixture_claude / f.name)
        for f in GEMINI_DIR.glob("*.md"):
            shutil.copy2(f, fixture_gemini / f.name)

        proc = subprocess.run(
            ["bash", str(SYNC_SCRIPT)], capture_output=True, text=True, cwd=str(tmp)
        )
        if proc.returncode != 0:
            print(f"FAIL: sync_agents.sh exited {proc.returncode}: {proc.stderr}", file=sys.stderr)
            return 1

        m = re.search(r"created=(\d+) skipped=(\d+)", proc.stdout)
        if not m:
            print(
                f"FAIL: could not parse created=/skipped= summary from sync_agents.sh output: {proc.stdout!r}",
                file=sys.stderr,
            )
            return 1

        created = int(m.group(1))
        skipped = int(m.group(2))

        if created != 0:
            print(
                f"FAIL: sync_agents.sh was not idempotent: created={created} (expected 0) on second run",
                file=sys.stderr,
            )
            return 1

        print(f"PASS: sync_agents.sh idempotent on second run (created=0, skipped={skipped})")
        return 0
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
