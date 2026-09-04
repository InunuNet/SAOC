#!/usr/bin/env python3
"""verify_triad_coverage.py -- coverage linter for the verification triad.

Usage:
    python3 execution/verify_triad_coverage.py <contract.yaml>

Classifies the given contract as "UI/workflow" or "non-UI", then:
  - a UI/workflow contract must declare at least one assertion of each of the
    three triad kinds (codex_qa, browser_deployed_check, gws_inbox_check)
    somewhere in its assertion list -- exit 0 if it does, exit 1 if it does
    not (never a silent exit 0 on a missing triad).
  - a non-UI contract is exempt -- exit 0 unconditionally.
  - a contract file that cannot be found or parsed is a usage error -- exit 2,
    never treated as either compliant or non-UI by default.

Classification heuristic (golden spec, goldens/README.md design answer 5):
a contract is "UI/workflow" if ANY assertion's command/cmd/target string
contains a path-shaped reference under `app/` (this project's Next.js route
tree) -- e.g. "app/(marketing)/page.tsx" or "app/api/vendors/route.ts".

Known limitations (ship honestly, per project convention -- do not discover
these in production):
  - False negative: a UI contract whose assertions only ever reference a
    Firestore collection name or an API route with no literal `app/`
    substring is invisible to this linter and will not be flagged.
  - False positive: a non-UI contract whose shell command happens to contain
    the substring `app/` unrelated to the Next.js route tree (e.g. inside a
    quoted string or a comment) gets misclassified as UI/workflow and
    required to carry triad kinds it may not need.
This is a string-matching heuristic over assertion command/target text, not
semantic analysis of what a feature actually touches. It is a backstop
against a mission forgetting the rule, not a formal proof of coverage --
architect/orchestrator judgement (per workflow.md's existing chain) remains
the primary enforcement mechanism.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

APP_PATH_PATTERN = re.compile(r"\bapp/")
TRIAD_KINDS = ("codex_qa", "browser_deployed_check", "gws_inbox_check")


def usage_error(message: str) -> int:
    print(f"verify_triad_coverage.py: {message}", file=sys.stderr)
    return 2


def load_contract(path: str):
    p = Path(path)
    if not p.exists():
        return None, f"contract file not found: {path}"
    try:
        import yaml
        with open(p) as f:
            data = yaml.safe_load(f)
    except ImportError:
        return None, "PyYAML is required to parse contract.yaml files"
    except Exception as exc:
        return None, f"failed to parse {path}: {exc}"
    if not isinstance(data, dict):
        return None, f"contract {path} did not parse to a mapping"
    return data, None


def iter_assertions(contract: dict):
    """Yield each assertion dict, tolerating both the internal `assertions:`
    list format and the @architect `assertions: {phase, checks: [...]}`
    format -- this linter runs standalone against author-written contract
    files, before contract.py's own normalize_contract() has touched them."""
    assertions_raw = contract.get("assertions", [])
    if isinstance(assertions_raw, dict) and "checks" in assertions_raw:
        yield from assertions_raw.get("checks", [])
    elif isinstance(assertions_raw, list):
        yield from assertions_raw
    for phase_items in (contract.get("phases_raw") or {}).values():
        yield from (phase_items or [])


def assertion_text_fields(assertion: dict):
    """All string fields on one assertion that might carry an app/ path or a
    triad-kind marker: command/cmd/target at the top level, and the same
    inside a nested verify: block (either shape appears across this
    project's contracts)."""
    fields = []
    for key in ("command", "cmd", "target"):
        val = assertion.get(key)
        if isinstance(val, str):
            fields.append(val)
    verify = assertion.get("verify")
    if isinstance(verify, dict):
        for key in ("cmd", "target"):
            val = verify.get(key)
            if isinstance(val, str):
                fields.append(val)
    return fields


def assertion_kind(assertion: dict) -> str:
    """The declared kind for one assertion, recognising exactly the key(s)
    contract.py itself actually normalises/reads -- never a lookalike key
    contract.py ignores.

    contract.py's gate execution (check_cmd) reads ONLY
    assertion["verify"]["kind"] at run time -- see contract.py:159 (`kind =
    verify.get("kind", "")`). The one place a top-level key feeds into that
    is normalize_contract()'s @architect `checks:` dict-format branch, which
    reads `check.get("type", "shell")` and synthesizes `verify: {kind: ...}`
    from it before execution (contract.py:159's sibling in
    normalize_contract). A top-level `kind:` field on a plain `assertions:`
    list item is read by NEITHER path -- contract.py never looks at it, so a
    contract could carry a top-level `kind: browser_deployed_check` with no
    matching `verify.kind` and this linter would wrongly certify triad
    coverage while the gate executes that assertion as a bare, uncovered
    shell check. Recognise only `verify.kind` (the shape contract.py always
    ends up reading) and top-level `type` (the one shape contract.py
    normalises into it) -- never top-level `kind`.
    """
    verify = assertion.get("verify")
    if isinstance(verify, dict) and verify.get("kind"):
        return str(verify["kind"])
    val = assertion.get("type")
    if isinstance(val, str):
        return val
    return "shell"


def is_ui_workflow_contract(contract: dict) -> bool:
    for assertion in iter_assertions(contract):
        if not isinstance(assertion, dict):
            continue
        for text in assertion_text_fields(assertion):
            if APP_PATH_PATTERN.search(text):
                return True
    return False


def declared_kinds(contract: dict) -> set:
    kinds = set()
    for assertion in iter_assertions(contract):
        if isinstance(assertion, dict):
            kinds.add(assertion_kind(assertion))
    return kinds


def main() -> int:
    if len(sys.argv) != 2:
        return usage_error("usage: verify_triad_coverage.py <contract.yaml>")

    contract, err = load_contract(sys.argv[1])
    if err is not None:
        return usage_error(err)

    if not is_ui_workflow_contract(contract):
        print(f"EXEMPT: {sys.argv[1]} does not reference an app/ path -- non-UI, no triad required")
        return 0

    present = declared_kinds(contract)
    missing = [kind for kind in TRIAD_KINDS if kind not in present]
    if missing:
        print(f"FAIL: {sys.argv[1]} is a UI/workflow contract (references an app/ path) "
              f"but is missing triad kind(s): {', '.join(missing)}")
        return 1

    print(f"PASS: {sys.argv[1]} is a UI/workflow contract and declares all triad kinds "
          f"({', '.join(TRIAD_KINDS)})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
