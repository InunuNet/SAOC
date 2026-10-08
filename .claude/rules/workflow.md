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
  **Exception:** the draft lane below. One contract covers the whole draft at
  approval, never one per tweak.
- `@dev` never writes the contract and never writes the QA inputs.
- Never skip to implementation because the change looks small.
- Do not pause between chain steps for confirmation. Stop at a mission boundary
  or on a BLOCKED verdict, nowhere else.
- **DONE means the gate is green and the docs are updated.** Nothing less counts.

The `chain-dispatch` skill delivered to `<project>/.claude/skills/`,
`<project>/.gemini/skills/` and `<project>/.grok/skills/` is a shortcut for
running this chain — not a substitute for it.

## Draft lane: live local iteration (operator-adopted 2026-10-08)

The chain costs 15-20 minutes. That is the right price for a commit and the
wrong price for "change the logo to this version" while the operator watches a
hot-reloading localhost. The draft lane drops the per-change chain, whatever
the file count, and keeps one gate at approval.

**Switch: `.agent/DRAFT_LANE`.** It is on only while that file exists. Create
it when the operator says "draft", "quick change" or similar: one line naming
the draft, then their request verbatim. Boot announces it, so it survives
compaction. Only the operator's words switch it on. Never infer it.

**While it is on:**
- No research file, no @architect, no contract or goldens, no @qa per change.
- One persistent @dev per draft, kept alive. Forward each tweak with
  SendMessage, quoting the operator verbatim. A one-line edit you may make
  directly. No invention: change what was asked, nothing else.
- The dev server stays up. Do not run a production build while it runs.
- Take a screenshot after each change and show it.
- **Nothing is committed, pushed or deployed.** It is all local, uncommitted work.

**At approval** ("approved", "ship it", "commit it"), run the light check:
1. The project's build passes.
2. A screenshot of the approved state.
3. One Codex review of the whole draft diff (`execution/codex_qa.sh`).

Then delete `.agent/DRAFT_LANE` and commit. Push and deploy follow the
project's own rules (SAOC: "keep it local till approved by me then we push to
beta"). A FAIL from the light check goes back to the operator, not round the
chain.

**Never in the draft lane:** credentials, production config, and
floor-protected or enforcement files. Those keep classification step 3
(`/spec` first), whatever the operator calls the change. A real feature with
a design decision gets the full chain; the draft lane is for changes the
operator can judge by eye.
