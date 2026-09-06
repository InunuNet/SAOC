#!/usr/bin/env python3
"""verify_f2_baseline_completeness.py -- proves the committed triad
rollout-exemption baseline actually grandfathers every contract that would
otherwise turn red on day one of enforcement (mission verification-triad-gate
M2/F2).

Rollout policy (see the M2 design note in
.agent/memory/project/missions/2026-09-03-verification-triad-gate.md and
this spec's contract-f2.yaml goal): every contract file path that already
existed in the repo before the F2 gate-enforcement preflight shipped is
grandfathered by being listed, by its repo-relative path, in a committed
baseline file (default execution/triad-baseline-exempt.txt, overridable via
the TRIAD_BASELINE_FILE env var). A path in the baseline is warned about but
never blocked; a path NOT in the baseline is enforced.

This check does NOT re-derive the baseline itself (that would just be
re-running the same generator and comparing it to its own output -- a
tautology). Instead it re-runs the actual classification independently
(the same way the real linter does, via a fresh subprocess call) against
every contracts/*.yaml file in the repo TODAY, and asserts that every path
verify_triad_coverage.py currently reports FAIL for (exit 1: a real
UI/workflow contract with zero triad kinds) is present in the committed
baseline file. A golden snapshot of this failing set, taken when this
architect pass was written (2026-09-06), is checked in at
goldens/fixtures/f2_baseline_expected_subset.txt as a floor: the real
baseline must be a superset of it even if more UI/workflow contracts are
added to contracts/*.yaml between now and when @dev ships this feature.

If this check ever fails after @dev's implementation lands, it means either
the baseline generator missed a file, or someone added a new noncompliant
contract to contracts/*.yaml without it also landing in this same commit --
in the latter case the correct fix is to make that new contract compliant or
explicitly add it to the baseline with a comment explaining why, never to
silently widen this check.
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
LINTER = REPO_ROOT / "execution" / "verify_triad_coverage.py"
DEFAULT_BASELINE = REPO_ROOT / "execution" / "triad-baseline-exempt.txt"
GOLDEN_SUBSET = (
    REPO_ROOT
    / ".agent"
    / "memory"
    / "project"
    / "specs"
    / "verification-triad-gate"
    / "goldens"
    / "fixtures"
    / "f2_baseline_expected_subset.txt"
)
CONTRACTS_DIR = REPO_ROOT / "contracts"


def classify(path: Path) -> int:
    result = subprocess.run(
        [sys.executable, str(LINTER), str(path)],
        capture_output=True,
        text=True,
        timeout=30,
    )
    return result.returncode


def load_lines(path: Path) -> set[str]:
    if not path.exists():
        return set()
    return {
        line.strip()
        for line in path.read_text().splitlines()
        if line.strip() and not line.strip().startswith("#")
    }


def main() -> int:
    baseline_path = Path(os.environ.get("TRIAD_BASELINE_FILE", str(DEFAULT_BASELINE)))

    if not baseline_path.exists():
        print(
            f"FAIL: baseline file not found at {baseline_path} -- the rollout "
            "policy requires a committed baseline before the F2 preflight can "
            "ship without reddening the existing suite.",
            file=sys.stderr,
        )
        return 1

    baseline = load_lines(baseline_path)
    golden_floor = load_lines(GOLDEN_SUBSET)
    if not golden_floor:
        print(f"FAIL: golden floor file missing or empty: {GOLDEN_SUBSET}", file=sys.stderr)
        return 1

    missing_from_baseline = sorted(golden_floor - baseline)
    if missing_from_baseline:
        print(
            "FAIL: the following contracts were UI/workflow-shaped and "
            "triad-noncompliant at architect time, but are NOT present in the "
            f"committed baseline ({baseline_path}) -- shipping the F2 "
            "preflight as-is would turn these red:\n  "
            + "\n  ".join(missing_from_baseline),
            file=sys.stderr,
        )
        return 1

    # Re-derive today's real failing set (not just trust the frozen golden
    # snapshot) and confirm the same superset relationship holds live.
    live_failing = set()
    for contract_path in sorted(CONTRACTS_DIR.glob("*.yaml")):
        if classify(contract_path) == 1:
            rel = str(contract_path.relative_to(REPO_ROOT))
            live_failing.add(rel)

    missing_live = sorted(live_failing - baseline)
    if missing_live:
        print(
            "FAIL: the following contracts/*.yaml files are UI/workflow-shaped "
            "and triad-noncompliant RIGHT NOW but are not in the committed "
            f"baseline ({baseline_path}) -- these would turn red on first "
            "enforcement:\n  " + "\n  ".join(missing_live),
            file=sys.stderr,
        )
        return 1

    print(
        f"PASS: baseline ({baseline_path}, {len(baseline)} entries) covers "
        f"the golden floor ({len(golden_floor)} entries) and today's live "
        f"failing set ({len(live_failing)} entries) -- no reddening on first "
        "enforcement."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
