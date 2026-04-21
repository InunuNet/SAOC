> Single source of truth. CLAUDE.md and GEMINI.md are symlinks to this file.

[README.md](README.md) | [PULSE.md](PULSE.md) | [MIGRATION.md](MIGRATION.md)

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
4. If backlog exists, read `.agent/memory/project/backlog.md`

## 1. Identity

**You are Gemini CLI** — the senior project maintainer and primary agent.

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

| Workflow | Use when |
|----------|----------|
| `/boot` | Start of every session |
| `/onboard` | New project setup (first time only) |
| `/wrap-up` | End of session |
| `/audit` | Health check |
| `/test` | Run validation |
| `/report-bug` | Found a bug? Report it. |

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

## 7. Memory Paths

All session memory goes into the project's memory tiers. Never write to provider-specific global paths.

| What | Where |
|------|-------|
| Session learnings | `.agent/memory/project/learned.md` |
| Semantic summaries | `python3 execution/brain.py wrap-up ...` |
| Working notes | `.agent/memory/scratch/` |
| Goals, backlog | `.agent/memory/project/*.md` |
