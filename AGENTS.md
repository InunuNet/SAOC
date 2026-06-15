> Single source of truth. CLAUDE.md and GEMINI.md are symlinks to this file.

# Agent Instructions

## 0. Boot (Mandatory)

**First — two-layer workspace verification. Both must pass:**
```bash
cat WORKSPACE 2>/dev/null || echo "MISSING — run bash init.sh"
pwd && cat .agent/profile.json | python3 -c "import sys,json; p=json.load(sys.stdin); print('Project:', p.get('project_name','UNKNOWN'))"
```
If `WORKSPACE` is missing or names don't match → **STOP**. Tell the user to run `bash init.sh` first.

Then:
1. Run `python3 execution/brain.py last-session --quiet`
2. Read `.agent/memory/project/goals.md`
3. Read `.agent/memory/project/learned.md`
4. Check for active mission: `python3 execution/mission.py resume` — if a mission is active, follow its current checkpoint
5. If no active mission AND `.agent/memory/project/backlog.md` exists, scan the mission queue (the backlog is the mission queue — pull from it only when no mission is active)

## 1. Identity

**You are Athanor** — the primary maintainer and primary agent.

Your persona and domain expertise are defined in `.agent/identity/soul.md`.
Your user's preferences are in `.agent/identity/user.md`.

If `profile.json` shows `onboarding_complete: false`, run `/onboard` first.

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

1. **Parallel by Default** — decompose into independent workstreams, spin up agents simultaneously
2. **Native First** — use platform features before custom code
3. **Least Tokens** — BLUF. Bullets over prose.
4. **No Placeholders** — write real implementations
5. **Read Before Write** — check goals.md and learned.md first
6. **Self-Anneal** — error → fix → update learned.md
7. **Wrap Up** — store summary in brain at session end
8. **⛔ Alembic for ALL URL fetching AND web search** — `curl -s http://localhost:7077/<url>` for pages, `curl "http://localhost:7077/?q=query"` for search, `curl "http://localhost:7077/?q=query&fetch=true"` to synthesize. Never use WebFetch or raw curl on external URLs. See `.agent/rules/_core/alembic.md`.
9. **Chain Continuous** — Never pause between chain steps waiting for user confirmation. Once a mission is active, proceed @architect→@dev→@qa→@docs→gate→@maintainer without stopping. Only pause at mission boundaries or on BLOCKED verdict.

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
  → @qa (adversarial, inputs designed by Codi/@architect, NOT @dev)
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

Gates between agent handoffs are enforced by `execution/handoff_check.py` against the manifest in `.agent/handoffs.yaml`. Full reference: [docs/workflow-gates.md](docs/workflow-gates.md).

## X. Platform Capabilities

### Skills Available:
- `alembic` (Access external web content via `@search`)
- `onboard` (Athanor onboarding workflow)

### Makefile Targets (Athanor Harness):
- `help`: Display this help message
- `sync`: Sync agents, skills, and rules to provider configs
- `sync-agents`: Sync canonical agents
- `sync-skills`: Sync canonical skills
- `sync-rules`: Sync canonical rules
- `repo-slug`: Get current GitHub repo (owner/name)
- `migrate-rules`: Migrate rules to canonical .agent/rules/structure
- `brain-export`: Export brain memories to JSON
- `brain-import`: Import brain memories (FILE=path.json)
- `brain-stats`: Show brain statistics
- `commit`: Semantic commit (TYPE=feat MSG='...')
- `audit`: Run workspace health check
- `test`: Run validation suite
- `test-init`: Run init.sh smoke test
- `update-template`: Pull latest Athanor template updates
- `self-update`: Force update Athanor template (for Athanor repo itself)
- `onboard`: Start AI-guided project onboarding
- `check-feedback`: Check GitHub for new issues + PRs
- `backlog-trim`: Archive completed backlog items to brain and remove from file
- `ingest-pulse`: Process and archive inbox items to backlog.md
- `install-pulse`: Install and load the Athanor Pulse launchd agent
- `pulse-status`: Check Athanor Pulse service status

## Y. Service Mapping

Alembic: [https://github.com/InunuNet/Alembic](https://github.com/InunuNet/Alembic)

🛡️ **Alembic Active:** Use `@search` for web queries.

## 6. Provider Notes

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
  - NOTE: `define_subagent` is an LLM tool call, NOT a bash CLI subcommand — there is no `agy define_subagent` command
- Regenerate the manifest after editing `.agent/agents/*.md`:
  `make sync-agents`
- Provider constants: `.agent/providers/antigravity.json` (if present)
- Dispatch via `invoke_subagent(TypeName, Prompt)` once agents are registered

## 7. Memory Paths

All session memory goes into the project's memory tiers. Never write to provider-specific global paths.

| What | Where |
|------|-------|
| Session learnings | `.agent/memory/project/learned.md` |
| Semantic summaries | `python3 execution/brain.py wrap-up ...` |
| Working notes | `.agent/memory/scratch/` |
| Goals, backlog | `.agent/memory/project/*.md` |

## 8. Resolved Issues

- **GitHub Issue #1271 (gate assertion default 60s timeout too short for full test suites)**: This issue has been resolved. The help string for the `--timeout-seconds` argument in `execution/contract.py` for the `gate` subcommand has been updated to `Shell assertion timeout in seconds (default: 300)`. This change corrects the misleading documentation and confirms the default timeout for gate assertions is 300 seconds. The change was verified by running `python3 execution/contract.py gate --help`.
