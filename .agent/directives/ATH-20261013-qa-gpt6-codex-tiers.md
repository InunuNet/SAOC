---
schema: athanor.directive/v1
id: ATH-20261013-qa-gpt6-codex-tiers
targets: [all]
issued_at: '2026-10-13'
status: active
priority: p2
supersedes: null
superseded_by: null
platforms: [all]
summary: v3.8.25 — QA on GPT-6 Sol; Codex agents on OpenAI tiers with Claude as adversarial QA
verify: python3 execution/directives.py list
---

Athanor v3.8.24 and v3.8.25 change which model reviews your work.

- In Claude Code, chain QA (`execution/codex_qa.sh`) now runs on `gpt-6-sol`.
  Apex-tier features use `codex_qa.sh --apex`, which runs on `gpt-6-astra`.
- In Codex, `make sync-agents` now generates `.codex/agents/*.toml`. Each role
  runs on its tier's OpenAI model: apex `gpt-6-astra`, flash `gpt-6-sol`,
  local `gpt-6-luna`. Codex has no designer agent.
- QA is always done by the other vendor. A Codex session reviews with
  `execution/claude_qa.sh` (Claude Sonnet 5.5; `--apex` Opus 5.5). It has the
  same PASS/FAIL contract and exit codes as `codex_qa.sh`.

Do this in your own checkout, under your own rules and gates:

1. Run `make update-template` twice. The first pass only installs the new
   updater.
2. Run `make sync-agents`, then commit `.agent/` and `.codex/agents/`.
3. Record the outcome:
   `python3 execution/directives.py ack ATH-20261013-qa-gpt6-codex-tiers --result applied`
