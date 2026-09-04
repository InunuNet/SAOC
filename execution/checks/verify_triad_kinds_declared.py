#!/usr/bin/env python3
"""F1 (mission verification-triad-gate) -- proves a linter exists (once @dev
implements it per this golden spec) that catches a UI/workflow contract which
does NOT declare all three triad kinds (`codex_qa`, `browser_deployed_check`,
`gws_inbox_check`) among its assertions.

Design under test (golden spec): execution/verify_triad_coverage.py, run as a
standalone script (no contract.py changes required -- it is invoked directly,
e.g. from a pre-gate hook or CI step, the same way verify_all_contracts_parse.py
already is).

Heuristic (documented honestly, see goldens/README.md "Limitations"):
  A contract is classified "UI/workflow" if ANY of its assertions' `command`
  or `target` fields contains a path-shaped reference under `app/` (the
  Next.js route tree). Any contract so classified must have at least one
  assertion of kind `codex_qa`, at least one of kind `browser_deployed_check`,
  and at least one of kind `gws_inbox_check` somewhere in its assertion list.

  This is a string-matching heuristic, not semantic analysis. Known failure
  modes (documented, not silently assumed away):
    - False negative: a UI contract whose assertions never literally mention
      an `app/` path (e.g. they only assert against a Firestore collection
      name) is invisible to this linter and will NOT be required to carry
      the triad.
    - False positive: a non-UI contract whose shell command happens to grep
      an unrelated string containing "app/" (e.g. inside a comment or an
      unrelated file path) will be misclassified as UI/workflow and required
      to carry kinds it may not need.
  This check exercises three fixture contracts (clean-pass, missing-triad-fail,
  non-UI-exempt) against the not-yet-implemented linter and is EXPECTED to
  fail (RED) until @dev implements execution/verify_triad_coverage.py.
"""

from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LINTER = ROOT / "execution" / "verify_triad_coverage.py"

FAILURES: list = []

FIXTURE_UI_COMPLIANT = """
schema: athanor.contract/v1
slug: fixture-ui-compliant
goal: fixture
assertions:
  - id: A1
    description: touches app/ route
    kind: shell
    verify: {cmd: "test -f app/(marketing)/page.tsx"}
  - id: A2
    description: cross-model review
    kind: codex_qa
    verify: {kind: codex_qa, target: "app/(marketing)/page.tsx"}
  - id: A3
    description: deployed browser check
    kind: browser_deployed_check
    verify: {kind: browser_deployed_check, target: "https://beta.saoc.co.za/"}
  - id: A4
    description: inbox check
    kind: gws_inbox_check
    verify: {kind: gws_inbox_check, target: "vendor-confirmation"}
"""

FIXTURE_UI_MISSING_TRIAD = """
schema: athanor.contract/v1
slug: fixture-ui-missing-triad
goal: fixture
assertions:
  - id: A1
    description: touches app/ route, no triad kinds declared at all
    kind: shell
    verify: {cmd: "test -f app/(marketing)/page.tsx"}
"""

FIXTURE_NON_UI_EXEMPT = """
schema: athanor.contract/v1
slug: fixture-non-ui-exempt
goal: fixture
assertions:
  - id: A1
    description: pure backend/script check, no app/ path referenced
    kind: shell
    verify: {cmd: "test -f execution/quota.py"}
"""

# Regression fixture (2026-09-04 retry, defect #4): declares all three triad
# kinds ONLY via the top-level `kind:` field, with `verify:` carrying no
# `kind` of its own. contract.py's gate (contract.py:159, `kind =
# verify.get("kind", "")`) never reads a bare top-level `kind:` on a plain
# assertions-list item -- it is not one of the keys normalize_contract()
# synthesizes verify.kind from either (only the @architect `checks:`
# dict-format's `type:` field is). So a contract shaped exactly like this
# would pass a linter that credited top-level `kind:`, while the gate
# actually executes A2/A3/A4 as bare, uncovered shell checks -- the linter
# certifying the SHAPE of triad coverage rather than the TRUTH of it. This
# must still FAIL (exit 1), proving the fix in assertion_kind() (which now
# recognises only verify.kind and top-level `type`) closes that gap.
FIXTURE_UI_NONNORMALIZED_KEY_ONLY = """
schema: athanor.contract/v1
slug: fixture-ui-nonnormalized-key-only
goal: fixture
assertions:
  - id: A1
    description: touches app/ route
    kind: shell
    verify: {cmd: "test -f app/(marketing)/page.tsx"}
  - id: A2
    description: cross-model review, kind declared only at top level (not verify.kind, not type)
    kind: codex_qa
    verify: {target: "app/(marketing)/page.tsx"}
  - id: A3
    description: deployed browser check, kind declared only at top level
    kind: browser_deployed_check
    verify: {target: "https://beta.saoc.co.za/"}
  - id: A4
    description: inbox check, kind declared only at top level
    kind: gws_inbox_check
    verify: {target: "vendor-confirmation"}
"""

