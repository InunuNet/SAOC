#!/usr/bin/env python3
"""verify_f2_preflight_ordering.py -- proves the F2 triad preflight is wired
at the same choke point as the existing dataset-residue guard: inside
gate_cmd(), after the residue pre-flight call and before the phase-gating
dispatch (_gate_dispatch(contract, args)).

Why this placement matters (see .agent/memory/scratch/research-f2-triad-gate-
wiring.md, section 3): all four real gate entry points (quick_gate.sh,
gate_sweep.py, improvement_loop.sh, mission.py cmd_gate) converge on a single
subprocess call to `python3 execution/contract.py gate ...` -- none of them
call quick_gate.sh itself or import contract.py's functions directly. Only a
preflight placed inside gate_cmd()/_gate_dispatch() is guaranteed to fire for
all four; anywhere else is a bypassable side door. This check also proves the
triad preflight fires unconditionally (it only needs to read the contract
file, not run any assertion), independent of --phase or --run-checks, by
requiring it to sit before dispatch begins.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
CONTRACT_PY = REPO_ROOT / "execution" / "contract.py"

TRIAD_CALL_MARKERS = (
    "verify_triad_coverage.py",
    "_preflight_triad_guard(",
    "_triad_preflight(",
    "_run_triad_coverage_preflight(",
)


def main() -> int:
    if not CONTRACT_PY.exists():
        print(f"FAIL: {CONTRACT_PY} not found", file=sys.stderr)
        return 1
    source = CONTRACT_PY.read_text()

    def_match = re.search(r"^def gate_cmd\(args\):", source, re.MULTILINE)
    if not def_match:
        print("FAIL: gate_cmd(args) definition not found in execution/contract.py", file=sys.stderr)
        return 1

    body_start = def_match.end()
    next_def = re.search(r"^def ", source[body_start:], re.MULTILINE)
    body = source[body_start: body_start + next_def.start()] if next_def else source[body_start:]

    residue_pos = body.find("_preflight_residue_guard()")
    dispatch_pos = body.find("_gate_dispatch(contract, args)")

    triad_hits = [body.find(marker) for marker in TRIAD_CALL_MARKERS if marker in body]

    if residue_pos == -1:
        print("FAIL: _preflight_residue_guard() call not found in gate_cmd's body", file=sys.stderr)
        return 1
    if dispatch_pos == -1:
        print("FAIL: _gate_dispatch(contract, args) call not found in gate_cmd's body", file=sys.stderr)
        return 1
    if not triad_hits:
        print(
            "FAIL: no triad-preflight call found in gate_cmd's body -- expected a "
            "reference to verify_triad_coverage.py (or a wrapper function calling "
            "it) between the residue preflight and _gate_dispatch",
            file=sys.stderr,
        )
        return 1
    triad_pos = min(triad_hits)

    if not (residue_pos < triad_pos < dispatch_pos):
        print(
            "FAIL: triad preflight is not ordered after the residue preflight and "
            f"before _gate_dispatch (residue@{residue_pos}, triad@{triad_pos}, "
            f"dispatch@{dispatch_pos}) inside gate_cmd()",
            file=sys.stderr,
        )
        return 1

    print(
        "PASS: triad preflight is ordered after the residue preflight and before "
        "_gate_dispatch, inside gate_cmd() -- fires for all four real gate entry points"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
