# p1-firestore-test-data-cleanup-deletion

**[P1] Firestore test-data cleanup — deletion is Brad's call, not an agent's.** Live
  collections carry test residue: ~15 `@harden-check.invalid` fixture docs in `tickets`, two
  `contactSubmissions` diagnostic records, and the sandbox order/ticket documents from proving
  purchase end to end. Blocks A5/A34 in `contract-payfast-m1-lock-cleanup-fix.yaml` and
  `contract-door-test-qr-seeder.yaml` (both go green once cleared). Note the leak count has gone
  both up and down across sessions (5 → 12 → 17 → 15) — record the number, do not narrate a trend
  from it; measure under controlled conditions before drawing a conclusion.
