# p2-mission-py-validate-accepts-a-milesto

**P2 — `mission.py validate` accepts a milestone referencing a nonexistent feature.**
  On 2026-09-10 @architect accidentally deleted feature F15 while revising an adjacent brief.
  `mission.py validate` reported "Valid, 18 features" — it verifies every feature belongs to a
  milestone, but not the converse: that every milestone's feature reference resolves. The mission
  would have carried a dangling `F15` under M4 and silently lost its deployed-verification
  feature. Caught only because the author cross-checked both directions by hand.
  Fix: validate milestone→feature references resolve, and fail on a dangling ref. Cheap check,
  and the failure it prevents is silent feature loss.
  **Not yet filed upstream** — read `execution/mission.py`'s validator first and reproduce it in
  both directions before filing. One untested upstream claim today was enough (see the withdrawn
  `codex_qa.sh` entry). `execution/` is HARNESS-owned; file against `InunuNet/Athanor`, no patch.