# Regression fixture (2026-09-04 retry, defect #5 -- Codex round 3): declares
# all three triad kinds ONLY via a top-level `type:` field, on a PLAIN
# `assertions:` LIST (not the @architect `assertions: {checks: [...]}` dict
# shape). contract.py only synthesizes verify.kind from a top-level `type:`
# inside the checks-dict shape (`check_type = check.get("type", "shell")`,
# contract.py's checks-dict branch); a plain assertions-LIST item is passed
# through untouched, so contract.py's gate (`kind = verify.get("kind", "")`,
# contract.py:159) never sees a kind for these items and executes them as
# bare, uncovered shell checks. A linter that credits top-level `type`
# regardless of shape (last round's fix) would wrongly certify this
# contract as triad-covered. This must still FAIL (exit 1), proving
# assertion_kind() now credits top-level `type` ONLY for checks-shape items.
FIXTURE_UI_TYPE_ONLY_PLAIN_LIST = """
schema: athanor.contract/v1
slug: fixture-ui-type-only-plain-list
goal: fixture
assertions:
  - id: A1
    description: touches app/ route
    type: shell
    verify: {cmd: "test -f app/(marketing)/page.tsx"}
  - id: A2
    description: cross-model review, type declared only at top level on a plain assertions LIST item (contract.py never reads top-level type for this shape)
    type: codex_qa
    verify: {target: "app/(marketing)/page.tsx"}
  - id: A3
    description: deployed browser check, type declared only at top level, plain list shape
    type: browser_deployed_check
    verify: {target: "https://beta.saoc.co.za/"}
  - id: A4
    description: inbox check, type declared only at top level, plain list shape
    type: gws_inbox_check
    verify: {target: "vendor-confirmation"}
"""


def check(name: str, cond: bool, detail: str = "") -> None:
    if cond:
        print(f"  ok   {name}")
    else:
        print(f"  FAIL {name} {detail}")
        FAILURES.append(name)


def run_linter(contract_text: str) -> subprocess.CompletedProcess:
    with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as tf:
        tf.write(contract_text)
        path = tf.name
    try:
        return subprocess.run(
            [sys.executable, str(LINTER), path], cwd=str(ROOT),
            capture_output=True, text=True, timeout=30,
        )
    finally:
        Path(path).unlink(missing_ok=True)


def main() -> int:
    check("execution/verify_triad_coverage.py exists", LINTER.is_file(),
          f"missing {LINTER} -- not yet implemented by @dev")
    if not LINTER.is_file():
        check("compliant UI contract -> exit 0", False, "linter does not exist yet")
        check("UI contract missing triad kinds -> exit 1", False, "linter does not exist yet")
        check("non-UI contract -> exempt, exit 0", False, "linter does not exist yet")
        check("UI contract declaring triad kinds only via non-normalised top-level "
              "`kind:` -> exit 1", False, "linter does not exist yet")
        check("UI contract declaring triad kinds only via top-level `type:` on a "
              "plain assertions LIST -> exit 1", False, "linter does not exist yet")
        print(f"\n{len(FAILURES)} case(s) failed: {FAILURES}")
        return 1

    r1 = run_linter(FIXTURE_UI_COMPLIANT)
    check("compliant UI contract -> exit 0", r1.returncode == 0,
          f"got {r1.returncode}: {(r1.stdout + r1.stderr)[:300]}")

    r2 = run_linter(FIXTURE_UI_MISSING_TRIAD)
    check("UI contract missing triad kinds -> exit 1 (not silently 0)", r2.returncode == 1,
          f"got {r2.returncode}: {(r2.stdout + r2.stderr)[:300]}")

    r3 = run_linter(FIXTURE_NON_UI_EXEMPT)
    check("non-UI contract -> exempt, exit 0", r3.returncode == 0,
          f"got {r3.returncode}: {(r3.stdout + r3.stderr)[:300]}")

    r4 = run_linter(FIXTURE_UI_NONNORMALIZED_KEY_ONLY)
    check("UI contract declaring triad kinds only via non-normalised top-level "
          "`kind:` -> exit 1, not falsely certified (2026-09-04 retry regression)",
          r4.returncode == 1,
          f"got {r4.returncode}: {(r4.stdout + r4.stderr)[:300]}")

    r5 = run_linter(FIXTURE_UI_TYPE_ONLY_PLAIN_LIST)
    check("UI contract declaring triad kinds only via top-level `type:` on a plain "
          "assertions LIST -> exit 1, not falsely certified (2026-09-04 Codex round 3 "
          "regression)",
          r5.returncode == 1,
          f"got {r5.returncode}: {(r5.stdout + r5.stderr)[:300]}")

    if FAILURES:
        print(f"\n{len(FAILURES)} case(s) failed: {FAILURES}")
        return 1
    print("\nAll verify_triad_coverage.py cases passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
