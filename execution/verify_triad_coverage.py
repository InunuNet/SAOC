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

# Tri-state shape signal for iter_assertions_with_shape()/assertion_kind().
# Which top-level field (if any) contract.py's own normalize_contract()
# promotes into verify.kind is a property of the SHAPE an assertion came
# from, not a plain checks-vs-not boolean -- a boolean cannot distinguish
# "plain assertions: list item" (contract.py never reads a top-level field
# for these) from "phases: {...} dict item" (contract.py DOES promote
# top-level `kind`, but only when `verify` is absent or a bare string; see
# contract.py's phases-dict branch). Collapsing those two into one False
# value is exactly the defect the Codex GPT-5.5 pass caught (mission
# verification-triad-gate M2/F2, contract-f2.yaml A10).
SHAPE_CHECKS = "checks"
SHAPE_LIST = "list"
SHAPE_PHASES = "phases"


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


def iter_assertions_with_shape(contract: dict):
    """Yield (assertion, shape) pairs, tolerating all three shapes this
    project's contracts are authored in -- this linter runs standalone
    against author-written contract files, before contract.py's own
    normalize_contract() has touched them.

    shape is one of SHAPE_CHECKS, SHAPE_LIST, or SHAPE_PHASES, and encodes
    exactly which top-level field (if any) contract.py's own
    normalize_contract() promotes into verify.kind for that shape:
      - SHAPE_CHECKS: the @architect `assertions: {checks: [...]}` dict
        shape. contract.py synthesizes verify.kind from the item's
        top-level `type` (`check.get("type", "shell")`).
      - SHAPE_LIST: a plain `assertions:` LIST item. contract.py passes
        this through untouched -- no top-level field is ever read into
        verify.kind.
      - SHAPE_PHASES: an item from the raw `phases: {...}` dict shape.
        contract.py synthesizes verify.kind from the item's top-level
        `kind` (`a.get("kind", "shell")`), but ONLY when the item's
        `verify` field is absent or a bare string -- if `verify` is
        already a dict, contract.py uses it as-is and never reads
        top-level `kind` at all.
    A two-valued from_checks_shape boolean cannot distinguish SHAPE_LIST
    from SHAPE_PHASES -- collapsing them let a fix for one shape either
    miss the other (false negative) or over-credit it (false positive,
    letting a plain-list item's decorative top-level `kind` masquerade as
    triad coverage the gate never actually executes it as). See
    assertion_kind() for how each shape is scored.
    """
    assertions_raw = contract.get("assertions", [])
    if isinstance(assertions_raw, dict) and "checks" in assertions_raw:
        for assertion in assertions_raw.get("checks", []):
            yield assertion, SHAPE_CHECKS
    elif isinstance(assertions_raw, list):
        for assertion in assertions_raw:
            yield assertion, SHAPE_LIST

    # Raw author-written `phases: {<phase_key>: [{id, verify/kind/cmd, ...}]}` dict shape --
    # the same shape contract.py's own normalize_contract() detects via
    # `isinstance(c.get("phases"), dict)` and folds into its internal assertions list. This
    # linter runs standalone against author-written files, before that normalization ever
    # happens, so it must recognise the SAME raw key (`phases`) contract.py reads -- not a
    # `phases_raw` key, which is only ever a local variable inside normalize_contract() and is
    # never written back onto the contract dict. Reading a nonexistent `phases_raw` key here
    # made every phases-dict-only contract (no top-level `assertions:` key at all) invisible to
    # this linter, silently misclassified as non-UI ("EXEMPT") instead of correctly seeing its
    # app/ references and triad-kind declarations.
    #
    # Gated on `not contract.get("assertions")`, mirroring contract.py:131-132's own
    # condition exactly. contract.py only folds `phases:` entries into the assertions
    # list it actually executes when a truthy top-level `assertions:` is absent -- if
    # `assertions:` is present, every `phases:` entry is discarded and never runs. An
    # unconditional yield here credited discarded phases entries as if they were real
    # triad coverage: a contract with one bare shell check under `assertions:` and three
    # decorative triad entries under `phases:` would run only the shell check and zero
    # triad checks, while this linter still reported PASS. Using the same falsy check as
    # contract.py (not `"assertions" not in contract`) matters too -- an explicit
    # `assertions: []` is falsy, so contract.py DOES use the phases entries in that case,
    # and so must this linter.
    if not contract.get("assertions"):
        phases_raw = contract.get("phases")
        if isinstance(phases_raw, dict):
            for phase_items in phases_raw.values():
                for assertion in (phase_items or []):
                    yield assertion, SHAPE_PHASES


def iter_assertions(contract: dict):
    """Yield each assertion dict, shape-agnostic -- for callers (like the
    app/ path scan) that only need the assertion's text fields and don't
    care which shape it came from."""
    for assertion, _shape in iter_assertions_with_shape(contract):
        yield assertion


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


def assertion_kind(assertion: dict, shape: str = SHAPE_LIST) -> str:
    """The declared kind for one assertion, recognising exactly the key(s)
    contract.py itself actually normalises/reads for THIS assertion's shape
    -- never a lookalike key contract.py ignores in that shape.

    contract.py's gate execution (check_cmd) reads ONLY
    assertion["verify"]["kind"] at run time -- see contract.py:159 (`kind =
    verify.get("kind", "")`). So `verify.kind` is always credited, for every
    shape.

    A top-level key can also feed into verify.kind, but only via
    normalize_contract(), and the field it reads plus the condition under
    which it reads it are both shape-specific -- this is why `shape` must be
    tri-state, not a boolean:

      - SHAPE_CHECKS (@architect `assertions: {checks: [...]}` dict format):
        normalize_contract() reads `check.get("type", "shell")` and
        synthesizes `verify: {kind: ...}` from it unconditionally. Top-level
        `type` is credited here, always.

      - SHAPE_PHASES (raw `phases: {...}` dict format, contract.py:118-122):
        normalize_contract() reads `a.get("kind", "shell")` and synthesizes
        `verify: {kind: ...}` from it, but ONLY when the item's raw `verify`
        field is absent (None) or a bare string -- if `verify` is already a
        dict, contract.py uses it as-is and never looks at top-level `kind`
        at all. Top-level `kind` is credited here only under that same
        condition, mirrored exactly: crediting it unconditionally would
        claim coverage contract.py doesn't actually execute whenever a
        phases-dict item pairs a top-level `kind` with an unrelated nested
        `verify:` dict.

      - SHAPE_LIST (a plain `assertions:` LIST item): passed through
        untouched by normalize_contract() -- neither top-level `type` nor
        top-level `kind` is ever read by contract.py for it. Crediting
        either here would let a contract carry e.g. a decorative top-level
        `kind: browser_deployed_check` with no matching `verify.kind`, pass
        this linter as triad-covered, and have the gate execute that
        assertion as a bare, uncovered shell check -- the exact masquerade
        this linter exists to prevent. Neither top-level field is ever
        credited for SHAPE_LIST.
    """
    verify = assertion.get("verify")
    if isinstance(verify, dict) and verify.get("kind"):
        return str(verify["kind"])
    if shape == SHAPE_CHECKS:
        val = assertion.get("type")
        if isinstance(val, str):
            return val
    elif shape == SHAPE_PHASES:
        # Mirror contract.py's exact synthesis condition: only when `verify`
        # is absent or a bare string does contract.py read top-level `kind`.
        if verify is None or isinstance(verify, str):
            val = assertion.get("kind")
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
    for assertion, shape in iter_assertions_with_shape(contract):
        if isinstance(assertion, dict):
            kinds.add(assertion_kind(assertion, shape))
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
