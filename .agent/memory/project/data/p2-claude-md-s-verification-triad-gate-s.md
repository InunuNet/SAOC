# p2-claude-md-s-verification-triad-gate-s

**[P2] `CLAUDE.md`'s "Verification triad gate" section is now factually stale and no
  agent can fix it** (verification-triad-gate M2/F2 close-out, 2026-09-06). It still reads "...
  is not yet wired into any gate path ... still voluntary, not enforced", which became false
  with commit `aa2f74f3`. `execution/hooks/check_autonomy.sh:301` hard-denies writes to
  `CLAUDE.md` at every autonomy level, so this needs Brad. Exact replacement text is already
  drafted and queued in `.agent/memory/project/needs-human.md` — just needs him to paste it in.
  Filed upstream as Athanor#1399 (the protected-path design has no route for correcting factual
  staleness in an agent-maintained instruction file).
