#!/usr/bin/env python3
"""Upgrade-path acceptance test: an OLDER-release project upgrades to this harness head.

fleet_acceptance.py scaffolds fresh at head. The real-world path is a downstream project
sitting on an older release running `update_template.py --apply`; this script executes that
path end to end in a throwaway sandbox under .tmp/sandbox/upgrade-acceptance/ and exits 0
iff every step passes.

Steps: export-old, scaffold-old, upgrade, converged, boot, mission.

Self-heal contract: when the OLD updater is stale against the payload, the first --apply
heals the updater file and re-execs it once (os.execve) so a single command completes the
update. If that re-exec cannot happen the updater prints "re-run" and exits non-zero; the
upgrade step then runs the project's updater a second time, exactly as a user would, and
reports that it needed to.

This instrument fixes nothing it measures: a RED run names the failing step and command.

Usage:
    python3 execution/upgrade_acceptance.py [--from-ref REF] [--verbose] [--keep]
"""
import argparse
import hashlib
import io
import json
import os
import subprocess
import sys
import tarfile
import time
from pathlib import Path

import fleet_acceptance as fa
_EXEC_DIR = os.path.dirname(os.path.abspath(__file__))
if _EXEC_DIR not in sys.path:
    sys.path.insert(0, _EXEC_DIR)
from bash_exe import bash_exe  # noqa: E402  Windows: Git Bash, never System32 WSL

HARNESS_ROOT = Path(__file__).resolve().parent.parent
SANDBOX_ROOT = HARNESS_ROOT / ".tmp" / "sandbox" / "upgrade-acceptance"
RUN_ID = "%d-%d" % (os.getpid(), int(time.time() * 1000))
RUN_ROOT = SANDBOX_ROOT / RUN_ID
OLD_TREE = RUN_ROOT / "old-harness"
WS_NAME = "UpgradeAcceptanceWS"
WS = RUN_ROOT / WS_NAME

DEFAULT_FROM_REF = "4c96e5d0"  # v3.8.89 release
TOTAL_TIMEOUT_SECONDS = 600
EXPORT_TIMEOUT_SECONDS = 120
SCAFFOLD_TIMEOUT_SECONDS = 240
UPGRADE_TIMEOUT_SECONDS = 240
SHORT_TIMEOUT_SECONDS = 60
SIGNAL_EXIT_139 = 139
# VOICE_HOME points at an empty sandbox dir (no .enabled), so throwaway projects never speak.
CHILD_ENV = dict(os.environ, PYTHONUTF8="1", VOICE_HOME=str(RUN_ROOT / "voice-off"))
IGNORED_DIRS = {"__pycache__"}

STEP_NAMES = {
    1: "export-old",
    2: "scaffold-old",
    3: "upgrade",
    4: "converged",
    5: "boot",
    6: "mission",
}


def run(cmd, cwd, timeout, verbose):
    """subprocess.run with UTF-8 children; a timeout is returned as rc 124, not raised."""
    if verbose:
        print(f"    $ {' '.join(cmd)}  (cwd={cwd})", file=sys.stderr)
    try:
        proc = subprocess.run(
            cmd, cwd=str(cwd), capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=timeout, env=CHILD_ENV,
        )
    except subprocess.TimeoutExpired as exc:
        return fa._TimedOut(cmd, timeout, exc)
    if verbose:
        sys.stderr.write((proc.stdout or "") + (proc.stderr or ""))
    return proc


def _safe_rmtree(path):
    """Delete `path` only when it lies inside SANDBOX_ROOT."""
    resolved = Path(path).resolve()
    root = SANDBOX_ROOT.resolve()
    if resolved != root and root not in resolved.parents:
        raise RuntimeError(f"refusing to delete outside the sandbox root: {resolved}")
    if resolved.exists():
        import shutil
        shutil.rmtree(resolved)


def _read_version(path):
    return path.read_text(encoding="utf-8").strip()


def _profile_version(ws):
    profile = json.loads((ws / ".agent" / "profile.json").read_text(encoding="utf-8"))
    return profile.get("template_version")


