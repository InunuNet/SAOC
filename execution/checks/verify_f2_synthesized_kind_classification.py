#!/usr/bin/env python3
"""verify_f2_synthesized_kind_classification.py -- proves
execution/verify_triad_coverage.py's assertion_kind() credits a top-level
`kind` field EXACTLY where contract.py's own normalize_contract() actually
synthesizes verify.kind from it, and nowhere else (mission
verification-triad-gate M2/F2, defect surfaced by the Codex GPT-5.5
mandatory pass).

Background (see execution/contract.py:107-130, the "Normalize phase-dict
format" block): for a raw `phases: {<phase_key>: [...]}` dict-shape item,
when the item's `verify` field is absent or a bare string, contract.py
synthesizes `verify = {"kind": a.get("kind", "shell"), ...}` -- i.e. it
DOES read and promote the item's top-level `kind`. But for a plain
`assertions:` LIST-shape item, contract.py does nothing at all: the item is
passed through to gate execution untouched, and check_cmd reads only
assertion["verify"]["kind"] at run time -- a top-level `kind` on a
plain-list item is never read by contract.py and is purely decorative.

Before this fix, assertion_kind()'s from_checks_shape boolean could not
distinguish "phases-dict item" from "plain-list item" (both set
from_checks_shape=False), so it either credited top-level `kind` for
neither shape (false-negative: blocks a genuinely compliant phases-dict
contract, see f2_fixture_phases_dict_synthesized_kind_compliant.yaml) or,
if fixed too broadly, credited it for both shapes (false-positive: lets a
plain-list contract masquerade as triad-covered via a decorative top-level
`kind` the gate never actually executes as that kind, see
f2_fixture_list_toplevel_kind_masquerade.yaml). Both fixtures must resolve
correctly for the shape signal to be considered tri-state, not merely
patched for one direction.

Asserts on the linter's own message text, not exit code alone, per this
project's audited "assertion satisfiable by something other than the real
property" defect class -- EXEMPT and PASS both exit 0, and a naive fix
could flip FAIL to PASS without actually discriminating the two shapes.
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

SYNTHESIZED_COMPLIANT_FIXTURE = (
    FIXTURES_DIR / "f2_fixture_phases_dict_synthesized_kind_compliant.yaml"
)
LIST_MASQUERADE_FIXTURE = FIXTURES_DIR / "f2_fixture_list_toplevel_kind_masquerade.yaml"


def run_linter(fixture: Path) -> tuple[int, str]:
    result = subprocess.run(
        [sys.executable, str(LINTER), str(fixture)],
        capture_output=True,
        text=True,
        timeout=30,
    )
    return result.returncode, (result.stdout + result.stderr)


def main() -> int:
    missing = [
        str(f) for f in (SYNTHESIZED_COMPLIANT_FIXTURE, LIST_MASQUERADE_FIXTURE) if not f.exists()
    ]
    if missing:
        for f in missing:
            print(f"FAIL: missing fixture: {f}", file=sys.stderr)
        return 1

    # Direction 1: phases-dict item declares its triad kind ONLY via a
    # top-level `kind` field (no nested verify: at all) -- contract.py
    # synthesizes verify.kind from it for this shape, so the linter must
    # credit it too. Must PASS, not EXEMPT (classification broken) and not
    # FAIL (the synthesis path still not credited).
    rc, output = run_linter(SYNTHESIZED_COMPLIANT_FIXTURE)
    if "EXEMPT:" in output:
        print(
            "FAIL: linter reports EXEMPT for a phases-dict contract that "
            "references app/ via a top-level `cmd` field -- app/ classification "
            "regressed for the synthesized-kind shape. Output:\n" + output,
            file=sys.stderr,
        )
        return 1
    if rc != 0 or "PASS:" not in output:
        print(
            "FAIL: expected exit 0 with a 'PASS:' message for the phases-dict "
            "contract whose triad kinds are declared only via a top-level "
            f"`kind:` field (no nested verify:), got exit {rc}:\n{output}",
            file=sys.stderr,
        )
        return 1
    print(
        "ok: phases-dict contract with synthesized-only kinds (no nested verify:) "
        "correctly reports PASS"
    )

    # Direction 2: plain assertions:-LIST item carries a decorative
    # top-level `kind: browser_deployed_check` with NO nested verify.kind.
    # contract.py never reads top-level `kind` for this shape, so crediting
    # it here would let an uncovered shell check masquerade as triad-covered.
    # Must FAIL, naming browser_deployed_check specifically.
    rc, output = run_linter(LIST_MASQUERADE_FIXTURE)
    if "EXEMPT:" in output:
        print(
            "FAIL: linter reports EXEMPT for a plain-list UI contract -- "
            "classification regressed to non-UI. Output:\n" + output,
            file=sys.stderr,
        )
        return 1
    if rc != 1 or "FAIL:" not in output or "browser_deployed_check" not in output:
        print(
            "FAIL: expected exit 1 with a FAIL message naming "
            "browser_deployed_check for the plain-list contract whose only "
            "browser_deployed_check signal is a decorative top-level `kind` "
            f"field, got exit {rc}:\n{output}",
            file=sys.stderr,
        )
        return 1
    print(
        "ok: plain-list contract's decorative top-level `kind` on a non-checks-shape "
        "item is correctly NOT credited -- reports FAIL naming browser_deployed_check"
    )

    print(
        "PASS: assertion_kind()'s shape signal correctly distinguishes "
        "phases-dict (credits top-level kind) from plain-list (does not) -- "
        "both the false-negative and the masquerade false-positive are closed"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
