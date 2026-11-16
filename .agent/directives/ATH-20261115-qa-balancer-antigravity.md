---
schema: athanor.directive/v1
id: ATH-20261115-qa-balancer-antigravity
targets: [all]
issued_at: '2026-11-15'
status: active
priority: p1
supersedes: null
superseded_by: null
platforms: [all]
summary: Cross-model QA goes through execution/qa.sh, which balances Codex and Antigravity (Hydrogen high / Argon high only)
verify: test -f execution/qa.sh && test -f execution/agy_models.py && grep -q "qa.sh" .agent/rules/_core/workflow.md
---

Brad, 2026-11-15: "on a difficult problem, we can run both AGY and codex, and on simple problems,
we must just balance them. We use them like a load balancer... and we should be logging and
seeing how it goes with them." Also: "I don't want to use Gemini for anything, only Argon high
and hydrogen high."

- **QA entry point.** Run `bash execution/qa.sh <prompt-file>` wherever you ran `codex_qa.sh`.
  It alternates Codex (gpt-6-sol) and Antigravity (gemini-4-hydrogen-high) turn by turn and
  fails over when one is unavailable. In a Codex lead it pairs Claude and Antigravity instead.
- **Difficult or blast-radius work:** `qa.sh --both` runs both reviewers; line 1 is FAIL if either
  fails. `--apex` implies both, on gpt-6-astra and gemini-4-argon-high.
- **Only two Google models.** Hydrogen high is the fast model, used for dev and standard QA;
  Argon high is the deep model, used for apex. Never pass any other Gemini model or effort.
  `.agent/providers/antigravity.json` `model_map` is the single source.
- **Monitored.** Every reviewer run appends one row to
  `.agent/memory/project/telemetry/dispatch.jsonl` with provider, model, verdict, wall time and
  usage counts. Run `python3 execution/dispatch_ledger.py summary` to see the split.
- **Dev delegation (optional).** `bash execution/agy_dev.sh run --task <file> --id <slug>` gives
  one narrow, contract-backed edit task to Hydrogen high in an isolated worktree. Its writes are
  confined to that worktree by sandbox-exec on macOS and by bwrap on Linux (bwrap not yet
  verified on a real host). Review with your gate, then run `agy_dev.sh apply --id <slug>` or
  `discard`. Windows, and Linux without bwrap, have no confinement, so it refuses there.
- Needs harness 3.8.149 or later: `make update-template`.
