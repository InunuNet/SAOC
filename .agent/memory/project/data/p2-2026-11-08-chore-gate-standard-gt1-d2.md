# p2-2026-11-08-chore-gate-standard-gt1-d2

P2 (2026-11-08) chore/gate-standard-gt1 @ d29d6057 follow-ups from Codex r3 (stopped at the retry ceiling): (a) gate-standard.mjs:815-817 public archive check uses the internal app path via settledStatus; also request public /archive and assert 404. (b) council-copy-fixes gate-standard-known-defect.mjs:14-19 infers route coverage from stdout, but a clean gate prints only "standard pass", so the wrapper fails on a clean gate; make the gate print a per-route coverage line or drop the stdout floor.
