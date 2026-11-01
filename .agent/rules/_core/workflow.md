# The Workflow Chain

## Classify first, before any substantive work
1. Active mission: `python3 execution/mission.py resume`, follow the checkpoint
2. Multi-session goal: `/mission new` FIRST
3. Touches credentials, production config, or a shared/floor-protected/enforcement file, or
   needs a design decision: `/spec` FIRST (autonomy stays off until approved). Blast radius
   is the signal, not file count.
4. Well-specified, single domain, inside the project folder: write contract.yaml FIRST,
   whatever the file count
5. Trivial (read, status): handle directly, no chain

## The chain, once classified
[mission | spec] → @architect (contract + golden files) → `python3 execution/contract.py validate --strict` → @dev (implements against the
goldens, never tests it wrote) → @qa → @docs (README + docs/<feature>.md) → gate
(`python3 execution/contract.py gate`, every assertion green) → @maintainer (learned.md +
brain wrap-up) → commit

@qa is adversarial, with inputs from the orchestrator or @architect, not @dev, and cross-model:
the reviewer is never the vendor that wrote the code. In Claude Code run
`execution/codex_qa.sh` (`--apex` gpt-6-astra); in Codex run `execution/claude_qa.sh`
(`--apex` Opus 5.5). Not the same-vendor @qa persona; fall back to it only when the other CLI
is missing from PATH (script exits 2), and say so in the verdict.

- No contract, no @dev dispatch; no golden files, no @dev dispatch (draft lane excepted).
- @dev never writes the contract or the QA inputs.
- Never skip to implementation because the change looks small.
- Never pause between chain steps for confirmation; stop only at a mission boundary or a
  BLOCKED verdict.
- DONE means the gate is green and the docs are updated.

## Draft lane (operator-adopted 2026-10-08)
For live local iteration the operator judges by eye. On only while `.agent/DRAFT_LANE` exists;
create it (one line naming the draft, then their request verbatim) when the operator says
"draft" or "quick change". Only the operator's words switch it on; never infer it.

While on: no research file, @architect, contract, goldens or per-change @qa. One persistent
@dev per draft; forward each tweak by SendMessage quoting the operator verbatim (e.g. "change
the logo to this version"). Change what was asked, nothing else. Keep the dev server up, run no
production build, screenshot after each change and show it. Nothing is committed, pushed or deployed.

At approval ("approved", "ship it", "commit it"): build passes, screenshot of the approved
state, one `execution/codex_qa.sh` review of the whole draft diff; then delete
`.agent/DRAFT_LANE` and commit. Push and deploy follow the project's rules (SAOC: "keep it
local till approved by me then we push to beta"). A FAIL goes back to the operator.

Never in the draft lane: credentials, production config, floor-protected or enforcement files;
those keep classification step 3.
