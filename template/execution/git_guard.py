#!/usr/bin/env python3
"""git_guard.py — per-workspace plus-addressed git identity + the local
pre-push discipline.

    python3 execution/git_guard.py identity [--repair]
    python3 execution/git_guard.py pre-push <remote-name> <remote-url>
        (stdin: "<local-ref> <local-sha> <remote-ref> <remote-sha>" per line
         — the standard git pre-push hook protocol)

JURISDICTION, tested in this order (onboarding-rework goldens/
f1_git_expectations.md §7). Both subcommands read it from the SAME profile
load, so identity and push discipline can never disagree about which
workspace they are standing in:

1. `project_name == harness_name` — a harness checkout. Unchanged from
   platform-scoped-delivery D4/D6: the platform-keyed IDENTITY_BY_PLATFORM map
   is the expectation and `--repair` still repairs (repo-local only, never
   global — a global write would leak the harness identity into every other
   repo on the machine).
2. `.agent/profile.json` carries `git.user_email` — a workspace provisioned by
   `execution/git_provision.py`. VERIFY ONLY: `user.email` AND `user.name` are
   compared against the recorded values, and `--repair` is REFUSED with the raw
   `git config` command to run instead. REQUIREMENTS §3 says the identity is
   written once at scaffold and never auto-repaired on boot; putting that
   policy here rather than in `full_boot.sh` keeps both policies true in their
   own jurisdiction without editing the shared boot script (DECISIONS.md D-G6).
   `git log` attribution on a shared remote uses the name as well as the
   address, so checking only the email would be a partial predicate.
3. Neither — a workspace this feature never provisioned. Exit 0 and print
   NOTHING. The harness has ~26 such workspaces; a boot-time complaint they
   cannot act on is how a verification becomes noise that gets ignored.

`pre-push`: installed via `git config core.hooksPath .agent/githooks` and
invoked by the tracked 3-line exec-shim at .agent/githooks/pre-push. Refuses
(a) any push to refs/heads/main unless ATHANOR_ALLOW_MAIN_PUSH=1 — in EVERY
jurisdiction, including an unprovisioned one — and (b) any NEW commit (not
already known to the remote) whose committer email is outside the allowlist
for the jurisdiction above: the platform map in a harness checkout, the single
recorded plus-address in a provisioned workspace, and no committer check at all
in an unprovisioned one (there is no recorded expectation to check against).

Stated plainly (DECISIONS.md D6, SPEC.md S2.2): this is NOT branch protection.
`--no-verify` or unsetting `core.hooksPath` bypasses it, and nothing here
configures GitHub-side protection on the remote. Its job is to make the wrong
action a deliberate, named act instead of a habit — not to make it impossible.
"""
from __future__ import annotations

import argparse
import json
import os
import platform as _platform
import subprocess
import sys
from pathlib import Path

ZERO_SHA = "0" * 40

# Single source of truth (platform-scoped-delivery D4). The attestation
# checker (execution/checks/verify_platform_attestation.py) imports this map
# rather than duplicating it.
IDENTITY_BY_PLATFORM = {
    "macos": "brad+athmac@inunu.net",
    "linux": "brad+athlin@inunu.net",
    "windows": "brad+athwin@inunu.net",
}

# Jurisdiction kinds. Values are internal; nothing parses them off stdout.
HARNESS = "harness"
DOWNSTREAM = "downstream"
UNPROVISIONED = "unprovisioned"


def detect_platform() -> str:
    """ATHANOR_PLATFORM override first, else uname — mirrors init.sh's
    detect_platform() vocabulary and precedence (platform-aware-delivery D2)."""
    override = os.environ.get("ATHANOR_PLATFORM", "").strip().lower()
    if override in IDENTITY_BY_PLATFORM:
        return override
    system = _platform.system()
    if system == "Darwin":
        return "macos"
    if system == "Linux":
        return "linux"
    if system == "Windows" or system.startswith(("MINGW", "MSYS", "CYGWIN")):
        return "windows"
    return "unknown"


def _git(args, cwd=None, **kw):
    return subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True, **kw)


def _repo_root() -> Path:
    r = _git(["rev-parse", "--show-toplevel"], cwd=str(Path.cwd()))
    if r.returncode == 0 and r.stdout.strip():
        return Path(r.stdout.strip())
    return Path.cwd()


