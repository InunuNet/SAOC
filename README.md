# Athanor

> Provider-agnostic agentic workspace template. Native-first, custom-last.

**v3.3.4** — Claude Code (P1) · Gemini CLI (P2) · OpenCode (P3)

## Quick Start

```bash
# Clone and enter
git clone https://github.com/InunuNet/Athanor.git myproject
cd myproject

# Sync agents to your platform
make sync-agents

# Verify
make audit
```

## What Is This?

Athanor is a convention layer for AI coding agents. It provides:

- **8 agents** — lead, dev, designer, analyst, architect, qa, docs, maintainer
- **Native hooks** — SessionStart (brain recall), SessionEnd (wrap-up reminder)
- **Semantic memory** — brain.py (Chroma vector DB) persists across sessions
- **Self-improvement** — maintainer agent updates goals + lessons automatically
- **Cross-platform** — one definition, Claude + Gemini configs generated

## Architecture

```
AGENTS.md           ← Universal entrypoint (CLAUDE.md + GEMINI.md symlink here)
.agent/agents/      ← Canonical agent definitions (single source of truth)
.agent/rules/       ← Shared rules (core + security)
.agent/memory/      ← brain/ (vector DB) + project/ (goals, lessons) + scratch/
.agent/workflows/   ← /boot, /wrap-up, /audit, /test
.claude/            ← Native Claude hooks, permissions, generated agents
.gemini/            ← Native Gemini hooks, generated agents
execution/          ← brain.py, sync_agents.sh (the only custom code)
```

## Commands

```bash
make sync-agents      # Generate platform agent configs
make brain-stats      # Show memory stats
make brain-export     # Export memories to JSON
make audit            # Workspace health check
make commit           # Semantic commit (TYPE=feat MSG='...')
```

## Memory

| Tier | Path | Purpose |
|------|------|---------|
| Scratch | `.agent/memory/scratch/` | Session temp |
| Project | `.agent/memory/project/` | Goals, lessons, backlog |
| Brain | `.agent/memory/brain/` | Semantic vector DB |

```bash
python3 execution/brain.py remember -s "decision" -t "tags"
python3 execution/brain.py recall "topic"
python3 execution/brain.py last-session
python3 execution/brain.py wrap-up -s "summary" -t "tags"
```

## Agents

| Agent | Tier | Role |
|-------|------|------|
| lead | pro | Orchestrates, never writes code |
| dev | flash | Implements code |
| designer | flash | UI/UX design, component specs, accessibility. Never implements. |
| analyst | pro | Research, read-only |
| architect | pro | Design decisions |
| qa | flash | Testing + review |
| docs | flash | Documentation |
| maintainer | pro | Self-improvement |

## Self-Improvement Loop

```
Session starts → brain recall → read goals + lessons → work → session ends
  → run /wrap-up → maintainer updates lessons/goals/backlog → stores in brain
  → next session starts smarter
```

## Documentation

- [AGENTS.md](AGENTS.md) — How the autonomous agent team works.
- [PULSE.md](PULSE.md) — How the automated monitoring and maintenance system works.
- [MIGRATION.md](MIGRATION.md) — Upgrading from older templates.

## License

MIT