def _tree_digest(root):
    """sha256 over every file's relative path and bytes, ignoring __pycache__."""
    h = hashlib.sha256()
    files = []
    for dirpath, dirnames, filenames in os.walk(str(root)):
        dirnames[:] = [d for d in dirnames if d not in IGNORED_DIRS]
        files.extend(Path(dirpath, name) for name in filenames)
    for f in sorted(files, key=lambda p: str(p.relative_to(root))):
        h.update(str(f.relative_to(root)).replace(os.sep, "/").encode("utf-8"))
        h.update(b"\0")
        try:
            h.update(f.read_bytes())
        except OSError:
            h.update(b"<unreadable>")
        h.update(b"\0")
    return h.hexdigest()


def _extract_archive(data, dest):
    """Extract tar bytes into dest, refusing any member that escapes it."""
    dest_resolved = dest.resolve()
    with tarfile.open(fileobj=io.BytesIO(data)) as tar:
        for member in tar.getmembers():
            target = (dest / member.name).resolve()
            if target != dest_resolved and dest_resolved not in target.parents:
                raise RuntimeError(f"archive member escapes the sandbox: {member.name}")
        tar.extractall(str(dest))


# -- Step 1: export-old ------------------------------------------------------

def step_export_old(verbose, ctx):
    OLD_TREE.mkdir(parents=True, exist_ok=True)
    cmd = ["git", "archive", "--format=tar", ctx["from_ref"]]
    try:
        proc = subprocess.run(
            cmd, cwd=str(HARNESS_ROOT), capture_output=True,
            timeout=EXPORT_TIMEOUT_SECONDS, env=CHILD_ENV,
        )
    except subprocess.TimeoutExpired:
        return "FAIL", f"`{' '.join(cmd)}` timed out after {EXPORT_TIMEOUT_SECONDS}s"
    if proc.returncode != 0:
        err = proc.stderr.decode("utf-8", errors="replace")
        return "FAIL", f"`{' '.join(cmd)}` exit={proc.returncode}\n{fa.trim(err)}"
    _extract_archive(proc.stdout, OLD_TREE)
    if not (OLD_TREE / "init.sh").exists():
        return "FAIL", f"archive of {ctx['from_ref']} has no init.sh"
    ctx["old_version"] = _read_version(OLD_TREE / ".agent" / "version")
    return "PASS", f"{ctx['from_ref']} = v{ctx['old_version']}"


# -- Step 2: scaffold-old ----------------------------------------------------

def step_scaffold_old(verbose, ctx):
    cmd = [bash_exe(), str(OLD_TREE / "init.sh"), "--path", str(WS), "--name", WS_NAME, "--no-pulse"]
    proc = run(cmd, OLD_TREE, SCAFFOLD_TIMEOUT_SECONDS, verbose)
    if proc.returncode != 0:
        return "FAIL", fa.fail_reason(cmd, proc)
    cmd = [
        sys.executable, "execution/onboard_headless.py",
        "--project-name", WS_NAME,
        "--role", "Upgrade Acceptance Test Agent",
        "--mission", "Prove an older project upgrades to the current harness",
    ]
    proc = run(cmd, WS, SHORT_TIMEOUT_SECONDS, verbose)
    if proc.returncode != 0:
        return "FAIL", fa.fail_reason(cmd, proc)
    version = _profile_version(WS)
    if version != ctx["old_version"]:
        return "FAIL", (f"scaffolded project template_version is {version!r}, "
                        f"expected the old release {ctx['old_version']!r}")
    return "PASS", f"project on v{version}"


# -- Step 3: upgrade ---------------------------------------------------------

def _upgrade_cmd():
    return [
        sys.executable, "-X", "faulthandler", "execution/update_template.py",
        "--apply", "--source", str(HARNESS_ROOT),
    ]


def _signal_reason(cmd, proc):
    rc = proc.returncode
    kind = "killed by a signal" if rc < 0 or rc == SIGNAL_EXIT_139 else "failed"
    return f"updater {kind} (rc={rc}); faulthandler/stderr output:\n" + fa.fail_reason(cmd, proc)


