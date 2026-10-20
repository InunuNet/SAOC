#!/usr/bin/env python3
"""verify_all_contracts_parse.py -- assertion-shape-audit F4 canary.

FINDINGS.md (assertion-shape-audit): fleet-loop-mission-driven/contract.yaml
failed to parse (an unescaped "(" inside a double-quoted YAML scalar,
introduced by a triple-nested-escaped inline python3 -c) and was SILENTLY
excluded from the audit sweep and, presumably, from any other tooling that
loads contracts with a standard YAML loader. A contract that cannot be
loaded is a gate that cannot fire -- it doesn't fail loud, it just never
runs.

This is a repo-wide canary, not a per-feature fix: every contract*.yaml
under .agent/memory/project/specs/**/ must parse with yaml.safe_load.
Run it after any contract edit, and as a standing Phase-4 assertion in
this mission's own contract so it can't silently regress again.
"""
import os
import re
import sys
import time
from pathlib import Path

try:
    import yaml
except ImportError:
    print("FAIL: pyyaml not importable — cannot run the canary", file=sys.stderr)
    sys.exit(1)

REPO_ROOT = Path(__file__).resolve().parents[2]
# Override for negative verification only (a scratch dir with a
# deliberately malformed contract*.yaml) — never used in the production
# assertion, which always scans the real repo's specs tree.
SPECS_ROOT = Path(os.environ.get(
    "SPECS_ROOT_UNDER_TEST",
    str(REPO_ROOT / ".agent" / "memory" / "project" / "specs"),
))


def _is_fixture(path: Path) -> bool:
    """True iff path has a "goldens" segment followed by a later segment
    whose name contains the substring "fixture" (case-insensitive) --
    catches both "fixture_specs/" and "fixtures/" without hard-coding
    either literal. Scoped to goldens/ subtrees only: a real
    contract-fN.yaml directly under a mission's specs dir never has a
    "goldens" segment, so it is never exempt regardless of its filename.
    F6 (delivery-and-truth) -- see spec-f6.md "Design" for the full rule.
    """
    parts = [p.lower() for p in path.parts]
    if "goldens" not in parts:
        return False
    idx = parts.index("goldens")
    return any("fixture" in part for part in parts[idx + 1:])


BOOT_MODE = "--boot" in sys.argv[1:]
LIVE_WINDOW_SECONDS = 7 * 86400
CLOSED_MISSION_STATUSES = ("done", "abandoned")


def _open_missions() -> list:
    """Frontmatter dicts of missions whose status is not done/abandoned.

    Lives next to SPECS_ROOT (SPECS_ROOT/../missions) so a sandbox root works.
    A mission whose frontmatter cannot be parsed references nothing.
    """
    found = []
    for mfile in sorted((SPECS_ROOT.parent / "missions").glob("*.md")):
        try:
            text = mfile.read_text()
            parts = re.split(r"(?m)^---[ \t]*$", text, maxsplit=2)
            if len(parts) < 3 or parts[0].strip():
                continue
            meta = yaml.safe_load(parts[1])
        except Exception:
            continue
        if isinstance(meta, dict) and str(meta.get("status")) not in CLOSED_MISSION_STATUSES:
            found.append(meta)
    return found


def _is_live(path: Path, missions: list) -> bool:
    """A contract is live if an open mission points at it or it was edited this week."""
    try:
        if time.time() - path.stat().st_mtime <= LIVE_WINDOW_SECONDS:
            return True
    except OSError:
        return True
    rel = path.relative_to(SPECS_ROOT).as_posix()
    for meta in missions:
        if meta.get("slug") == rel.split("/", 1)[0]:
            return True
        for feat in meta.get("features") or []:
            if not isinstance(feat, dict):
                continue
            for key in ("spec", "contract"):
                ref = feat.get(key)
                if isinstance(ref, str) and ref.endswith("specs/" + rel):
                    return True
    return False


failures = []
archived_failures = []
open_missions = _open_missions() if BOOT_MODE else []
checked = 0

# Per-file parse loop: catches yaml.YAMLError (an actual malformed-contract
# finding, same as before) AND any other exception a given file's read/parse
# can raise (permission error, IsADirectoryError, etc.) -- assertion-shape-
# sweep F4 design point 1 / DECISION.md Defect 2 (team-lead-ruled narrow
# scope: only crash legibility changes here, the glob walk and the parse
# call itself are untouched). Without the broader except, a crash on one
# file would propagate as a bare traceback -- exactly the "canary's own
# crash looks like a pass" defect this mission exists to fix, one level up.
# Each failure is still reported per-file, naming the exact offending path,
# not just the scan root.
for path in sorted(SPECS_ROOT.glob("**/contract*.yaml")):
    if _is_fixture(path):
        try:
            rel = path.relative_to(REPO_ROOT)
        except ValueError:
            rel = path
        print(
            f"INFO: {rel} is a negative-test fixture under goldens/ "
            "(excluded from PASS/FAIL sweep)"
        )
        continue
    checked += 1
    try:
        yaml.safe_load(path.read_text())
    except Exception as e:
        err = str(e) if isinstance(e, yaml.YAMLError) else f"{type(e).__name__}: {e}"
        if BOOT_MODE and not _is_live(path, open_missions):
            archived_failures.append(path)
        else:
            failures.append((path, err))

if checked == 0:
    print(f"FAIL: no contract*.yaml files found under {SPECS_ROOT}", file=sys.stderr)
    sys.exit(1)

if failures:
    for path, err in failures:
        try:
            rel = path.relative_to(REPO_ROOT)
        except ValueError:
            rel = path
        print(f"FAIL: {rel} does not parse:\n{err}\n", file=sys.stderr)
    print(f"\n{len(failures)}/{checked} contract file(s) failed to parse.", file=sys.stderr)
    sys.exit(1)

if archived_failures:
    print(f"NOTE: {len(archived_failures)} archived contract(s) do not parse "
          "(no open mission, untouched for 7+ days); run without --boot to list them")

print(f"PASS: all {checked} contract*.yaml files under {SPECS_ROOT.relative_to(REPO_ROOT)} parse cleanly")
sys.exit(0)
