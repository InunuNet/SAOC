# Workflow Chain — Mandatory Every Session

## Decision Tree (run before ANY substantive work)

```
1. Active mission?   → python3 execution/mission.py resume → follow checkpoint
2. Multi-session?    → /mission new FIRST
3. 3+ files / design?→ /spec FIRST (autonomy=off until spec approved)
4. <3 files, clear?  → write contract.yaml FIRST
5. Trivial?          → handle directly (no chain)
```

## The Chain (skip nothing)

```
[mission|spec] → @architect (contract + golden files)
→ @dev (implement against golden files only)
→ @qa (adversarial; inputs from orchestrator/@architect, NOT @dev)
→ Codex GPT-5.5 cross-model review (mandatory, see below)
→ @docs (README + docs/<feature>.md)
→ contract.py gate (all assertions green)
→ @maintainer (learned.md + brain wrap-up)
→ commit
```

## Codex GPT-5.5 cross-model review — mandatory, not optional (added 2026-08-18)

**Why:** on 2026-08-18, Claude wrote the vendor registration form, Claude's own @qa reviewed it,
and a real submit-breaking bug still reached Brad in live testing. The same day, a Codex GPT-5.5
pass against a diff Claude had already written AND already QA'd found four more real, correctly
file:line-cited defects Claude's chain missed — including a React state-batching bug and two
weak-check patterns matching this project's own audited "assertion satisfiable by something
that isn't the real property" defect class. Same model writing and reviewing its own code does
not reliably catch that class of bug; an independent model with no shared blind spots does.
**Brad's standing instruction: every QA pass, no exceptions, runs this after Claude's @qa and
before @docs.**

Preferred (2026-08-18, pulled from Athanor's `execution/codex_qa.sh`): a structured wrapper
with a bounded timeout and a parseable exit code, so it can be a real gate, not just advisory.

```
execution/codex_qa.sh <file_path>          # review one file
git diff | execution/codex_qa.sh           # review the current diff via stdin
```

Exit 0 = PASS, exit 1 = FAIL (findings printed after line 1), exit 2 = wrapper usage error
(missing `codex` binary, empty prompt) — never silently swallowed. 180s timeout, `-m gpt-5.5
-c model_reasoning_effort=high -s read-only` under the hood, same as before.

Fallback (if `execution/codex_qa.sh` is ever missing):

```
codex exec -m gpt-5.5 -c model_reasoning_effort=high -s read-only "Adversarially review the current git diff (or, if no diff, the most recently changed files) for real bugs, security issues, and correctness risks — not style. For each finding: cite exact file:line, state the concrete failure scenario (what input/state breaks it), and rate confidence. Do not flag anything you can't point to a specific line for. If nothing real is wrong, say so plainly instead of inventing findings."
```

- `-s read-only` — Codex cannot touch files, only read. Safe to run anytime, on anything.
- `-c model_reasoning_effort=high` — worth the extra ~1 min per pass for a real feature review;
  drop to `medium` for a quick sanity check on something low-stakes.
- Treat findings the same as any human reviewer's comments — verify before acting, never
  auto-apply. If a finding is wrong, say so and move on; don't silently discard it either.
- The orchestrator runs this directly via Bash (it's a review command, not application code) —
  it is not a chain-dispatched subagent.
- Athanor's harness-level version of this (InunuNet/Athanor#1357) has shipped as
  `execution/codex_qa.sh` + a `type: codex_qa` contract assertion kind — this project has pulled
  the script but not yet wired the contract-assertion side in.

## Hard Rules

- **No contract.yaml → no @dev dispatch.**
- **No golden files → no @dev dispatch.**
- **@dev never writes QA inputs or the contract.**
- **No feature is DONE without a Codex GPT-5.5 pass, in addition to @qa.** Claude reviewing
  Claude's own code is not sufficient QA on its own — see rationale above.
- **DONE = gate green + Codex pass run + docs updated + brain wrapped. Nothing less.**
- **Trivial = read, status, single command. Everything else uses the chain.**
- **Chain Continuous** — Never pause between chain steps waiting for user confirmation. Once a mission is active, proceed @architect→@dev→@qa→Codex→@docs→gate→@maintainer without stopping. Only pause at mission boundaries or on BLOCKED verdict.
- **Already-agreed follow-through doesn't need re-asking.** If a decision was made and approved earlier in a conversation (e.g. "build X, then deploy it"), completing it later is execution, not a new decision — don't pause to re-confirm something already settled.
- **Orchestrator never implements, reviews, or deploys directly — dispatch @architect/@dev/@qa
  always, even for urgent P0s.** Read-only investigation (grep, curl, log queries, browser
  tests) is fine; the first Edit/Write to project source is where dispatch must happen instead.
  Established 2026-08-18 after repeated direct implementation without the chain nearly cost the
  session. See project memory feedback_orchestrator_only_hard_rule.
