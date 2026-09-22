# p1-contract-verifiers-in-execution-check

**P1 — contract verifiers in `execution/checks/` will be deleted by the next
  `make update-template`, taking their gates with them.** `.agent/update-manifest.yaml:12`
  classifies `execution/` as HARNESS *wholesale*, so every file under it is replaced on update.
  `nos-design-system`'s M8 contract commissions `execution/checks/verify_nos_m8_status_and_focus.ts`,
  and three untracked `execution/checks/*` files sit in the working tree now
  (`json_field.py`, `json_in_window.py`, `nos_scrim_probe.mjs`). When they vanish, the assertions
  that call them fail with "script not found" and the gates read as broken rather than as
  regressed — the same symptom already recorded against M8. Fix: move commissioned verifiers to
  `scripts/checks/` (project-owned) and repoint the contracts. `national-show-ia-alignment` M1
  already does this and pins it with assertion A0_NOT_IN_HARNESS. Found by @architect, 2026-09-09.
