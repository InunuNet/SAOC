# p0-execution-codex-qa-sh-reports-quota-t

**[P0] `execution/codex_qa.sh` reports quota/transport failure identically to a real
  adversarial FAIL** (found 2026-09-08, mission `ticketing-complete`, F2/A13; a peer session
  filed the same defect independently the same night as Athanor#1419 via the stdin entry
  point — this is a second, independent confirmation via the `<file_path>` argument form, so
  the fix needs to cover exit-code classification generally, not just one call shape). When
  OpenAI quota is exhausted, the wrapper exits 1 and prints the literal token `FAIL`,
  indistinguishable from a genuine Codex GPT-5.5 adversarial verdict — the quota error message
  is emitted twice before the `FAIL` token, so a classifier keyed to a fixed line position
  would still miss it. Consequence: **the mandatory cross-model Codex pass on
  `contracts/checks/ticketing-complete-f2/check-no-migration-apply-invocation.mjs` (A13) did
  NOT run** — quota exhausted, resets 17:01 on 2026-09-08 — yet A13 is landed and gate-green.
  Per `.claude/rules/workflow.md` ("No feature is DONE without a Codex GPT-5.5 pass"), F2/A13
  is not actually DONE until this pass is re-run and genuinely passes; re-run it once the quota
  resets, before closing F2.
