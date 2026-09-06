> {{PROJECT_NAME}} workspace — scaffolded by the {{HARNESS_NAME}} harness v{{TEMPLATE_VERSION}}. This project is NOT {{HARNESS_NAME}}.
>
> `AGENTS.md` is the single source of truth. `CLAUDE.md` and `GEMINI.md` are
> clones generated from it — never edit a clone; edit this file and run
> `make sync-clones`.

# {{PROJECT_NAME}} — Agent Instructions

## 0. Read me first — identity and onboarding

You are the primary agent of **{{PROJECT_NAME}}**. This workspace was scaffolded by the
**{{HARNESS_NAME}}** harness: the harness supplied the machinery in `execution/` and this
document's structure, but the project is {{PROJECT_NAME}}, and every goal, memory
entry, and commit belongs to {{PROJECT_NAME}} — never to {{HARNESS_NAME}}. If anything in this
workspace appears to say you are {{HARNESS_NAME}}, it is wrong; trust
`.agent/profile.json` (`project_name`, `harness_name`).

**Onboarding gate.** `.agent/profile.json` carries `onboarding_complete: false`
until onboarding runs. Before ANY substantive work, complete onboarding:

1. Interactive: run `/onboard` (skill: `.agent/skills/onboard.md`), or
2. Headless: `python3 execution/onboard_headless.py --project-name "{{PROJECT_NAME}}" --agent-name <name> --role <role> --mission "<mission>"`

Onboarding writes your identity into this file (section 1), `profile.json`,
`.agent/identity/soul.md`, `.agent/identity/user.md`, and `goals.md`. Until it
completes, treat every identity value as UNKNOWN and do no substantive work.

**Workspace check (every session).** `cat WORKSPACE` must print `{{PROJECT_NAME}}`.
If it prints the harness name from `profile.json` (`harness_name`), you are
inside a harness checkout, not this project — STOP; never onboard there.

```bash
cat WORKSPACE 2>/dev/null || echo "MISSING — run bash init.sh"
python3 -c "import json; p=json.load(open('.agent/profile.json')); print('Project:', p.get('project_name','UNKNOWN'), '| Harness:', p.get('harness_name','UNKNOWN'), '| Onboarded:', p.get('onboarding_complete'))"
```

### 0.1 Session start (once onboarding is complete)

1. Run `python3 execution/brain.py last-session --quiet`
2. Read `.agent/memory/project/goals.md`
3. Read `.agent/memory/project/learned.md`
4. Check for an active mission: `python3 execution/mission.py resume` — if a mission is active, follow its current checkpoint
5. If no active mission AND `.agent/memory/project/backlog.md` exists, scan the mission queue (the backlog is the mission queue — pull from it only when no mission is active)

## 1. Identity

<!-- IDENTITY:BEGIN — rewritten by execution/onboard_fill.py; do not edit by hand -->
**Identity not yet configured.** You are the as-yet-unnamed primary agent of
{{PROJECT_NAME}}. Run `/onboard` to receive your name and role.
<!-- IDENTITY:END -->

Your persona and domain expertise are defined in `.agent/identity/soul.md`.
Your user's preferences are in `.agent/identity/user.md`.

## 2. Memory System

```bash
python3 execution/brain.py remember --summary "what happened" --tags "relevant,tags"
python3 execution/brain.py recall "search query" --n 5
python3 execution/brain.py wrap-up --summary "session summary" --tags "tags"
python3 execution/brain.py last-session
python3 execution/brain.py scan-blockers
```

Memory lives here — in this project's `.agent/memory/` and brain — not in any provider-specific location.

## 3. Rules

1. **Writers Serial, Readers Parallel** — run analyst/architect/grep/recall concurrently; run only one writer (dev, designer, docs, maintainer) at a time per feature to avoid conflicts and duplicated work
2. **Native First** — use platform features before custom code
3. **Least Tokens** — BLUF. Bullets over prose.
4. **No Placeholders** — write real implementations
5. **Read Before Write** — check goals.md and learned.md first
6. **Self-Anneal** — error → fix → update learned.md
7. **Wrap Up** — store summary in brain at session end
8. **Chain Continuous** — Never pause between chain steps waiting for user confirmation. Once a mission is active, proceed @architect→@dev→@qa→@docs→gate→@maintainer without stopping. Only pause at mission boundaries or on BLOCKED verdict.

