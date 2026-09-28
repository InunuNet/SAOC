#!/usr/bin/env python3
"""emergency_permit_selftest.py — prove Route 3 grants and refuses correctly.

Each case drives the REAL hook the way Claude Code drives it: a PreToolUse
JSON payload on stdin, in a throwaway scaffold under .tmp/sandbox. It asserts
the exit code the hook actually returned, not a fact near it -- a test that
read the source for the string "route3_permit" would pass against a route
wired to nothing.

The scaffold is a real directory tree because the hook resolves paths against
`pwd` and reads `.agent/` beside it; pointing it at the live project would
make a passing test indistinguishable from a test that granted a real edit.

Cases:
  deny-without-permit     floor-protected write, no permit -> DENY
  allow-with-permit       same write, valid permit         -> ALLOW
  single-use              permit consumed, second try      -> DENY
  expired                 permit older than the TTL        -> DENY
  wrong-path              permit names a different file    -> DENY
  credential-denied       permit names a credential store  -> DENY
  self-widening-denied    permit names the hook/matrix     -> DENY
  audited                 a grant appends method=emergency

Exit 0 when the case behaved as specified, 1 otherwise (saying what it got).
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

HOOK_REL = Path("execution/hooks/check_autonomy.sh")
SANDBOX_ROOT = Path(".tmp/sandbox/route3")
PERMIT_REL = Path(".agent/enforcement_emergency.json")
AUDIT_REL = Path(".agent/memory/project/enforcement_edit_audit.log")

DENY = 2
ALLOW = 0


def build_scaffold(case: str) -> Path:
    """A minimal tree the hook can resolve against, with the real hook in it."""
    root = (Path.cwd() / SANDBOX_ROOT / case).resolve()
    if root.exists():
        shutil.rmtree(root)
    (root / "execution" / "hooks" / "lib").mkdir(parents=True)
    (root / ".agent" / "memory" / "project").mkdir(parents=True)
    (root / ".claude").mkdir(parents=True)

    src = Path.cwd() / HOOK_REL
    shutil.copy2(src, root / HOOK_REL)
    lib_src = src.parent / "lib"
    if lib_src.is_dir():
        shutil.copytree(lib_src, root / "execution" / "hooks" / "lib",
                        dirs_exist_ok=True)
    resolver = Path.cwd() / "execution" / "hooks" / "lib" / "resolve_feature_contract.py"
    if resolver.is_file():
        # The resolver walks up to a repo root that does not exist in the
        # scaffold; without an active.json it answers "allow" and Route 1
        # declines, which is exactly the state a mission-less project is in.
        pass
    (root / ".claude" / "settings.json").write_text("{}\n")
    return root


def write_permit(root: Path, path: str, reason: str, age_minutes: int = 0) -> None:
    created = datetime.now(timezone.utc) - timedelta(minutes=age_minutes)
    (root / PERMIT_REL).write_text(json.dumps({
        "path": path,
        "reason": reason,
        "created_at": created.isoformat().replace("+00:00", "Z"),
    }, indent=2) + "\n")


def run_hook(root: Path, target: str) -> tuple[int, str]:
    payload = json.dumps({
        "tool_name": "Write",
        "tool_input": {"file_path": target, "content": "probe"},
    })
    proc = subprocess.run(
        ["bash", str(root / HOOK_REL)],
        input=payload, capture_output=True, text=True, cwd=root, timeout=60,
        env={**os.environ, "CLAUDE_PROJECT_DIR": str(root)},
    )
    return proc.returncode, (proc.stderr or "").strip()


REASON = "emergency: session blocked on a floor-protected settings file"
TARGET = ".claude/settings.json"


def check(case: str) -> int:
    root = build_scaffold(case)

    if case == "deny-without-permit":
        rc, err = run_hook(root, TARGET)
        return verdict(rc, DENY, err, "no permit present")

    if case == "allow-with-permit":
        write_permit(root, TARGET, REASON)
        rc, err = run_hook(root, TARGET)
        return verdict(rc, ALLOW, err, "valid permit")

    if case == "single-use":
        write_permit(root, TARGET, REASON)
        rc1, _ = run_hook(root, TARGET)
        if rc1 != ALLOW:
            return fail(f"first write should have been allowed, got {rc1}")
        if (root / PERMIT_REL).exists():
            return fail("permit survived its own use")
        rc2, err = run_hook(root, TARGET)
        return verdict(rc2, DENY, err, "permit already consumed")

    if case == "expired":
        write_permit(root, TARGET, REASON, age_minutes=45)
        rc, err = run_hook(root, TARGET)
        return verdict(rc, DENY, err, "permit older than the TTL")

    if case == "wrong-path":
        write_permit(root, "execution/hooks/full_boot.sh", REASON)
        rc, err = run_hook(root, TARGET)
        return verdict(rc, DENY, err, "permit names a different path")

    if case == "credential-denied":
        # NOT the project's own root dotenv any more. The operator ruled on
        # 2026-09-22 that a project manages its own `.env` in both directions,
        # so that file is allowed WITHOUT a permit and can no longer stand in
        # for "a permit cannot reach a credential store" -- it would pass for
        # the wrong reason. These three are the boundary that did not move:
        # a nested credential directory, another tree's key, and a private key
        # by extension.
        for target in ("secrets/api.key",
                       "/Users/vetus/.ssh/id_rsa",
                       "cert.pem"):
            write_permit(root, target, REASON)
            rc, err = run_hook(root, target)
            if rc != DENY:
                return fail(f"{target}: expected DENY ({DENY}), got {rc} {err}")
        return ok("credential stores are hard-denied")

    if case == "self-widening-denied":
        for target in (".agent/autonomy_matrix.json",
                       ".agent/enforcement_breakglass.json",
                       "execution/hooks/check_autonomy.sh"):
            write_permit(root, target, REASON)
            rc, err = run_hook(root, target)
            if rc != DENY:
                return fail(f"{target}: expected DENY ({DENY}), got {rc} {err}")
        return ok("permit machinery is hard-denied")

    if case == "audited":
        write_permit(root, TARGET, REASON)
        rc, err = run_hook(root, TARGET)
        if rc != ALLOW:
            return fail(f"expected ALLOW, got {rc}: {err}")
        log = root / AUDIT_REL
        if not log.is_file():
            return fail("grant left no audit record")
        records = [json.loads(line) for line in
                   log.read_text().splitlines() if line.strip()]
        emergency = [r for r in records if r.get("method") == "emergency"]
        if not emergency:
            return fail(f"no method=emergency record; got {records}")
        if REASON not in (emergency[-1].get("contract") or ""):
            return fail("audit record did not carry the stated reason")
        return ok("grant audited under method=emergency with its reason")

    return fail(f"unknown case: {case}")


def verdict(rc: int, expected: int, err: str, what: str) -> int:
    if rc == expected:
        return ok(what)
    return fail(f"{what}: expected exit {expected}, got {rc}: {err}")


def ok(msg: str) -> int:
    print(f"ok {msg}")
    return 0


def fail(msg: str) -> int:
    print(f"FAIL {msg}", file=sys.stderr)
    return 1


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--case", required=True)
    args = ap.parse_args()
    rc = check(args.case)
    shutil.rmtree(Path.cwd() / SANDBOX_ROOT / args.case, ignore_errors=True)
    sys.exit(rc)


if __name__ == "__main__":
    main()