def step_upgrade(verbose, ctx):
    cmd = _upgrade_cmd()
    proc = run(cmd, WS, UPGRADE_TIMEOUT_SECONDS, verbose)
    note = ""
    if proc.returncode != 0 and (proc.returncode < 0 or proc.returncode == SIGNAL_EXIT_139):
        return "FAIL", _signal_reason(cmd, proc)
    if proc.returncode != 0 and "re-run" in ((proc.stdout or "") + (proc.stderr or "")):
        note = " (needed a manual re-run, as the self-heal contract allows)"
        proc = run(cmd, WS, UPGRADE_TIMEOUT_SECONDS, verbose)
    if proc.returncode != 0:
        return "FAIL", _signal_reason(cmd, proc)
    if "[self-heal]" in (proc.stdout or ""):
        note = " (updater self-healed and re-executed in one command)"
    return "PASS", f"--apply exit 0{note}"


# -- Step 4: converged -------------------------------------------------------

def step_converged(verbose, ctx):
    head_version = _read_version(HARNESS_ROOT / ".agent" / "version")
    before = _tree_digest(WS)
    cmd = _upgrade_cmd()
    proc = run(cmd, WS, UPGRADE_TIMEOUT_SECONDS, verbose)
    if proc.returncode != 0:
        return "FAIL", _signal_reason(cmd, proc)
    after = _tree_digest(WS)
    if before != after:
        return "FAIL", "a further --apply changed the tree (digest differs): not converged"
    version = _profile_version(WS)
    if version != head_version:
        return "FAIL", f"template_version is {version!r}, harness head is {head_version!r}"
    return "PASS", f"stable at v{version}"


# -- Step 5: boot ------------------------------------------------------------

def step_boot(verbose, ctx):
    return fa.step_boot(verbose, ctx)


# -- Step 6: mission ---------------------------------------------------------

def step_mission(verbose, ctx):
    return fa.step_mission(verbose, ctx)


STEPS = {
    1: step_export_old,
    2: step_scaffold_old,
    3: step_upgrade,
    4: step_converged,
    5: step_boot,
    6: step_mission,
}


def main():
    fa._utf8_streams()
    parser = argparse.ArgumentParser(
        description="Upgrade-path acceptance: scaffold at an older release, upgrade to head.")
    parser.add_argument("--from-ref", default=DEFAULT_FROM_REF,
                        help="git ref of the older release (default: %(default)s, v3.8.89)")
    parser.add_argument("--verbose", action="store_true", help="stream subprocess output")
    parser.add_argument("--keep", action="store_true", help="leave the sandbox for inspection")
    args = parser.parse_args()

    # fleet_acceptance's mission step reads these module globals and its own run().
    fa.WS = WS
    fa.run = run

    start = time.monotonic()
    ctx = {"from_ref": args.from_ref}
    results = []
    RUN_ROOT.mkdir(parents=True, exist_ok=True)

    failed = False
    for num in sorted(STEPS):
        if failed:
            status, reason = "SKIP", "an earlier step failed"
        elif time.monotonic() - start > TOTAL_TIMEOUT_SECONDS:
            status, reason = "SKIP", "runtime ceiling reached before this step could start"
        else:
            step_start = time.monotonic()
            try:
                status, reason = STEPS[num](args.verbose, ctx)
            except Exception as exc:
                status, reason = "FAIL", f"unhandled exception: {exc!r}"
            if status == "PASS":
                reason = f"{reason} [{time.monotonic() - step_start:.0f}s]".strip()
        failed = failed or status == "FAIL"
        results.append(status)
        lines = reason.splitlines() or [""]
        print(f"[{status}] {num} {STEP_NAMES[num]} - {lines[0]}".rstrip(" -"))
        for line in lines[1:]:
            print(f"    {line}")

    if args.keep:
        print(f"--keep: sandbox left at {RUN_ROOT}", file=sys.stderr)
    else:
        try:
            _safe_rmtree(RUN_ROOT)
        except Exception as exc:
            print(f"WARNING: failed to clean up {RUN_ROOT}: {exc!r}", file=sys.stderr)

    passed = results.count("PASS")
    total = len(STEPS)
    elapsed = time.monotonic() - start
    if passed == total:
        print(f"UPGRADE ACCEPTANCE: PASS ({elapsed:.0f}s)")
        sys.exit(0)
    print(f"UPGRADE ACCEPTANCE: FAIL ({passed}/{total}, {elapsed:.0f}s)")
    sys.exit(1)


if __name__ == "__main__":
    main()
