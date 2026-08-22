#!/usr/bin/env python3
"""
Behavioral, negative-verified proof for contract-m1.yaml's A12: that
`execution/contract.py gate` really refuses to run when the dataset-residue pre-flight guard
(RESIDUE_EXIT_CODE in execution/contract.py) finds residue, and really proceeds through the
normal gate path when it does not — using CONTRACT_GATE_RESIDUE_FIXTURE (test-only override)
against the existing contracts/golden/dataset-residue-guard/ fixtures. Never touches live
Sanity credentials.

Negative control: pointing the scanner at the known-bad
contracts/golden/dataset-residue-guard/fixture-all-patterns.json fixture makes `gate` exit
with the distinct residue exit code, and its stdout never reaches the phase-gating output
(the assertion-level "Phase 1 summary" line) — proving this is a real pre-flight refusal,
not a cosmetic log line after the fact.

Positive control: the same invocation against the known-clean
contracts/golden/dataset-residue-guard/fixture-clean.json fixture must NOT exit with the
residue code, and its stdout DOES reach "Phase 1 summary" — proving a clean dataset is not
blocked by this guard.

Exit 0 = both controls behaved as expected. Exit 1 = at least one control failed (printed
above the summary).
"""
import subprocess
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
CONTRACT_PY = REPO_ROOT / "execution" / "contract.py"
DIRTY_FIXTURE = "contracts/golden/dataset-residue-guard/fixture-all-patterns.json"
CLEAN_FIXTURE = "contracts/golden/dataset-residue-guard/fixture-clean.json"
# A fixture path that does not exist: scan-dataset-residue.ts's loadFixtureDocuments() throws,
# its top-level main().catch() prints "Residue scan failed:" and exits 1 — the SAME exit code
# scan-dataset-residue.ts uses for a confirmed residue finding. This simulates the
# scanner-infrastructure-failure case (a crash, not a real finding) without touching live
# Sanity credentials.
NONEXISTENT_FIXTURE = "contracts/golden/dataset-residue-guard/does-not-exist.json"
RESIDUE_EXIT_CODE = 4
GATE_PHASE_MARKER = "Phase 1 summary"

# A trivial, throwaway, non-mutating contract — this test only cares about whether the
# pre-flight guard runs BEFORE phase-gating starts, not about the phase's own assertion
# outcome, so the single assertion just needs to exist and be cheap to run.
THROWAWAY_CONTRACT = """\
schema: athanor.contract/v1
slug: residue-preflight-selftest
goal: Throwaway contract used only by verify_gate_residue_preflight.py — never a real mission.
created_at: '2026-08-22'
autonomy: high

features:
  - id: F1
    name: trivial always-pass assertion
    status: pending

assertions:
  phase: 1
  checks:
    - id: A1
      description: trivial always-pass shell assertion
      command: "true"
      timeout_seconds: 10
"""

failures = []


def check(ok: bool, label: str, detail: str = "") -> None:
    if ok:
        print(f"  PASS: {label}")
    else:
        failures.append(label)
        print(f"  FAIL: {label}" + (f" — {detail}" if detail else ""))


def run_gate(contract_path: Path, fixture: str) -> subprocess.CompletedProcess:
    env = {"CONTRACT_GATE_RESIDUE_FIXTURE": fixture}
    import os
    full_env = {**os.environ, **env}
    return subprocess.run(
        [sys.executable, str(CONTRACT_PY), "gate", str(contract_path), "--phase", "1", "--run-checks"],
        cwd=str(REPO_ROOT),
        env=full_env,
        capture_output=True,
        text=True,
        timeout=60,
    )


def main() -> int:
    with tempfile.TemporaryDirectory(prefix="residue-preflight-selftest-") as tmpdir:
        contract_path = Path(tmpdir) / "contract-throwaway.yaml"
        contract_path.write_text(THROWAWAY_CONTRACT)

        print("--- Negative control: dirty fixture must block BEFORE any assertion runs ---")
        dirty = run_gate(contract_path, DIRTY_FIXTURE)
        combined_dirty = dirty.stdout + dirty.stderr
        check(
            dirty.returncode == RESIDUE_EXIT_CODE,
            f"gate exits with the distinct residue code ({RESIDUE_EXIT_CODE})",
            f"got exit code {dirty.returncode}",
        )
        check(
            "RESIDUE ALERT" in combined_dirty,
            "output contains a RESIDUE ALERT banner",
        )
        check(
            GATE_PHASE_MARKER not in combined_dirty,
            "output never reaches phase-gating (no assertion output appeared before the refusal)",
            f"found {GATE_PHASE_MARKER!r} in output — the guard let phase-gating start anyway",
        )

        print("\n--- Positive control: clean fixture must proceed through the normal gate path ---")
        clean = run_gate(contract_path, CLEAN_FIXTURE)
        combined_clean = clean.stdout + clean.stderr
        check(
            clean.returncode != RESIDUE_EXIT_CODE,
            f"gate does NOT exit with the residue code ({RESIDUE_EXIT_CODE}) against a clean dataset",
            f"got exit code {clean.returncode}",
        )
        check(
            GATE_PHASE_MARKER in combined_clean,
            "output reaches phase-gating (the normal path ran)",
        )
        check(
            "ALL CLEAR" in combined_clean,
            "pre-flight scan reported ALL CLEAR against the clean fixture",
        )

        print("\n--- Error control: scanner crash (nonexistent fixture) must NOT be treated "
              "as confirmed residue ---")
        errored = run_gate(contract_path, NONEXISTENT_FIXTURE)
        combined_errored = errored.stdout + errored.stderr
        check(
            errored.returncode != RESIDUE_EXIT_CODE,
            f"gate does NOT exit with the residue code ({RESIDUE_EXIT_CODE}) when the "
            "scanner itself crashes",
            f"got exit code {errored.returncode}",
        )
        check(
            "RESIDUE ALERT" not in combined_errored,
            "output never falsely claims a confirmed residue finding (no RESIDUE ALERT "
            "banner) for a scanner crash",
        )
        check(
            "RESIDUE GUARD ERROR" in combined_errored,
            "output surfaces a distinct scanner-infrastructure-failure warning",
        )
        check(
            GATE_PHASE_MARKER in combined_errored,
            "gate fails OPEN on a scanner crash — phase-gating still runs instead of "
            "blocking unrelated work on a transient tooling failure",
        )

    if not failures:
        print("\nPASS: gate's dataset-residue pre-flight guard blocks a poisoned dataset before any "
              "assertion runs, and does not block a clean one.")
        return 0
    print(f"\nFAIL: {len(failures)} check(s) failed — see above.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