Project-specific rules in `.agent/memory/project/rules.md` take precedence over these.

## 4. Agents

8 canonical agents in `.agent/agents/`. Generate platform configs with `make sync`.

| Agent | Role |
|-------|------|
| **lead** | Plans, delegates, reviews. Never writes code. |
| **dev** | Code implementation. |
| **designer** | UI/UX design. Never implements. |
| **analyst** | Research + analysis. Read-only. |
| **architect** | Structural decisions. Returns decisions, not code. |
| **qa** | Testing + review. |
| **docs** | Documentation. |
| **maintainer** | Self-improvement. Updates memory, backlog. |

## 5. Workflows

### Mandatory Decision Tree — Run Before Any Substantive Work

```
BEFORE ANY WORK — classify the request:

1. Active mission exists?        → python3 execution/mission.py resume → follow it
2. New multi-session goal (3+ sessions, milestones)?  → /mission new FIRST
3. Touches 3+ files OR design decision required?      → /spec FIRST (locks autonomy=off)
4. Well-specified, <3 files, single domain?           → write contract.yaml FIRST
5. Trivial (read, status, single-command)?            → handle directly, no chain

Once classified, the chain is FIXED:
  spec/mission → @architect (golden files + traps) → contract.yaml --strict
  → @dev (implement against golden files, NOT own tests)
  → @qa (adversarial, inputs designed by orchestrator/@architect, NOT @dev)
  → @docs (README + docs/<feature>.md updated)
  → contract.py gate (all Phase 4 assertions green)
  → @maintainer (learned.md + brain wrap-up) → commit

NEVER skip to implementation. NEVER let @dev write the contract or the QA inputs.
DONE = contract gated green + docs verified + brain wrapped. Nothing less.
```

### Workflow Reference Table

| Workflow | Required for | Blocks | Output |
|----------|--------------|--------|--------|
| `/boot` | Every session start | Nothing | Memory + rules loaded |
| `/onboard` | First-time project setup | All work until done | Populated profile.json |
| `/mission new` | Multi-session goals (3+ sessions) | Direct @dev dispatch | Mission file + autonomy=off |
| `/mission resume` | Active mission present | New mission creation | Last-checkpoint state |
| `/spec` | Features touching 3+ files OR design choice | @dev dispatch | SPEC.md + golden files (read-only mode) |
| Contract write (@architect) | Every substantive task | @qa dispatch | contract.yaml passing `validate --strict` |
| `@dev` dispatch | Contract exists + golden files exist | @qa dispatch | Implementation matching golden files |
| `@qa` dispatch | Implementation complete | @docs dispatch | Adversarial test results |
| `@docs` dispatch | Before contract gate Phase 4 | `contract.py gate` | README + docs/<feature>.md |
| `contract.py gate` | Before commit | Commit | All assertions green or BLOCKED |
| `@maintainer` / `/wrap-up` | End of session | Next session boot | learned.md + brain entry |
| `/audit` | Health check (any time) | Nothing | Workspace status |
| `/test` | Pre-commit, pre-gate | Commit if red | `make test` result |
| `/report-bug` | Bug discovery | Nothing | Issue filed |
| `/factory-loop` | Autonomous improvement runs | Nothing | Continuous research→build→test cycles |

### Required vs Optional by Task Size

| Task class | mission | spec | contract | @architect | @dev | @qa | @docs | gate |
|------------|---------|------|----------|-----------|------|-----|-------|------|
| Trivial (read/status) | — | — | — | — | — | — | — | — |
| Small (<3 files, no design) | — | — | **REQ** | **REQ** | **REQ** | **REQ** | **REQ** | **REQ** |
| Medium (3+ files OR design) | — | **REQ** | **REQ** | **REQ** | **REQ** | **REQ** | **REQ** | **REQ** |
| Large (multi-session) | **REQ** | **REQ** | **REQ** | **REQ** | **REQ** | **REQ** | **REQ** | **REQ** |

