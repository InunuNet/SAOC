#!/usr/bin/env python3
"""verify_f2_phases_dict_classification.py -- proves the carried-forward
phases_raw/phases false-negative (mission verification-triad-gate M2/F2) is
actually fixed in execution/verify_triad_coverage.py.

Background: iter_assertions_with_shape() reads contract.get("phases_raw"),
but an author-written contract's real YAML key is `phases` -- `phases_raw`
is synthesized only inside execution/contract.py's own normalize_contract(),
which this standalone linter never runs. So a contract authored entirely in
the raw phases-dict shape (`phases: {<key>: [...]}`, no top-level
`assertions:` list) is invisible to the linter today: it sees zero
assertions, is_ui_workflow_contract() returns False, and the linter prints
"EXEMPT" -- a false non-UI classification -- instead of correctly seeing the
app/ reference and the declared triad kinds.

This check asserts the LINTER'S OWN MESSAGE, not just its exit code, for two
fixtures:
  1. f2_fixture_phases_dict_compliant.yaml -- all three triad kinds present,
     only reachable via the phases-dict branch. Must report a message
     starting with "PASS:" once fixed (an "EXEMPT:" or a bare exit-0 without
     the PASS message is the pre-fix false negative and must FAIL this
     check).
  2. f2_fixture_phases_dict_missing_gws.yaml -- same shape, gws_inbox_check
     omitted. Must report "FAIL:" naming gws_inbox_check specifically, not
     fall back to "EXEMPT:" (which would mean the fix broke classification)
     and not report PASS (which would mean the fix stopped short of
     checking completeness once it could see into the shape).

Asserting on message text, not exit code alone, is required by this
project's own audited defect class: an assertion satisfiable by something
other than the real property under test (see
.agent/memory/scratch/2026-09-04-codex-f1-verification-triad-gate.md,
"Standing lesson for @maintainer"). EXEMPT and PASS both exit 0; only the
message text distinguishes the false negative from the real fix.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
LINTER = REPO_ROOT / "execution" / "verify_triad_coverage.py"
FIXTURES_DIR = (
    REPO_ROOT
    / ".agent"
    / "memory"
    / "project"
    / "specs"
    / "verification-triad-gate"
    / "goldens"
    / "fixtures"
)

COMPLIANT_FIXTURE = FIXTURES_DIR / "f2_fixture_phases_dict_compliant.yaml"
MISSING_GWS_FIXTURE = FIXTURES_DIR / "f2_fixture_phases_dict_missing_gws.yaml"


def run_linter(fixture: Path) -> tuple[int, str]:
    result = subprocess.run(
        [sys.executable, str(LINTER), str(fixture)],
        capture_output=True,
        text=True,
        timeout=30,
    )
    return result.returncode, (result.stdout + result.stderr)


def main() -> int:
    failures = []

    if not COMPLIANT_FIXTURE.exists():
        failures.append(f"missing fixture: {COMPLIANT_FIXTURE}")
    if not MISSING_GWS_FIXTURE.exists():
        failures.append(f"missing fixture: {MISSING_GWS_FIXTURE}")
    if failures:
        for f in failures:
            print(f"FAIL: {f}", file=sys.stderr)
        return 1

    # Case 1: fully-compliant phases-dict contract must PASS, not EXEMPT.
    rc, output = run_linter(COMPLIANT_FIXTURE)
    if "EXEMPT:" in output:
        print(
            "FAIL: linter still reports EXEMPT for a phases-dict contract that "
            "references app/ and declares all three triad kinds -- the "
            "phases_raw/phases false-negative is NOT fixed. Output:\n" + output,
            file=sys.stderr,
        )
        return 1
    if rc != 0 or "PASS:" not in output:
        print(
            f"FAIL: expected exit 0 with a 'PASS:' message for the compliant "
            f"phases-dict fixture, got exit {rc}:\n{output}",
            file=sys.stderr,
        )
        return 1
    print("ok: compliant phases-dict contract correctly reports PASS (not EXEMPT)")

    # Case 2: same shape, missing gws_inbox_check, must FAIL naming it --
    # not fall back to EXEMPT (classification would be broken) and not PASS
    # (completeness checking would be broken).
    rc, output = run_linter(MISSING_GWS_FIXTURE)
    if "EXEMPT:" in output:
        print(
            "FAIL: linter reports EXEMPT for an incomplete phases-dict UI "
            "contract -- classification regressed to non-UI instead of "
            "correctly seeing the app/ reference. Output:\n" + output,
            file=sys.stderr,
        )
        return 1
    if rc != 1 or "FAIL:" not in output or "gws_inbox_check" not in output:
        print(
            f"FAIL: expected exit 1 with a FAIL message naming gws_inbox_check "
            f"for the incomplete phases-dict fixture, got exit {rc}:\n{output}",
            file=sys.stderr,
        )
        return 1
    print("ok: incomplete phases-dict contract correctly reports FAIL naming gws_inbox_check")

    print("PASS: phases-dict false-negative is fixed -- classification and "
          "completeness both correct via the raw phases-dict branch")
    return 0


if __name__ == "__main__":
    sys.exit(main())
