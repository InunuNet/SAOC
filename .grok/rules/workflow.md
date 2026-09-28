# The Workflow Chain

## Classify first, before any substantive work

```
1. Active mission?            → python3 execution/mission.py resume, follow the checkpoint
2. Multi-session goal?        → /mission new FIRST
3. Touches credentials, production config, or a shared/floor-protected/
   enforcement file — OR a genuine design decision required?  → /spec FIRST
   (autonomy stays off until the spec is approved). Raw file count is the
   wrong signal — it can't tell six one-line config edits inside your own
   project folder apart from three files that touch billing.
4. Well-specified, single domain, stays inside the project folder?  → write
   contract.yaml FIRST, whatever the file count
5. Trivial: read, status      → handle it directly, no chain
```

## The chain, once classified

```
[mission | spec]
  → @architect    contract + golden files
  → @dev          implements against the goldens, never against tests it wrote
  → @qa           adversarial; inputs from the orchestrator or @architect, not @dev.
                  Cross-model by default: run `execution/codex_qa.sh` (Codex,
                  gpt-5.6-terra pinned) against @dev's diff/output, NOT the
                  Agent-tool @qa persona — a same-vendor Claude model checking
                  another Claude model's work is not adversarial review, it is
                  the same reasoning agreeing with itself. Fall back to the
                  Agent-tool @qa persona only when `codex` is unavailable on
                  PATH (codex_qa.sh exits 2), and say so in the verdict.
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
