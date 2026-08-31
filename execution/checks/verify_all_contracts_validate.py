#!/usr/bin/env python3
"""verify_all_contracts_validate.py -- delivery-integrity F7 corpus-wide sweep.

verify_all_contracts_parse.py (the assertion-shape-audit F4 canary) only
proves each contract*.yaml under the specs tree loads with yaml.safe_load.
A file can parse perfectly and still declare nothing executable -- no
`schema:`, no `created_at:`, an `assertions:` list with no `verify:` block
at all. That gap is exactly how 14 of 331 contracts went unnoticed while
failing `contract.py validate`, and it is why this sweep exists: it runs
the REAL `contract.py validate` against every non-retired contract file,
not merely a YAML parse.

Wired into `make audit` without `|| true` or a leading `-` -- a canary that
cannot fail is the same defect one level up (see verify_all_contracts_parse.py's
own docstring, and its `|| true` wiring in full_boot.sh, which this sweep does
not repeat).

Usage:
  verify_all_contracts_validate.py
  SPECS_ROOT_UNDER_TEST=<dir> verify_all_contracts_validate.py   (negative
    verification only -- points the sweep at a scratch specs tree instead of
    the real corpus; never used in the production `make audit` invocation)
"""
import os
import subprocess
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    print("FAIL: pyyaml not importable -- cannot run the sweep", file=sys.stderr)
    sys.exit(1)

REPO_ROOT = Path(__file__).resolve().parents[2]
CONTRACT_PY = REPO_ROOT / "execution" / "contract.py"
SPECS_ROOT = Path(os.environ.get(
    "SPECS_ROOT_UNDER_TEST",
    str(REPO_ROOT / ".agent" / "memory" / "project" / "specs"),
))


def _is_retired(path):
    try:
        c = yaml.safe_load(path.read_text())
    except Exception:
        return False
    return isinstance(c, dict) and str(c.get("status", "")).lower() == "retired"


def _relname(path):
    try:
        return str(path.relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


failures = []
checked = 0
skipped_retired = 0

for path in sorted(SPECS_ROOT.glob("**/contract*.yaml")):
    if _is_retired(path):
        skipped_retired += 1
        continue
    checked += 1
    p = subprocess.run(
        [sys.executable, str(CONTRACT_PY), "validate", str(path)],
        cwd=str(REPO_ROOT), capture_output=True, text=True, timeout=120,
    )
    if p.returncode != 0:
        failures.append((path, (p.stdout + p.stderr).strip()))

if checked == 0:
    print(f"FAIL: no contract*.yaml files found under {SPECS_ROOT}", file=sys.stderr)
    sys.exit(1)

if failures:
    for path, err in failures:
        print(f"FAIL: {_relname(path)} does not validate:\n{err}\n", file=sys.stderr)
    print(f"\n{len(failures)}/{checked} contract file(s) failed contract.py validate "
          f"({skipped_retired} retired file(s) skipped).", file=sys.stderr)
    sys.exit(1)

print(f"PASS: all {checked} non-retired contract*.yaml files under {SPECS_ROOT} pass "
      f"contract.py validate ({skipped_retired} retired file(s) skipped)")
sys.exit(0)
