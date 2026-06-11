---
name: chain-dispatch
description: Canonical chain order and chain-continuous enforcement reminder — emits the mandatory dispatch sequence and the do-not-pause rule before dispatching the next agent.
usage: Invoke this skill before dispatching any agent in the workflow chain. Prevents the #GEMINI-6 class of incidents where agents pause mid-chain waiting for confirmation.
---

# chain-dispatch

Canonical reference for the mandatory agent chain order and the chain-continuous rule. Promotes the rule from prose buried in CLAUDE.md to an invocable skill agents can cite directly.

## The mandatory chain

```
classify → @architect → @dev → @qa → @docs → gate → @maintainer → commit
```

Each agent produces an artifact the next agent consumes. The artifact paths and required sections are documented in `write-handoff`.

| Step | Agent | Output | Next |
|------|-------|--------|------|
| 1 | @architect | `contract.yaml` + golden files | @dev |
| 2 | @dev | `dev-result-<slug>.md` | @qa |
| 3 | @qa | `qa-report-<slug>.md` | @docs |
| 4 | @docs | `docs/<feature>.md` + README update | gate |
| 5 | gate | `contract.py gate` all green | @maintainer |
| 6 | @maintainer | `learned.md` + brain wrap-up | commit |

## The chain-continuous rule (CRITICAL)

**Never pause between chain steps waiting for user confirmation.** Once a mission is active, proceed @architect → @dev → @qa → @docs → gate → @maintainer without stopping. Only pause at:

- Mission boundaries (mission start, mission end)
- `BLOCKED` verdict from @qa
- Explicit user interrupt

#GEMINI-6 cost a whole mission to recover from chain-pause. Do not repeat.

## When the chain triggers (vs trivial direct handling)

Run the chain when ANY of these are true:
- Task touches 3+ files
- Task requires a design decision
- Task changes user-facing behavior
- Task is part of an active mission

Skip the chain (handle directly) ONLY for:
- Read-only inspection (`cat`, `ls`, `git status`)
- Single-command tasks (`make test`, `make sync`)
- Pure acknowledgments

## Common failures

- **@dev dispatched without a contract** → STOP. Run @architect first.
- **@qa given inputs by @dev** → STOP. Codi or @architect designs QA inputs, never @dev.
- **Skipping @docs to save time** → STOP. Phase-4 gate requires docs.
- **Pausing after @dev to ask "should I run @qa?"** → Violates chain-continuous. Just dispatch @qa.

## Related

- `.claude/rules/workflow.md` — full chain rules
- `write-contract` — what @architect produces
- `write-handoff` — what every chain agent produces
- `quick-gate` — the phase-4 gate before @maintainer
