#!/usr/bin/env python3
"""verify_boot_wires_contract_parse_canary.py -- assertion-shape-sweep F4.

Wires execution/checks/verify_all_contracts_parse.py into
execution/hooks/full_boot.sh so a contract that cannot parse is surfaced
automatically, not only when someone remembers to run this specific
script by hand -- exactly how fleet-loop-mission-driven/contract.yaml's
unescaped-`(` parse failure stayed invisible to the first audit sweep.

Two things this checker observes, kept distinct:
  1. WIRING FACT (bucket B, legitimate cross-file integration): full_boot.sh
     contains the exact invocation line. See contract-f4.yaml A1 for the
     grep-level check of that fact directly; this checker does not repeat
     it.
  2. BEHAVIOR (bucket A): the exact wired line is EXTRACTED from the
     CURRENT content of full_boot.sh at test time (read the real file,
     never retype the command) and run in isolation -- never the whole
     full_boot.sh, which performs real network calls and `launchctl load`
     for the Pulse Heartbeat step, both forbidden by this mission's
     fixture-safety rules.

Usage:
  verify_boot_wires_contract_parse_canary.py malformed
      Runs the extracted line with SPECS_ROOT_UNDER_TEST pointed at a
      scratch tree seeded with goldens/f4_malformed_contract.yaml plus one
      valid contract. Asserts combined stdout/stderr contains FAIL and the
      malformed fixture's exact filename.
  verify_boot_wires_contract_parse_canary.py real
      Runs the same extracted line unmodified (no override) against the
      real repo tree. Asserts PASS with no FAIL, and a <10s wall-clock
      bound (measured, not assumed) against the real ~215-contract corpus.
  (no argument)
      Runs both cases.
"""
import os
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
FULL_BOOT_SH = REPO_ROOT / "execution" / "hooks" / "full_boot.sh"
GOLDENS = REPO_ROOT / ".agent" / "memory" / "project" / "specs" / "assertion-shape-sweep" / "goldens"
WALLCLOCK_BOUND_SECONDS = 10

FAILURES = []


def fail(name, msg):
    FAILURES.append(f"{name}: {msg}")
    print(f"FAIL [{name}]: {msg}", file=sys.stderr)


def ok(name, msg):
    print(f"OK [{name}]: {msg}")


def _extract_wired_line() -> str:
    """Read the REAL current content of full_boot.sh and pull out the one
    line that invokes verify_all_contracts_parse.py -- never retyped."""
    for line in FULL_BOOT_SH.read_text().splitlines():
        if "verify_all_contracts_parse.py" in line:
            return line.strip()
    raise AssertionError(f"no line invoking verify_all_contracts_parse.py found in {FULL_BOOT_SH}")


def _run_extracted_line(line: str, extra_env: dict) -> subprocess.CompletedProcess:
    """Run the extracted line in isolation via `bash -c`, never the whole
    full_boot.sh script."""
    env = os.environ.copy()
    env.update(extra_env)
    start = time.monotonic()
    result = subprocess.run(
        ["bash", "-c", line], cwd=str(REPO_ROOT), capture_output=True, text=True, env=env,
    )
    result.elapsed = time.monotonic() - start
    return result


def case_malformed():
    name = "malformed_scratch_tree_reports_fail"
    line = _extract_wired_line()
    with tempfile.TemporaryDirectory() as td:
        scratch = Path(td)
        malformed_text = GOLDENS.joinpath("f4_malformed_contract.yaml").read_text()
        # The checker's glob is "**/contract*.yaml" -- basename must start
        # with "contract" (matching real contracts' own naming convention,
        # e.g. contract-f1.yaml) or it would be silently skipped rather
        # than scanned and found malformed, which is exactly the kind of
        # false-PASS this canary exists to prevent.
        malformed_name = "contract-f4-malformed.yaml"
        (scratch / malformed_name).write_text(malformed_text)
        # One valid contract alongside it, so the scan isn't trivially
        # "zero files checked" -- it must actually walk multiple files and
        # still name the one that's broken.
        (scratch / "contract-valid.yaml").write_text(
            "schema: athanor.contract/v1\nslug: f4-scratch-valid\ngoal: valid fixture\n"
            "assertions:\n  phase: 4\n  checks:\n    - id: A1\n      description: trivial\n      command: \"true\"\n"
        )

        result = _run_extracted_line(line, {"SPECS_ROOT_UNDER_TEST": str(scratch)})
        combined = result.stdout + result.stderr

        if "FAIL" not in combined:
            return fail(name, f"expected FAIL in output against a malformed scratch tree, got:\n{combined}")
        if malformed_name not in combined:
            return fail(name, f"FAIL output did not name the malformed fixture's exact filename:\n{combined}")
        ok(name, "extracted boot line reports FAIL naming the malformed fixture against a scratch tree")


def case_real():
    name = "real_tree_reports_pass_within_bound"
    line = _extract_wired_line()
    result = _run_extracted_line(line, {})
    combined = result.stdout + result.stderr

    if "FAIL" in combined:
        return fail(name, f"unexpected FAIL against the real repo specs tree:\n{combined}")
    if "PASS" not in combined:
        return fail(name, f"expected a PASS line against the real repo specs tree, got:\n{combined}")
    if result.elapsed >= WALLCLOCK_BOUND_SECONDS:
        return fail(name, f"took {result.elapsed:.2f}s against the real corpus, expected < {WALLCLOCK_BOUND_SECONDS}s")
    ok(name, f"extracted boot line reports PASS with no FAIL against the real repo tree, in {result.elapsed:.2f}s")


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "both"
    if mode in ("malformed", "both"):
        case_malformed()
    if mode in ("real", "both"):
        case_real()

    if FAILURES:
        print(f"\n{len(FAILURES)} failure(s).", file=sys.stderr)
        sys.exit(1)
    print("\nPASS: full_boot.sh's wired contract-parse canary line behaves correctly, both broken and real.")
    sys.exit(0)


if __name__ == "__main__":
    main()