def _load_profile(root: Path) -> dict:
    """The ONE profile read in this module. utf-8-sig because init.sh's
    scaffolded profile may carry a BOM and every other reader tolerates it."""
    try:
        data = json.loads(
            (root / ".agent" / "profile.json").read_text(encoding="utf-8-sig"))
    except (OSError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def jurisdiction(root: Path):
    """Return (kind, expectation) per the ordered test in the module docstring.

    `expectation` is {} for HARNESS and UNPROVISIONED, and
    {"user_email": ..., "user_name": ...} for DOWNSTREAM.
    """
    data = _load_profile(root)
    project = str(data.get("project_name") or "").strip()
    harness = str(data.get("harness_name") or "").strip()
    if harness and harness == project:
        return HARNESS, {}
    block = data.get("git")
    if isinstance(block, dict):
        email = str(block.get("user_email") or "").strip()
        if email:
            return DOWNSTREAM, {
                "user_email": email,
                "user_name": str(block.get("user_name") or "").strip(),
            }
    return UNPROVISIONED, {}


def is_harness_checkout(root: Path) -> bool:
    return jurisdiction(root)[0] == HARNESS


def fix_command(expected_email: str) -> str:
    """The copy-pasteable repair line, printed VERBATIM so it survives a boot
    log (goldens/f1_git_expectations.md KEY-FIX-TEMPLATE)."""
    return f'git config user.email "{expected_email}"'


# --------------------------------------------------------------------------- #
# identity
# --------------------------------------------------------------------------- #

def _identity_harness(args, root: Path) -> int:
    plat = detect_platform()
    if plat not in IDENTITY_BY_PLATFORM:
        print(f"git_guard identity: platform '{plat}' is not mapped; set "
              f"ATHANOR_PLATFORM to one of {sorted(IDENTITY_BY_PLATFORM)}",
              file=sys.stderr)
        return 2
    expected = IDENTITY_BY_PLATFORM[plat]
    current = _git(["config", "user.email"], cwd=str(root)).stdout.strip()
    if current == expected:
        print(f"git_guard identity: OK ({expected})")
        return 0
    if args.repair:
        r = _git(["config", "user.email", expected], cwd=str(root))
        if r.returncode != 0:
            print(f"git_guard identity: --repair failed to set user.email: "
                  f"{r.stderr.strip()}", file=sys.stderr)
            return 2
        print(f"git_guard identity: repaired repo-local user.email -> {expected}")
        return 0
    print(f"git_guard identity: user.email is '{current or '(unset)'}', "
          f"expected '{expected}' for platform '{plat}'. Fix: "
          "python3 execution/git_guard.py identity --repair", file=sys.stderr)
    return 2


def _identity_downstream(args, root: Path, expect: dict) -> int:
    exp_email = expect["user_email"]
    exp_name = expect["user_name"]
    cur_email = _git(["config", "user.email"], cwd=str(root)).stdout.strip()
    cur_name = _git(["config", "user.name"], cwd=str(root)).stdout.strip()

    problems = []
    if cur_email != exp_email:
        problems.append(
            f"user.email is '{cur_email or '(unset)'}', expected '{exp_email}'")
    if exp_name and cur_name != exp_name:
        problems.append(
            f"user.name is '{cur_name or '(unset)'}', expected '{exp_name}'")

    if not problems:
        # Nothing to report, and nothing for --repair to do either: a healthy
        # provisioned workspace must not acquire a boot-time complaint just
        # because full_boot.sh passes the flag unconditionally.
        print(f"git_guard identity: OK ({exp_email})")
        return 0

    fix_lines = [fix_command(exp_email)]
    if exp_name:
        fix_lines.append(f'git config user.name "{exp_name}"')

    if args.repair:
        # REQUIREMENTS §3, verbatim: "Never auto-repair on boot." The identity
        # is written ONCE at scaffold and verified thereafter. Repairing it
        # here would silently paper over a workspace that was deliberately
        # re-pointed, and boot is exactly where nobody is watching.
        print("git_guard identity: --repair is REFUSED in a provisioned "
              "downstream workspace — the identity is written once at scaffold "
              "and only verified afterwards (REQUIREMENTS §3).", file=sys.stderr)
    else:
        print("git_guard identity: MISMATCH against the identity recorded at "
              "scaffold in .agent/profile.json:", file=sys.stderr)
    for problem in problems:
        print(f"  - {problem}", file=sys.stderr)
    print("  Fix it yourself, in this repository:", file=sys.stderr)
    for line in fix_lines:
        print(f"    {line}", file=sys.stderr)
    return 2


def cmd_identity(args) -> int:
    root = _repo_root()
    kind, expect = jurisdiction(root)
    if kind == HARNESS:
        return _identity_harness(args, root)
    if kind == DOWNSTREAM:
        return _identity_downstream(args, root, expect)
    # UNPROVISIONED — no recorded expectation, so there is nothing to verify
    # and nothing honest to say. Silence is the contract (§7 KEY-LEGACY-RC).
    return 0


# --------------------------------------------------------------------------- #
# pre-push
# --------------------------------------------------------------------------- #

def _new_commit_shas(local_sha: str, remote_sha: str, remote_name: str, root: Path):
    """Commits about to be pushed that the remote does not already know about.

    A brand-new ref (remote_sha all-zero) has no direct range to diff against,
    so it excludes everything reachable from any locally-known remote-tracking
    ref for this remote instead (refs/remotes/<remote_name>/*) -- e.g. a
    commit already pushed on a different branch is not "new" again.
    """
    if remote_sha == ZERO_SHA:
        r = _git(["rev-list", local_sha, "--not", f"--remotes={remote_name}"], cwd=str(root))
    else:
        r = _git(["rev-list", f"{remote_sha}..{local_sha}"], cwd=str(root))
    if r.returncode != 0:
        return []
    return [line for line in r.stdout.strip().splitlines() if line]


def _committer_policy(root: Path):
    """(allowed emails, the fix line to quote) for this workspace, or
    (None, None) when no committer expectation is recorded — an unprovisioned
    workspace has nothing to compare against, and inventing one would refuse
    every push in ~26 legacy workspaces. The main-branch rule still applies."""
    kind, expect = jurisdiction(root)
    if kind == HARNESS:
        return (set(IDENTITY_BY_PLATFORM.values()),
                "python3 execution/git_guard.py identity --repair")
    if kind == DOWNSTREAM:
        return {expect["user_email"]}, fix_command(expect["user_email"])
    return None, None


def cmd_prepush(args) -> int:
    root = _repo_root()
    allow_main = os.environ.get("ATHANOR_ALLOW_MAIN_PUSH") == "1"
    known_emails, fix_hint = _committer_policy(root)
    refusals = []

    for line in sys.stdin.read().splitlines():
        parts = line.split()
        if len(parts) != 4:
            continue
        _local_ref, local_sha, remote_ref, remote_sha = parts
        if local_sha == ZERO_SHA:
            continue  # a delete -- nothing to check

        if remote_ref == "refs/heads/main" and not allow_main:
            refusals.append(
                "push to refs/heads/main is refused (no direct pushes to main -- "
                "branch -> PR -> merge via `gh pr merge`; override with "
                "ATHANOR_ALLOW_MAIN_PUSH=1)")
            continue

        if known_emails is None:
            continue

        for sha in _new_commit_shas(local_sha, remote_sha, args.remote, root):
            email = _git(["log", "-1", "--format=%ce", sha], cwd=str(root)).stdout.strip()
            if email not in known_emails:
                refusals.append(
                    f"commit {sha[:12]} has committer email '{email}', not a "
                    f"recognised plus-address ({', '.join(sorted(known_emails))}); "
                    f"fix with: {fix_hint}")

    if refusals:
        print("git_guard pre-push: REFUSED", file=sys.stderr)
        for msg in refusals:
            print(f"  - {msg}", file=sys.stderr)
        print("Honest limits: --no-verify or unsetting core.hooksPath defeats "
              "this guard (DECISIONS.md D6) -- its job is making the wrong "
              "action deliberate, not impossible.", file=sys.stderr)
        return 1
    return 0


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Athanor per-workspace git identity + pre-push discipline")
    sub = parser.add_subparsers(dest="cmd")

    idn = sub.add_parser("identity", help="Verify (and optionally repair) repo-local git identity")
    idn.add_argument("--repair", action="store_true", default=False)

    pp = sub.add_parser("pre-push", help="git pre-push hook body (stdin: ref update lines)")
    pp.add_argument("remote")
    pp.add_argument("url")

    return parser


def main(argv=None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.cmd == "identity":
        return cmd_identity(args)
    if args.cmd == "pre-push":
        return cmd_prepush(args)
    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
