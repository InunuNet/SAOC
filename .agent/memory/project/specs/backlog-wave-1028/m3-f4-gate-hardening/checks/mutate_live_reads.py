#!/usr/bin/env python3
"""Mutation proof for scripts/checks/buy-path-live-reads.mts (m3-f4-gate-hardening).

Control: an unmutated copy of the covered files must pass (exit 0). Each mutation in
goldens/buy-path-live-reads.json drops or adds one non-live sanityFetch site in a sandbox copy;
the checker, run with --root on that copy, must exit 1 and name the mutated file.
Exit 0 all controls and mutations behave, 1 a mutation was NOT caught (or the control failed),
2 setup error (manifest, a mutation regex that does not match exactly once, the checker missing).
Sandbox: .tmp/sandbox/f4-mutate/ only; removed with execution/safe_delete.py.
"""
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

SPEC = Path(__file__).resolve().parents[1]
REPO = SPEC.parents[5]
MANIFEST = SPEC / "goldens" / "buy-path-live-reads.json"
CHECKER = REPO / "scripts" / "checks" / "buy-path-live-reads.mts"
SANDBOX = REPO / ".tmp" / "sandbox" / "f4-mutate"
CAUGHT, MISSED, SETUP = 0, 1, 2


def run_checker(root: Path):
    return subprocess.run(
        ["pnpm", "exec", "tsx", str(CHECKER), "--root", str(root)],
        cwd=REPO, capture_output=True, text=True, timeout=120,
    )


def copy_tree(manifest, dest: Path):
    for rel in manifest["files_every_sanityfetch_must_be_live"]:
        target = dest / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(REPO / rel, target)


def main() -> int:
    if not CHECKER.exists():
        print(f"SETUP: {CHECKER} does not exist")
        return SETUP
    manifest = json.loads(MANIFEST.read_text())
    status = CAUGHT
    SANDBOX.mkdir(parents=True, exist_ok=True)

    control = SANDBOX / "control"
    copy_tree(manifest, control)
    result = run_checker(control)
    print(f"control exit {result.returncode} (want 0)")
    if result.returncode != 0:
        print(result.stdout + result.stderr)
        status = MISSED

    for mutation in manifest["mutations"]:
        root = SANDBOX / mutation["id"]
        copy_tree(manifest, root)
        path = root / mutation["file"]
        text = path.read_text()
        # One-edit form (regex, replace) or an ordered `edits` list; each edit must match exactly once.
        edits = mutation.get("edits") or [{"regex": mutation["regex"], "replace": mutation["replace"]}]
        mutated = text
        for edit in edits:
            mutated, count = re.subn(edit["regex"], edit["replace"], mutated, count=0, flags=re.DOTALL)
            if count != 1:
                print(f"SETUP: {mutation['id']} regex {edit['regex']!r} matched {count} times in {mutation['file']} (want exactly 1)")
                return SETUP
        path.write_text(mutation.get("prepend_import", "") + mutated)
        result = run_checker(root)
        output = result.stdout + result.stderr
        caught = result.returncode == 1 and mutation["file"] in output
        print(f"{mutation['id']} {'CAUGHT' if caught else 'MISSED'} exit {result.returncode} {mutation['file']}")
        if not caught:
            print(output)
            status = MISSED

    subprocess.run([sys.executable, str(REPO / "execution" / "safe_delete.py"), str(SANDBOX)], cwd=REPO, check=False)
    return status


if __name__ == "__main__":
    sys.exit(main())
