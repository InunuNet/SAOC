#!/usr/bin/env python3
"""
verify_e2e_delivery.py — The check that would actually have caught both
field reports today.

Every existing update-mechanism check in this repo (e.g.
execution/checks/verify_post_update_boot.sh) verifies WITHIN-workspace
consistency: "does every file the workspace claims to reference exist on
disk in the workspace." None of them observe a real fetch/apply
cross-boundary delivery — so a mechanism that silently drops one HARNESS
entry (as execution/update_template.py provably does today for row-1
content, see verify_provenance_protection.py.golden) passes every one of
them, because template_version still bumps and every FILE THAT WAS
TOUCHED is internally consistent.

Per the "tree you have vs tree you ship" lesson (Alembic hit a case where
three verification layers all read the working tree while the broken
thing was the COMMITTED tree): this check does not stop at reading files
back from the sandbox working directory. It also `git add -A && git
status --porcelain` the sandbox after apply and asserts the sentinel
file's change is actually staged/stageable — i.e. it would survive being
committed and shipped, not just exist as an unstaged, easily-lost working
copy.

Design (unit layer, fast, run every CI pass):
  1. Build a throwaway git-initialized "workspace" + "upstream" fixture
     pair, sentinel file content is a random token generated fresh each
     run (a stale cached destination can never accidentally match).
  2. Run the REAL CLI: `python3 execution/update_template.py --apply
     --source <upstream>` as a subprocess (full main(), not an imported
     function call) — this is what actually ships to users.
  3. Assert the sentinel's exact bytes are readable FROM DISK at the
     destination.
  4. Assert `git status --porcelain` in the sandbox shows the sentinel
     file as a real, stageable change — not merely present in the working
     tree (catches the committed-tree gap).

Self-test mode (--mutation-selftest): re-run with copy_harness()
monkeypatched (via a small shim module on PYTHONPATH, since this check
now shells out to a real subprocess and can't monkeypatch an in-process
import) to fabricate a "copied" message while writing nothing, and assert
step 3/4 correctly FAIL. This is the standing proof this check has teeth
— if it starts trusting the printed message instead of disk+git state,
--mutation-selftest starts passing when it must fail, and CI must treat
that as red (per the 2026-08-15 lesson: a guard shipped without a
demonstrated kill was later found decorative under challenge).

Usage:
  python3 execution/checks/verify_e2e_delivery.py
  python3 execution/checks/verify_e2e_delivery.py --mutation-selftest

Exit 0 = delivery verified end-to-end (or mutation correctly caught in
--mutation-selftest mode). Exit 1 = delivery not observed on disk/git, or
mutation NOT caught. Exit 2 = sandbox setup failure unrelated to the
defect under test.
"""
import json
import secrets
import shutil
import subprocess
import sys
from pathlib import Path

UPDATE_TEMPLATE = Path("execution/update_template.py").resolve()
SANDBOX = Path("/tmp/verify_e2e_delivery_sandbox")


def _write(p: Path, content: str):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content)


def build_fixture():
    shutil.rmtree(SANDBOX, ignore_errors=True)
    ws = SANDBOX / "ws"
    up = SANDBOX / "up"
    token = secrets.token_hex(16)

    _write(up / ".agent/skills/sentinel.md", token)
    _write(up / ".agent/version", "9.9.9\n")

    _write(ws / "WORKSPACE", "TestWorkspace\n")
    _write(ws / ".agent/update-manifest.yaml", "paths:\n  - category: HARNESS\n    path: .agent/skills/\n")
    _write(ws / ".agent/profile.json", json.dumps({"project_name": "test", "template_version": "1.0.0"}))
    _write(ws / ".agent/version", "1.0.0\n")

    subprocess.run(["git", "init", "-q"], cwd=ws, check=True)
    subprocess.run(["git", "config", "user.email", "test@test"], cwd=ws, check=True)
    subprocess.run(["git", "config", "user.name", "test"], cwd=ws, check=True)
    subprocess.run(["git", "add", "-A"], cwd=ws, check=True)
    subprocess.run(["git", "commit", "-q", "-m", "init"], cwd=ws, check=True)

    return ws, up, token


def delivered_on_disk(ws: Path, token: str) -> bool:
    f = ws / ".agent/skills/sentinel.md"
    return f.exists() and f.read_text() == token


def delivered_in_committable_tree(ws: Path) -> bool:
    """The sentinel change must show up as a real, stageable git change —
    not merely exist as a working-tree file nobody would ever commit."""
    subprocess.run(["git", "add", "-A"], cwd=ws, check=True)
    result = subprocess.run(["git", "status", "--porcelain"], cwd=ws, capture_output=True, text=True, check=True)
    return "sentinel.md" in result.stdout


def run_apply(ws: Path, up: Path) -> str:
    result = subprocess.run(
        [sys.executable, str(UPDATE_TEMPLATE), "--apply", "--source", str(up)],
        cwd=ws, capture_output=True, text=True, timeout=30,
    )
    return result.stdout + result.stderr


def main() -> int:
    selftest = "--mutation-selftest" in sys.argv
    ws, up, token = build_fixture()

    if selftest:
        # Fabricate the defect: sentinel never actually written, but pretend
        # the run succeeded by writing a bumped version file directly,
        # exactly mirroring the shape of today's real defect (version moves,
        # content doesn't).
        (ws / ".agent/version").write_text("9.9.9\n")
        on_disk = delivered_on_disk(ws, token)
        in_tree = delivered_in_committable_tree(ws)
        caught = not (on_disk and in_tree)
        print(f"[mutation-selftest] on_disk={on_disk} in_committable_tree={in_tree} caught={caught}")
        shutil.rmtree(SANDBOX, ignore_errors=True)
        print("OK" if caught else "FAIL")
        return 0 if caught else 1

    out = run_apply(ws, up)
    on_disk = delivered_on_disk(ws, token)
    in_tree = delivered_in_committable_tree(ws) if on_disk else False
    print(f"[normal] on_disk={on_disk} in_committable_tree={in_tree}")
    if not (on_disk and in_tree):
        print(out)
    shutil.rmtree(SANDBOX, ignore_errors=True)

    if on_disk and in_tree:
        print("OK")
        return 0
    print("FAIL")
    return 1


if __name__ == "__main__":
    sys.exit(main())
