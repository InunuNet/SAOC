#!/usr/bin/env python3
"""Gate hook: dataset-residue guard (registered as residue-pre and residue-post).

Runs scripts/scan-dataset-residue.ts and maps its result onto the stock gate's hook
exit codes: 0 clean, 1 confirmed residue (a finding), 2 scanner infrastructure error.

The scanner exits 1 for BOTH a confirmed finding and an uncaught crash, so the stdout
marker is the only ground truth for "dirty" versus "error". The repo is located from this
file, never from cwd, so a fixture project still finds the scanner and node_modules.

Exit 1 is reserved for a confirmed finding. Output is captured as bytes and a decode failure,
like any unexpected exception, is an infrastructure error (exit 2), never a finding.

CONTRACT_GATE_RESIDUE_FIXTURE (test-only) points the scan at a local JSON file instead of
the live Sanity dataset. RESIDUE_SCANNER_OVERRIDE (test-only) names an executable run in place
of the node scanner, with the same arguments. Ported from the pinned contract.py's _run_dataset_residue_scan.
"""
import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SCANNER_TIMEOUT_SECONDS = 120
RESIDUE_CONFIRMED_MARKER = "FAIL: found"
RESIDUE_FIXTURE_ENV_VAR = "CONTRACT_GATE_RESIDUE_FIXTURE"
RESIDUE_SCANNER_ENV_VAR = "RESIDUE_SCANNER_OVERRIDE"
EXIT_CLEAN = 0
EXIT_FINDING = 1
EXIT_ERROR = 2
BANNER = "=" * 78


def _scanner_command() -> list:
    override = os.environ.get(RESIDUE_SCANNER_ENV_VAR)
    if override:
        cmd = [override]
    else:
        cmd = ["node", "--import", "tsx/esm", "scripts/scan-dataset-residue.ts"]
    fixture = os.environ.get(RESIDUE_FIXTURE_ENV_VAR)
    if fixture:
        cmd += ["--fixture", fixture]
    return cmd


def _error(detail: str) -> int:
    print(BANNER, file=sys.stderr)
    print(f"RESIDUE GUARD ERROR: {detail}", file=sys.stderr)
    print("This is a scanner-infrastructure failure, NOT a confirmed residue finding. "
          "If this persists, investigate scripts/scan-dataset-residue.ts directly.",
          file=sys.stderr)
    print(BANNER, file=sys.stderr)
    return EXIT_ERROR


def run_scan() -> int:
    try:
        result = subprocess.run(_scanner_command(), cwd=str(REPO_ROOT), capture_output=True,
                                timeout=SCANNER_TIMEOUT_SECONDS)
    except (OSError, subprocess.SubprocessError) as exc:
        return _error(f"scan-dataset-residue.ts could not run: {type(exc).__name__}: {exc}")
    try:
        stdout = result.stdout.decode("utf-8")
        stderr = result.stderr.decode("utf-8")
    except UnicodeDecodeError as exc:
        return _error(f"scanner output is not valid UTF-8 ({exc.reason}); exit code "
                      f"{result.returncode} is not trusted")
    if stdout:
        print(stdout.rstrip())
    if stderr:
        print(stderr.rstrip(), file=sys.stderr)
    if result.returncode == 0:
        return EXIT_CLEAN
    if RESIDUE_CONFIRMED_MARKER in stdout:
        print(BANNER)
        print("RESIDUE ALERT: the dataset holds sentinel/test residue. The gate refuses to "
              "proceed against a poisoned dataset.")
        print("Restore by hand from scripts/seed-page-singletons.ts (or the relevant seed "
              "script), re-run scan-dataset-residue.ts to confirm clean, then re-run the gate.")
        print(BANNER)
        return EXIT_FINDING
    return _error(f"scan-dataset-residue.ts exited {result.returncode} without confirming a "
                  "real residue finding")


def main() -> int:
    try:
        return run_scan()
    except Exception as exc:  # exit 1 is a finding; anything unexpected must be exit 2
        return _error(f"unexpected {type(exc).__name__}: {exc}")


if __name__ == "__main__":
    sys.exit(main())
