# Workspace Scope Rules

## HARD BOUNDARY — Do Not Cross

**Never read, write, or modify files outside this project directory.**

Specifically forbidden — these paths are out of scope for every Athanor agent:

| Path | Reason |
|------|--------|
| `~/.claude/PAI/` | PAI infrastructure — owned by Brad, not by any project |
| `~/.claude/MEMORY/` | Global PAI memory — not a Athanor concept |
| `~/.claude/settings.json` | Global Claude Code config — user-owned |
| `~/.claude/CLAUDE.md` | Global agent instructions — user-owned |
| Any sibling project directory | Cross-project edits cause data loss |

If a task seems to require touching one of these paths, **stop and ask**. Do not rationalize an exception. The fix lives inside this project, not in the shared infrastructure.

## What to do instead

| Instead of touching... | Do this |
|------------------------|---------|
| `~/.claude/PAI/Algorithm/` | File a Athanor bug or backlog item; request the change from Brad |
| `~/.claude/MEMORY/LEARNING/` | Use `python3 execution/brain.py remember` |
| `~/.claude/MEMORY/WORK/` | Use `.agent/memory/project/` or `brain.py` |
| `~/.claude/settings.json` | Edit `.claude/settings.json` (project scope only) |
