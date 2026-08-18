#!/usr/bin/env python3
"""
verify_sync_materialised_apex.py — Prove the four apex provider files on disk
are byte-identical to what execution/sync_agents.sh generates from canonical,
right now (DECISION.md rulings 14 and 18; spec:
goldens/sync_materialisation_spec.md).

Mechanism: copy every .agent/agents/*.md into an empty temp root, run
sync_agents.sh with cwd set to that root (the script uses only relative
paths, so cwd fully redirects it -- no env-override support is needed and
none is added here, that is F4's change), then byte-compare the four
generated apex provider files against the four on disk.

This does NOT claim to know the on-disk files' history -- nothing on disk
records that. It claims only that they are byte-identical to sync's output
from canonical now, which is enough to defeat a hand-written stub differing
in description, tools, or body (QA_M1_REPORT.md Finding 1, against the
now-corrected A7/verify_sync_agents_idempotent.py).

Usage:
  verify_sync_materialised_apex.py [--root <dir>] [--agents a,b,...]
"""
import difflib
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SYNC_SCRIPT = REPO_ROOT / "execution" / "sync_agents.sh"
CANONICAL_DIR = REPO_ROOT / ".agent" / "agents"

PROVIDER_SUBDIRS = [Path(".claude") / "agents", Path(".gemini") / "agents"]


def main() -> int:
    args = sys.argv[1:]
    root = REPO_ROOT
    agents = ["architect-apex", "qa-apex"]

    i = 0
    while i < len(args):
        tok = args[i]
        if tok == "--root":
            if i + 1 >= len(args):
                print("FAIL: --root requires a value", file=sys.stderr)
                return 1
            root = Path(args[i + 1])
            i += 2
        elif tok == "--agents":
            if i + 1 >= len(args):
                print("FAIL: --agents requires a value", file=sys.stderr)
                return 1
            agents = [a.strip() for a in args[i + 1].split(",") if a.strip()]
            i += 2
        else:
            print(f"FAIL: unrecognized argument: {tok}", file=sys.stderr)
            return 1

    if not agents:
        print("FAIL: --agents list is empty -- nothing would be compared", file=sys.stderr)
        return 1

    expected_comparisons = len(PROVIDER_SUBDIRS) * len(agents)

    tmp_dir = tempfile.mkdtemp(prefix="sync_materialised_apex_")
    try:
        tmp = Path(tmp_dir)
        fixture_canonical = tmp / ".agent" / "agents"
        fixture_canonical.mkdir(parents=True)
        for f in CANONICAL_DIR.glob("*.md"):
            shutil.copy2(f, fixture_canonical / f.name)

        proc = subprocess.run(
            ["bash", str(SYNC_SCRIPT)], capture_output=True, text=True, cwd=str(tmp)
        )
        if proc.returncode != 0:
            print(
                f"FAIL: sync_agents.sh failed in fixture root: exit {proc.returncode}: {proc.stderr}",
                file=sys.stderr,
            )
            return 1

        m = re.search(r"created=(\d+) skipped=(\d+)", proc.stdout)
        if not m:
            print(
                f"FAIL: could not parse created=/skipped= summary from fixture sync output: {proc.stdout!r}",
                file=sys.stderr,
            )
            return 1

        created = int(m.group(1))
        if created == 0:
            print(
                "FAIL: fixture sync created nothing -- canonical copy did not reach the fixture root",
                file=sys.stderr,
            )
            return 1

        mismatches = 0
        compared = 0
        for subdir in PROVIDER_SUBDIRS:
            for agent in agents:
                rel = subdir / f"{agent}.md"
                fixture_path = tmp / rel
                disk_path = root / rel

                if not fixture_path.exists():
                    print(f"FAIL: provider file not found: {fixture_path}", file=sys.stderr)
                    mismatches += 1
                    continue
                if not disk_path.exists():
                    print(f"FAIL: provider file not found: {disk_path}", file=sys.stderr)
                    mismatches += 1
                    continue

                fixture_bytes = fixture_path.read_bytes()
                disk_bytes = disk_path.read_bytes()
                compared += 1
                if disk_bytes != fixture_bytes:
                    print(
                        f"FAIL: {disk_path} is not byte-identical to sync output from canonical",
                        file=sys.stderr,
                    )
                    diff = difflib.unified_diff(
                        fixture_bytes.decode(errors="replace").splitlines(keepends=True),
                        disk_bytes.decode(errors="replace").splitlines(keepends=True),
                        fromfile=f"sync output ({rel})",
                        tofile=str(disk_path),
                    )
                    sys.stderr.writelines(diff)
                    mismatches += 1

        if mismatches:
            return 1

        if compared != expected_comparisons:
            print(
                f"FAIL: compared {compared} provider files, expected {expected_comparisons} "
                f"({len(agents)} agents x {len(PROVIDER_SUBDIRS)} provider dirs)",
                file=sys.stderr,
            )
            return 1

        print(f"PASS: {compared} apex provider files byte-identical to sync output")
        return 0
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
