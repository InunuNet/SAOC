#!/usr/bin/env python3
"""verify_all_declared_timeouts_normalize.py -- contract-timeout-honored F1
corpus regression.

DECISION.md F1: normalize_contract() must copy timeout_seconds for every
existing contract in the corpus, not just the new goldens. Walks
.agent/memory/project/specs/**/*.yaml, parses each as a raw contract dict
(pre-normalize), finds every check/assertion that declares its own raw
timeout_seconds, runs the same file through the real normalize_contract(),
and asserts the resulting internal verify.timeout_seconds matches the
declared value for every one.

Also asserts the total count found is >= 1 -- a 0-match run would silently
"pass" without exercising anything, which is exactly the inert-fix failure
mode this mission exists to prevent.

NOTE on the ">=15" figure in DECISION.md: that count does not hold up
against an actual field-level scan. Repo-wide (not just specs/**), only
ONE real `timeout_seconds:` field declaration exists outside this
mission's own new fixtures --
.agent/memory/project/specs/harness-integrity-hardening/goldens/f6/stdio_and_timeout.yaml
(assertion T1). `grep -rc timeout_seconds` over specs/**/*.yaml returns 12
matches, but those are almost all shell `cmd:` strings that grep the
*literal word* "timeout_seconds" out of contract.py's own source (wiring
checks for this exact bug, e.g. upstream-issue-fixes/contract.yaml A1/A2),
not actual field declarations that normalize_contract() would process.
The threshold below reflects the verified structural count, not the
DECISION.md estimate.

Does not re-execute the corpus's actual shell commands (slow, could touch
unrelated live state) -- only exercises the structural fact F1 changes:
does the declared value survive normalize_contract() into the internal
assertion list.
"""
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    print("FAIL: pyyaml not importable — cannot run this check", file=sys.stderr)
    sys.exit(1)

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "execution"))

import contract  # noqa: E402

SPECS_ROOT = REPO_ROOT / ".agent" / "memory" / "project" / "specs"
MIN_EXPECTED_DECLARATIONS = 1


def fail(msg: str) -> None:
    print(f"FAIL: {msg}", file=sys.stderr)
    sys.exit(1)


def raw_declared_timeouts(raw: dict) -> dict:
    """Find every check/assertion in the RAW (pre-normalize) contract dict
    that declares its own timeout_seconds, keyed by id."""
    declared = {}

    assertions_raw = raw.get("assertions", {})
    if isinstance(assertions_raw, dict) and "checks" in assertions_raw:
        for check in assertions_raw.get("checks", []) or []:
            if "timeout_seconds" in check:
                declared[check.get("id", "")] = check["timeout_seconds"]
    elif isinstance(assertions_raw, list):
        for a in assertions_raw:
            verify = a.get("verify")
            if isinstance(verify, dict) and "timeout_seconds" in verify:
                declared[a.get("id", "")] = verify["timeout_seconds"]

    phases_raw = raw.get("phases")
    if isinstance(phases_raw, dict):
        for phase_items in phases_raw.values():
            for a in (phase_items or []):
                if "timeout_seconds" in a:
                    declared[a.get("id", "")] = a["timeout_seconds"]

    return declared


def normalized_timeouts(normalized: dict) -> dict:
    out = {}
    for a in normalized.get("assertions", []):
        verify = a.get("verify", {})
        if "timeout_seconds" in verify:
            out[a.get("id", "")] = verify["timeout_seconds"]
    return out


def main() -> None:
    total_declared = 0
    mismatches = []

    for path in sorted(SPECS_ROOT.glob("**/*.yaml")):
        if "contract-timeout-honored" in str(path):
            continue  # this mission's own fixtures, not corpus under test
        try:
            raw = yaml.safe_load(path.read_text())
        except Exception:
            # Malformed-YAML detection is verify_all_contracts_parse.py's
            # job, not this check's -- e.g. assertion-shape-sweep's
            # deliberately-malformed f4_malformed_contract.yaml fixture.
            continue
        if not isinstance(raw, dict):
            continue

        declared = raw_declared_timeouts(raw)
        if not declared:
            continue

        try:
            normalized = contract.normalize_contract(raw)
        except Exception as e:
            fail(f"normalize_contract() raised on {path}: {type(e).__name__}: {e}")

        got = normalized_timeouts(normalized)
        for aid, expected_val in declared.items():
            total_declared += 1
            actual_val = got.get(aid)
            if actual_val != expected_val:
                mismatches.append(
                    f"{path}::{aid}: declared {expected_val!r}, normalized to {actual_val!r}"
                )

    if total_declared < MIN_EXPECTED_DECLARATIONS:
        fail(f"only found {total_declared} timeout_seconds declarations in corpus "
             f"under {SPECS_ROOT}, expected >= {MIN_EXPECTED_DECLARATIONS} "
             "(a low count risks this check passing without exercising anything)")

    if mismatches:
        fail(f"{len(mismatches)} declared timeout_seconds did not survive "
             "normalize_contract(): " + "; ".join(mismatches))

    print(f"PASS: {total_declared} timeout_seconds declarations across the corpus "
          f"all survive normalize_contract() intact")
    sys.exit(0)


if __name__ == "__main__":
    main()
