#!/usr/bin/env python3
"""verify_platform_attestation.py — the cross-platform re-verification marker
is COMPUTED from git, never remembered (platform-scoped-delivery D3).

    python3 execution/checks/verify_platform_attestation.py --staleness \
        [--workspace-root R]
    python3 execution/checks/verify_platform_attestation.py --ownership RANGE \
        [--workspace-root R]

Ledger shape: .agent/platform-verification.yaml (one row per platform: the
commit its gate last ran green against ON ITS OWN MACHINE, verified_at, and
the committed gate report path). See
.agent/memory/project/specs/platform-scoped-delivery/goldens/platform_verification_f1.yaml.

--staleness: platform P is STALE at HEAD iff any path in
`git diff --name-only <row.commit>..HEAD` resolves (longest-prefix over
.agent/update-manifest.yaml; undeclared => conservatively [all]) to a scope
including P -- excluding the ledger file itself and
.agent/memory/project/gates/** (attestation updates must never re-stale
anyone, or the ledger livelocks). Prints one `<platform>: FRESH|STALE` line
per row.

Exit codes are DISTINCT on purpose (D10): 0 every row fresh, 2 at least one
row STALE (a verdict every row must report until the first real attestation,
so `make gate-fast` treats it as advisory), 4 STRUCTURAL -- the ledger is
missing or unparseable and no verdict could be computed at all. Folding 4 into
2 is what let a deleted ledger sail through a green gate.

--ownership RANGE: a commit in RANGE that touches the ledger may only change
the row belonging to the platform its committer email maps to
(execution/git_guard.py IDENTITY_BY_PLATFORM). Exit 2 naming the foreign row
on a violation, else 0.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "execution"))
import git_guard  # noqa: E402  (single source of IDENTITY_BY_PLATFORM)

LEDGER_REL = ".agent/platform-verification.yaml"
GATES_PREFIX = ".agent/memory/project/gates/"
MANIFEST_REL = ".agent/update-manifest.yaml"
PLATFORMS = ("macos", "linux", "windows")


STRUCTURAL_RC = 4   # D10: a structural failure, distinct from 2 (STALE)


def die(msg: str, rc: int = STRUCTURAL_RC) -> int:
    """Report a STRUCTURAL failure -- the ledger is missing, unparseable, or
    the resolver could not run at all.

    This is deliberately NOT exit 2. Exit 2 means "some row is stale", which
    every row must report until the first real attestation lands (D4), so
    gate-fast can only treat it as advisory. Collapsing both conditions into
    one code is what let a DELETED ledger pass a green gate."""
    print(f"ERROR: {msg}", file=sys.stderr)
    return rc


def _git(args, cwd):
    return subprocess.run(["git", *args], cwd=str(cwd), capture_output=True, text=True)


def load_yaml(text: str):
    import yaml
    return yaml.safe_load(text)


def load_manifest_entries(root: Path):
    p = root / MANIFEST_REL
    if not p.exists():
        return []
    data = load_yaml(p.read_text()) or {}
    return data.get("paths", []) or []


def resolve_platforms(entries, relpath: str):
    """Longest-prefix match. Returns a list of platform tokens, or None if
    the path is undeclared (no manifest entry's path is a prefix).

    The match is on PATH COMPONENT boundaries, never bare string prefixes --
    the same rule prune_foreign.resolve_platforms enforces, and here the
    consequence of getting it wrong points the UNSAFE way: a bare prefix makes
    `Makefile.local` inherit a scoped `Makefile` entry's narrow scope, so a
    change to it leaves the other two platforms falsely FRESH. Undeclared must
    resolve to None, which _relevant widens to the conservative ['all']."""
    best = None
    best_len = -1
    for entry in entries:
        prefix = str(entry.get("path", "")).strip().rstrip("/")
        if not prefix:
            continue
        if relpath == prefix or relpath.startswith(prefix + "/"):
            if len(prefix) > best_len:
                best_len = len(prefix)
                best = entry
    if best is None:
        return None
    plats = best.get("platforms")
    if not isinstance(plats, list) or not plats:
        return None
    return [str(p).strip().lower() for p in plats]


def _relevant(paths, entries):
    """Changed paths, excluding the ledger + gate reports, each resolved to
    its scope (undeclared -> conservatively [all])."""
    out = []
    for p in paths:
        if p == LEDGER_REL or p.startswith(GATES_PREFIX):
            continue
        scope = resolve_platforms(entries, p)
        if scope is None:
            scope = ["all"]
        out.append((p, scope))
    return out


def load_ledger(root: Path, ref: str = None):
    if ref is None:
        try:
            text = (root / LEDGER_REL).read_text()
        except OSError:
            # Absent (or unreadable) ledger is a normal state in a workspace
            # that has not been onboarded yet -- cmd_staleness turns None into
            # a named error. A traceback here would make an expected condition
            # look like a crash.
            return None
    else:
        r = _git(["show", f"{ref}:{LEDGER_REL}"], root)
        if r.returncode != 0:
            return None
        text = r.stdout
    try:
        data = load_yaml(text)
    except Exception:  # yaml.YAMLError -- a hand-edited ledger is untrusted text
        return None
    return data or {}


def cmd_staleness(root: Path) -> int:
    ledger = load_ledger(root)
    if not ledger or "platforms" not in ledger:
        return die(f"{LEDGER_REL} missing or malformed under {root}")
    entries = load_manifest_entries(root)
    any_stale = False
    for plat in PLATFORMS:
        row = (ledger.get("platforms") or {}).get(plat)
        if not isinstance(row, dict) or not row.get("commit"):
            print(f"{plat}: STALE (no attested commit)")
            any_stale = True
            continue
        commit = str(row["commit"])
        r = _git(["diff", "--name-only", f"{commit}..HEAD"], root)
        if r.returncode != 0:
            print(f"{plat}: STALE (cannot diff from {commit[:12]}: {r.stderr.strip()})")
            any_stale = True
            continue
        changed = [line for line in r.stdout.splitlines() if line.strip()]
        relevant = _relevant(changed, entries)
        staling = [p for p, scope in relevant if "all" in scope or plat in scope]
        if staling:
            print(f"{plat}: STALE")
            any_stale = True
        else:
            print(f"{plat}: FRESH")
    return 2 if any_stale else 0


def _changed_rows(before: dict, after: dict):
    b = (before or {}).get("platforms") or {}
    a = (after or {}).get("platforms") or {}
    return sorted(p for p in PLATFORMS if b.get(p) != a.get(p))


def cmd_ownership(root: Path, rng: str) -> int:
    r = _git(["rev-list", rng], root)
    if r.returncode != 0:
        return die(f"git rev-list {rng} failed: {r.stderr.strip()}")
    shas = [s for s in r.stdout.splitlines() if s.strip()]
    if not shas:
        print("ownership: no commits in range")
        return 0
    identity_to_platform = {v: k for k, v in git_guard.IDENTITY_BY_PLATFORM.items()}
    violations = []
    for sha in shas:
        files = _git(["show", "--name-only", "--format=", sha], root).stdout.splitlines()
        if LEDGER_REL not in [f.strip() for f in files]:
            continue
        parent = _git(["rev-parse", f"{sha}^"], root)
        before = load_ledger(root, parent.stdout.strip()) if parent.returncode == 0 else {}
        after = load_ledger(root, sha)
        changed = _changed_rows(before, after)
        if not changed:
            continue
        email = _git(["log", "-1", "--format=%ce", sha], root).stdout.strip()
        owner = identity_to_platform.get(email)
        foreign = [p for p in changed if p != owner]
        if foreign:
            violations.append((sha, email, owner, foreign))
    if violations:
        for sha, email, owner, foreign in violations:
            print(f"OWNERSHIP VIOLATION {sha[:12]}: committer '{email}' "
                  f"(platform {owner or 'UNMAPPED'}) modified foreign row(s): "
                  f"{', '.join(foreign)}")
        return 2
    print("ownership: OK")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--staleness", action="store_true", default=False)
    ap.add_argument("--ownership", default=None, metavar="RANGE")
    ap.add_argument("--workspace-root", default=".")
    args = ap.parse_args()
    root = Path(args.workspace_root).resolve()

    if args.staleness:
        return cmd_staleness(root)
    if args.ownership:
        return cmd_ownership(root, args.ownership)
    print("usage: verify_platform_attestation.py --staleness | --ownership RANGE", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
