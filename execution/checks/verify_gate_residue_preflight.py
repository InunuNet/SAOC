#!/usr/bin/env python3
"""
Behavioral, negative-verified proof that the stock `execution/contract.py gate` refuses to run
when the project-owned residue-pre gate hook (scripts/gate-hooks/residue_hook.py, registered in
.agent/contract_kinds.json) finds dataset residue, and proceeds through the normal gate path when
it does not -- using CONTRACT_GATE_RESIDUE_FIXTURE (test-only override) against the existing
contracts/golden/dataset-residue-guard/ fixtures. Never touches live Sanity credentials.

The gate runs from a fixture project (.tmp/sandbox/residue-preflight-selftest/) that carries a copy
of the real registry with absolute hook paths. Stock exit semantics: 1 is a hook finding, 2 an
infrastructure error.

Negative control: the known-bad fixture-all-patterns.json fixture makes `gate` exit 1 with a
RESIDUE ALERT and a hooks-pre HOOK FINDING, and the output never reaches the assertion-level
"Phase 1 summary" line -- a real pre-flight refusal, not a cosmetic log line after the fact.

Positive control: the known-clean fixture-clean.json fixture exits 0, reaches "Phase 1 summary"
and the scan reports ALL CLEAR.

Error control: a nonexistent fixture makes the scanner crash with the same exit code it uses for a
finding; the hook must not call that residue (no RESIDUE ALERT), must say RESIDUE GUARD ERROR, and
the gate fails OPEN (residue-pre is on_error open): the phase still runs and the gate exits 0.

Exit 0 = every control behaved as expected. Exit 1 = at least one failed (printed above).
"""
import json
import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
CONTRACT_PY = REPO_ROOT / "execution" / "contract.py"
REGISTRY = REPO_ROOT / ".agent" / "contract_kinds.json"
SAFE_DELETE = REPO_ROOT / "execution" / "safe_delete.py"
SANDBOX = REPO_ROOT / ".tmp" / "sandbox" / "residue-preflight-selftest"
GOLDEN_DIR = REPO_ROOT / "contracts" / "golden" / "dataset-residue-guard"
DIRTY_FIXTURE = str(GOLDEN_DIR / "fixture-all-patterns.json")
CLEAN_FIXTURE = str(GOLDEN_DIR / "fixture-clean.json")
# A fixture path that does not exist: scan-dataset-residue.ts's loadFixtureDocuments() throws, its
# top-level main().catch() prints "Residue scan failed:" and exits 1 -- the SAME exit code it uses
# for a confirmed residue finding. Simulates a scanner crash without touching live Sanity.
NONEXISTENT_FIXTURE = str(GOLDEN_DIR / "does-not-exist.json")
HOOK_FINDING_EXIT_CODE = 1
GATE_PHASE_MARKER = "Phase 1 summary"
GATE_TIMEOUT_SECONDS = 150

THROWAWAY_CONTRACT = """\
schema: athanor.contract/v1
slug: residue-preflight-selftest
goal: Throwaway contract used only by verify_gate_residue_preflight.py -- never a real mission.
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
        print(f"  FAIL: {label}" + (f" -- {detail}" if detail else ""))


def build_fixture_project() -> Path:
    """A project root holding the real registry with absolute hook paths and the contract."""
    subprocess.run([sys.executable, str(SAFE_DELETE), str(SANDBOX)], check=True,
                   capture_output=True, text=True)
    (SANDBOX / ".agent").mkdir(parents=True)
    registry = json.loads(REGISTRY.read_text())
    for hook in registry.get("gate_hooks", []):
        if not os.path.isabs(hook["command"][0]):
            hook["command"][0] = str(REPO_ROOT / hook["command"][0])
    (SANDBOX / ".agent" / "contract_kinds.json").write_text(json.dumps(registry, indent=2))
    contract = SANDBOX / "contract-throwaway.yaml"
    contract.write_text(THROWAWAY_CONTRACT)
    return contract


def run_gate(contract_path: Path, fixture: str) -> subprocess.CompletedProcess:
    env = {k: v for k, v in os.environ.items() if not k.startswith("TRIAD_")}
    env["CONTRACT_GATE_RESIDUE_FIXTURE"] = fixture
    return subprocess.run(
        [sys.executable, str(CONTRACT_PY), "gate", str(contract_path), "--phase", "1",
         "--run-checks"],
        cwd=str(REPO_ROOT), env=env, capture_output=True, text=True,
        timeout=GATE_TIMEOUT_SECONDS,
    )


def main() -> int:
    contract_path = build_fixture_project()

    print("--- Negative control: dirty fixture must block BEFORE any assertion runs ---")
    dirty = run_gate(contract_path, DIRTY_FIXTURE)
    combined_dirty = dirty.stdout + dirty.stderr
    check(dirty.returncode == HOOK_FINDING_EXIT_CODE,
          f"gate exits with the hook-finding code ({HOOK_FINDING_EXIT_CODE})",
          f"got exit code {dirty.returncode}")
    check("RESIDUE ALERT" in combined_dirty, "output contains a RESIDUE ALERT banner")
    check("HOOK FINDING: residue-pre" in combined_dirty,
          "the stock gate reports the residue-pre hook finding")
    check(GATE_PHASE_MARKER not in combined_dirty,
          "output never reaches phase-gating (no assertion output appeared before the refusal)",
          f"found {GATE_PHASE_MARKER!r} in output -- the guard let phase-gating start anyway")

    print("\n--- Positive control: clean fixture must proceed through the normal gate path ---")
    clean = run_gate(contract_path, CLEAN_FIXTURE)
    combined_clean = clean.stdout + clean.stderr
    check(clean.returncode == 0, "gate exits 0 against a clean dataset",
          f"got exit code {clean.returncode}")
    check(GATE_PHASE_MARKER in combined_clean, "output reaches phase-gating (the normal path ran)")
    check("ALL CLEAR" in combined_clean, "pre-flight scan reported ALL CLEAR against the clean fixture")

    print("\n--- Error control: scanner crash (nonexistent fixture) must NOT be treated "
          "as confirmed residue ---")
    errored = run_gate(contract_path, NONEXISTENT_FIXTURE)
    combined_errored = errored.stdout + errored.stderr
    check("RESIDUE ALERT" not in combined_errored,
          "output never falsely claims a confirmed residue finding for a scanner crash")
    check("HOOK FINDING" not in combined_errored,
          "a scanner crash is not reported as a hook finding")
    check("RESIDUE GUARD ERROR" in combined_errored,
          "output surfaces a distinct scanner-infrastructure-failure warning")
    check(errored.returncode == 0,
          "gate fails OPEN on a scanner crash -- it still exits 0 instead of blocking unrelated "
          "work on a transient tooling failure", f"got exit code {errored.returncode}")
    check(GATE_PHASE_MARKER in combined_errored, "phase-gating still ran after the scanner crash")

    if not failures:
        subprocess.run([sys.executable, str(SAFE_DELETE), str(SANDBOX)], check=True,
                       capture_output=True, text=True)
        print("\nPASS: the residue gate hook blocks a poisoned dataset before any assertion runs, "
              "and does not block a clean one.")
        return 0
    print(f"\nFAIL: {len(failures)} check(s) failed -- see above.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
