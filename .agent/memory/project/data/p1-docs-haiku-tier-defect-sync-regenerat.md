# p1-docs-haiku-tier-defect-sync-regenerat

**[P1] @docs Haiku tier defect / sync-regeneration risk.** Standing decision (2026-09-02,
  recorded in `learned.md`'s resolved-contradiction entry near the top of the file): no Haiku for
  any role on this project, @docs included — Sonnet 5 is the floor.
  **Current state, precisely:** `.claude/agents/docs.md:3` was hand-corrected from `model: haiku`
  to `model: sonnet` on 2026-09-02. But the template source `.agent/agents/docs.md` still
  declares `model_tier: local` with no `model:` line at all, and `.gemini`/`.grok` mirror that
  pattern with their own tier names (`flash`, etc). **This means the hand-edit is not the real
  fix and can silently regress**: if `make sync` regenerates `.claude/agents/docs.md` from that
  `local` tier the same way it apparently did before, `model: haiku` comes straight back with no
  failure signal — and because the fix "already landed" in every session's notes (including this
  one), nobody would think to re-check it. That is the worst shape a defect can have.
  **The actual work:** locate the tier→model mapping `make sync` applies for the Claude provider
  (not found in the search pass so far; likely under `execution/` or in the sync script itself)
  and correct the `local` tier there, so the rendered file cannot regress. A hand-edit of
  `.claude/agents/docs.md` alone is NOT the fix — it's what's in place today as an interim
  patch only.
  **Verification step:** after any `make sync`, re-check `.claude/agents/docs.md:3` still reads
  `sonnet`. Until the mapping itself is fixed, treat that line as unstable — do not assume it
  stays fixed just because it was corrected once.
  `dev-fast.md` and `qa-fast.md` also carry `model: haiku` in frontmatter but are deliberately
  excluded from this fix: both are documented OpenRouter free-tier fallbacks scoped to
  non-critical ghost-task work, a different mechanism entirely — do not "fix" them alongside
  this item.
  **Practical impact (why P1, not P3):** if this regresses, @docs would silently run on the
  same model that, on this project, reported two documentation items as "already correctly
  documented" when neither existed anywhere except the line it had just written (`learned.md`,
  "Do not report a task as already satisfied without running the check that proves it"). Until
  the mapping is fixed, spot-check @docs output against the actual source
  before trusting it, same as before this item existed.
