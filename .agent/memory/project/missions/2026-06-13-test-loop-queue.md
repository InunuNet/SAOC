---
schema: athanor.mission/v1
slug: test-loop-queue
goal: Implement test-loop-queue mission for pulse loop regression coverage.
created_at: '2026-06-13T08:53:26.781598+00:00'
started_at: '2026-06-13T09:00:00.000000+00:00'
last_active_at: '2026-06-13T11:00:00.000000+00:00'
status: complete
cost_estimate:
  features: 2
  milestones: 2
  total_calls: 12
last_checkpoint:
  milestone: M2
  feature: F2.2
  ts: '2026-06-13T11:00:00.000000+00:00'
features:
  - id: F1.1
    name: Fix contract.py --phase all with synthesized phases
    status: done
  - id: F1.2
    name: Fix test_contract_fix.py syntax errors and stale-results cleanup
    status: done
  - id: F2.1
    name: All 13 test assertions passing
    status: done
milestones:
  - id: M1
    name: contract.py gate fix — synthesized phases no longer fail lookup
    status: done
  - id: M2
    name: regression test suite green — 13/13 passing
    status: done
---

# Mission: Implement test-loop-queue mission for pulse loop regression coverage.

## Context

The `contract.py gate --phase all` command had a bug where synthesized phase IDs (created
when the architect uses single-phase format or when no explicit phases are defined) caused a
lookup failure in `_gate_single_phase` because the function looked for the phase in
`contract.get("phases")` instead of using the already-computed assertion list.

## Work Done

### F1.1 — contract.py fix

Modified `_gate_single_phase` to accept an `assertion_ids_override` parameter. Updated
`gate_cmd` to pass the override when iterating synthetic `phases_data`, bypassing the
contract phase lookup. Also removed a stray DEBUG print left in the code.

### F1.2 — test_contract_fix.py fixes

- Fixed literal newline syntax errors in `print()` calls
- Fixed AR1 command: `grep -q 'README' README.md` → `test -f README.md` (README.md
  doesn't contain the string "README")
- Fixed cleanup: removed dangerous `MISSIONS_DIR` deletion; added proper cleanup of
  stale contract-results for test slugs before each run
- Removed debug `print(f"Attempting to gate...")` and redundant `ok()` call in Test 3

## Result

All 13 test assertions pass. The `--phase all` gate correctly handles:
1. Explicit multi-phase contracts
2. Single-phase / architect-format contracts (synthesized phases)
3. Empty contracts (no assertions)

## Notes