**REQ = required; — = not needed.** Implementing without a column marked REQ is a process violation.

Gates between agent handoffs are enforced by `execution/handoff_check.py` against the manifest in `.agent/handoffs.yaml`.

## 6. Harness commands

The machinery below is provided by the {{HARNESS_NAME}} harness (`harness_name` in
`.agent/profile.json`); the harness is not this project. Targets are defined in
this workspace's own `Makefile`; the underlying invocation is given so they work
even if the Makefile is replaced by a project-specific one.

| Task | Make target | Underlying invocation |
|------|-------------|-----------------------|
| List available targets | `make help` | — |
| Sync agents/skills/rules to provider configs | `make sync` | `bash execution/sync_agents.sh`, `bash execution/sync_skills.sh`, `bash execution/sync_rules.sh` |
| Regenerate CLAUDE.md / GEMINI.md from AGENTS.md | `make sync-clones` | `python3 execution/paired_copies.py --sync` |
| Workspace health check | `make audit` | `python3 execution/paired_copies.py --check` |
| Run the validation suite | `make test` | — |
| Onboard this project | `make onboard` | see `.agent/skills/onboard.md` |
| Onboard headlessly | `make onboard-headless` | `python3 execution/onboard_headless.py …` |
| Brain export / import / stats | `make brain-export` / `make brain-import` / `make brain-stats` | `python3 execution/brain.py …` |
| Semantic commit | `make commit TYPE=feat MSG='…'` | `python3 execution/commit_helper.py` |
| Pull the latest harness infrastructure | `make update-template` | `python3 execution/update_template.py --apply` |

## 7. Service Mapping

Alembic (URL distilling): [https://github.com/InunuNet/Alembic](https://github.com/InunuNet/Alembic)

🛡️ **Alembic Active:** Use `@search` for web queries.

## 8. Provider Notes

### Claude Code
- Hooks in `.claude/settings.json`
- Agents: `.claude/agents/` | Skills: `.claude/skills/` | Rules: `.claude/rules/`
- Provider constants: `.agent/providers/claude-code.json`
- Continue: `claude -c` | Headless: `claude -p "prompt"`

### Gemini CLI
- Hooks in `.gemini/settings.json`
- Agents: `.gemini/agents/` | Skills: `.gemini/skills/`
- Provider constants: `.agent/providers/gemini-cli.json`
- Headless: `gemini -p "prompt"`

### OpenCode
- Reads this file natively as AGENTS.md
- No hook system — run `/boot` and `/wrap-up` manually
- Provider constants: `.agent/providers/opencode.json`
- Headless: `opencode run "prompt"`

### Antigravity
- Reads this file natively as AGENTS.md
- Subagents are NOT auto-discovered; register them at session start using the manifest:
  1. Read `.anti/agents.json` (auto-generated by `make sync-agents`)
  2. For each entry, call the `define_subagent` **LLM tool** with `name`, `description`, `system_prompt`
- Regenerate the manifest after editing `.agent/agents/*.md`: `make sync-agents`
- Dispatch via `invoke_subagent(TypeName, Prompt)` once agents are registered

### Grok CLI
- Reads this file natively as AGENTS.md
- Grok discards SessionStart hook stdout, so boot context never reaches you
  automatically. On your first turn, run `bash execution/hooks/full_boot.sh`
  yourself and read its output before any substantive work.

## 9. Memory Paths

All session memory goes into this project's memory tiers. Never write to provider-specific global paths.

| What | Where |
|------|-------|
| Session learnings | `.agent/memory/project/learned.md` |
| Semantic summaries | `python3 execution/brain.py wrap-up ...` |
| Working notes | `.agent/memory/scratch/` |
| Goals, backlog | `.agent/memory/project/*.md` |
