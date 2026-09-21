# The Workflow Chain

## Classify first, before any substantive work

```
1. Active mission?            → python3 execution/mission.py resume, follow the checkpoint
2. Multi-session goal?        → /mission new FIRST
3. 3+ files, or a design call → /spec FIRST (autonomy stays off until the spec is approved)
4. <3 files, well specified   → write contract.yaml FIRST
5. Trivial: read, status      → handle it directly, no chain
```

## The chain, once classified

```
[mission | spec]
  → @architect    contract + golden files
  → @dev          implements against the goldens, never against tests it wrote
  → @qa           adversarial; inputs from the orchestrator or @architect, not @dev
  → @docs         README + docs/<feature>.md
  → gate          python3 execution/contract.py gate — every assertion green
  → @maintainer   learned.md + brain wrap-up
  → commit
```

## Hard rules

- No contract, no `@dev` dispatch. No golden files, no `@dev` dispatch.
- `@dev` never writes the contract and never writes the QA inputs.
- Never skip to implementation because the change looks small.
- Do not pause between chain steps for confirmation. Stop at a mission boundary
  or on a BLOCKED verdict, nowhere else.
- **DONE means the gate is green and the docs are updated.** Nothing less counts.

The `chain-dispatch` skill delivered to `<project>/.claude/skills/`,
`<project>/.gemini/skills/` and `<project>/.grok/skills/` is a shortcut for
running this chain — not a substitute for it.
