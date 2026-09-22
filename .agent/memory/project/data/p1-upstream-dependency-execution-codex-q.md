# p1-upstream-dependency-execution-codex-q

**[P1] Upstream dependency: `execution/codex_qa.sh` reports transport failures as `FAIL`.**
  Filed 2026-09-08 as [InunuNet/Athanor#1419](https://github.com/InunuNet/Athanor/issues/1419).
  Running the mandatory Codex pass on the M7 diff hit an OpenAI usage limit; the wrapper's
  `fail_safe()` (`codex_qa.sh:26-29`, called at `:88` for any non-zero `codex` exit) emitted
  `FAIL` + exit 1 — the identical signal to a genuine defect verdict — with zero findings and
  zero `file:line` citations, because no review ever ran. The documented contract
  (`codex_qa.sh:9-10`) merges these on purpose: `1=FAIL (verdict or fail-safe)`.
  Why it matters here: `.claude/rules/workflow.md` makes the Codex pass a blocking gate before
  any feature is DONE, so an ambiguous failure either blocks a clean diff indefinitely or teaches
  the operator to wave `FAIL` through as "probably quota" — which is how a real finding ships.
  Asked for: a distinct exit code meaning *review did not execute*, with quota/auth/network/timeout
  classified as transport failures before `fail_safe`, so a `type: codex_qa` assertion can record
  BLOCKED instead of a verdict no model produced.
  **Blocks:** M7 cannot be marked DONE until the Codex pass actually runs (quota resets 17:01
  local, 2026-09-08). Do not route around it — re-run, don't waive.
