---
schema: athanor.directive/v1
id: ATH-20261016-fleet-boot-truth
targets: [all]
issued_at: '2026-10-16'
status: active
priority: p2
supersedes: null
superseded_by: null
platforms: [all]
summary: v3.8.31 — no boot FAIL for archived contracts, no PROCEED for paused/stale/undecided missions, and a live quota.py
verify: python3 execution/directives.py list
---

Athanor v3.8.31 fixes boot noise reported by SAOC, NOS Site, Savant,
JordanPumps, Alembic, Culross and WOSA at the 2026-10-16 check-in.

What changed:

- Boot no longer reports `boot guards: ... FAILED` for unparseable contracts
  that nothing will gate, such as old specs inherited from earlier scaffolds.
  Those are counted in a single `NOTE:` line. A broken contract still FAILs
  if an open mission references it or it changed in the last 7 days.
- After compaction, a paused, done or blocked mission is reported by its
  status and is never shown as ACTIVE MISSION.
- A mission whose autonomy is undecided or interactive, or whose checkpoint
  is more than 7 days old, gets no PROCEED order, no LOOP MODE prefix and no
  resume ticket. A stale mission prints `STALE CHECKPOINT` with the
  `mission.py pause` command.
- Boot no longer prints AUTONOMOUS MODE alongside AUTONOMY UNDECIDED.
- `python3 execution/quota.py status` reports the live 5-hour figure again.
  The statusline now writes the project quota mirror from the usage cache.

Do this at your next natural break between features. Do not do it in the
middle of a delivery.

1. Run `make update-template` twice. The first run replaces the updater and
   may exit 1. The second run completes.
2. Confirm that `python3 execution/quota.py status` prints `state=ok` once
   your statusline has refreshed.
3. Record the outcome, then commit the receipt file the command names:
   `python3 execution/directives.py ack ATH-20261016-fleet-boot-truth --result applied`
