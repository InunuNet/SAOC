#!/usr/bin/env python3
"""verify_f2_mixed_shape_masquerade.py -- proves execution/verify_triad_
coverage.py credits a contract's `phases:` dict ONLY under the exact
condition execution/contract.py's own normalize_contract() uses to fold
phase-derived assertions into the assertions list it actually executes
(mission verification-triad-gate M2/F2, regression surfaced by the Codex
GPT-5.5 pass and reproduced by @lead).

Background (execution/contract.py:118-132, the "Normalize phase-dict
format" block): contract.py computes `extra_assertions` from a `phases:`
dict unconditionally, but only ASSIGNS them into `c["assertions"]` when

    if not c.get("assertions"):
        c["assertions"] = extra_assertions

i.e. only when the top-level `assertions` key is absent, None, or an empty
list. When a truthy top-level `assertions:` (a non-empty list, in practice)
is already present, every `phases:` entry is computed and then discarded --
contract.py's gate execution never sees or runs them.

verify_triad_coverage.py's iter_assertions_with_shape() yielded the
`phases:` branch as a separate, unconditional `if` -- not gated on whether
the top-level `assertions_raw` was truthy -- so it credited triad kinds
declared only in `phases:` even when contract.py would discard them. A
contract could carry a bare, uncovered shell check in `assertions:` plus a
fully triad-compliant `phases:` dict that the real gate never executes, and
still earn a green "PASS" from this linter -- a green gate blessing
verification that never ran, the exact failure class this mission exists
to eliminate.

This check proves BOTH directions via the linter's own message text, not
exit code alone (this project's audited "assertion satisfiable by
something other than the real property" defect class -- EXEMPT and PASS
both exit 0):

  1. f2_fixture_mixed_shape_masquerade.yaml -- non-empty top-level
     `assertions:` (one bare shell check, no triad kind) alongside a fully
     triad-compliant `phases:` dict. contract.py's own condition means the
     `phases:` entries are discarded. Must report FAIL naming all three
     missing triad kinds, never PASS and never EXEMPT.

  2. f2_fixture_empty_list_phases_dict_compliant.yaml -- explicit
     `assertions: []` (falsy, same as a missing key under Python's `not`)
     alongside the same triad-compliant `phases:` dict. contract.py's own
     condition means the `phases:` entries ARE folded in and DO execute.
     Must still report PASS -- proving the fix does not overcorrect and
     regress the phases-only fixtures' PASS case (A4/A10's property) back
     into the original phases_raw/phases blind spot.

The correct rule: credit `phases:` entries in the linter's coverage
calculation only when `not contract.get("assertions")` -- mirroring
contract.py:131-132's exact condition, not an approximation of it.
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

MASQUERADE_FIXTURE = FIXTURES_DIR / "f2_fixture_mixed_shape_masquerade.yaml"
EMPTY_LIST_FIXTURE = FIXTURES_DIR / "f2_fixture_empty_list_phases_dict_compliant.yaml"

TRIAD_KINDS = ("codex_qa", "browser_deployed_check", "gws_inbox_check")


def run_linter(fixture: Path) -> tuple[int, str]:
    result = subprocess.run(
        [sys.executable, str(LINTER), str(fixture)],
        capture_output=True,
        text=True,
        timeout=30,
    )
    return result.returncode, (result.stdout + result.stderr)


def main() -> int:
    missing = [str(f) for f in (MASQUERADE_FIXTURE, EMPTY_LIST_FIXTURE) if not f.exists()]
    if missing:
        for f in missing:
            print(f"FAIL: missing fixture: {f}", file=sys.stderr)
        return 1

    # Case 1: truthy top-level `assertions:` list discards `phases:` in the
    # real gate -- the linter must not credit the discarded triad kinds.
    rc, output = run_linter(MASQUERADE_FIXTURE)
    if "EXEMPT:" in output:
        print(
            "FAIL: linter reports EXEMPT for the mixed-shape masquerade fixture -- "
            "MSQ-01's app/ reference in the top-level assertions: list should still "
            "be visible regardless of the phases: crediting fix. Output:\n" + output,
            file=sys.stderr,
        )
        return 1
    if rc != 1 or "FAIL:" not in output:
        print(
            "FAIL: expected exit 1 with a FAIL message for the mixed-shape "
            "masquerade fixture (top-level assertions: present -> phases: must "
            f"be discarded, not credited), got exit {rc}:\n{output}",
            file=sys.stderr,
        )
        return 1
    missing_kinds_named = [kind for kind in TRIAD_KINDS if kind not in output]
    if missing_kinds_named:
        print(
            "FAIL: expected the FAIL message to name all three missing triad kinds "
            f"({', '.join(TRIAD_KINDS)}) -- the phases: dict must not credit ANY of "
            f"them once a truthy top-level assertions: list is present. Kinds not "
            f"named in output: {', '.join(missing_kinds_named)}\nOutput:\n{output}",
            file=sys.stderr,
        )
        return 1
    print(
        "ok: mixed-shape masquerade fixture correctly reports FAIL naming all three "
        "missing triad kinds -- decorative phases: entries discarded by contract.py "
        "are correctly NOT credited"
    )

    # Case 2: explicit `assertions: []` is falsy under contract.py's own
    # `not c.get("assertions")` check -- phases: entries DO get folded in
    # and DO execute, so the linter must still credit them and PASS.
    rc, output = run_linter(EMPTY_LIST_FIXTURE)
    if "EXEMPT:" in output:
        print(
            "FAIL: linter reports EXEMPT for the empty-list phases-dict-compliant "
            "fixture -- classification regressed back to the original "
            "phases_raw/phases blind spot. Output:\n" + output,
            file=sys.stderr,
        )
        return 1
    if rc != 0 or "PASS:" not in output:
        print(
            "FAIL: expected exit 0 with a 'PASS:' message for the empty-list "
            "phases-dict-compliant fixture (assertions: [] is falsy, so "
            "contract.py folds phases: in and executes it), got exit "
            f"{rc}:\n{output}",
            file=sys.stderr,
        )
        return 1
    print(
        "ok: empty-list phases-dict-compliant fixture correctly still reports PASS "
        "-- the fix does not overcorrect the falsy-empty-list edge case"
    )

    print(
        "PASS: verify_triad_coverage.py credits phases: entries only under "
        "contract.py's exact 'not c.get(\"assertions\")' condition -- the "
        "mixed-shape masquerade is closed without regressing the falsy-empty-list "
        "edge case"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
