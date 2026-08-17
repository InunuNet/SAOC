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
import sys
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


failures = []
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
    checked += 1
    try:
        yaml.safe_load(path.read_text())
    except yaml.YAMLError as e:
        failures.append((path, str(e)))
    except Exception as e:
        failures.append((path, f"{type(e).__name__}: {e}"))

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

print(f"PASS: all {checked} contract*.yaml files under {SPECS_ROOT.relative_to(REPO_ROOT)} parse cleanly")
sys.exit(0)
