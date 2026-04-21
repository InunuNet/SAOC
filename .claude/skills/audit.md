---
description: Run a workspace health check — validates configs, symlinks, agents, and brain
---

# /audit

Run every step in `.agent/workflows/audit.md`. Execute each check and report results.

## Quick Reference

1. Check file structure (.agent/agents/, .agent/rules/, .agent/memory/project/)
2. Validate JSON configs (.claude/settings.json, .gemini/settings.json, .agent/profile.json)
3. Check symlinks (CLAUDE.md, GEMINI.md, .claude/skills, .gemini/skills)
4. Check brain (python3 execution/brain.py stats)
5. Check agents synced (.agent/agents/ vs .claude/agents/ vs .gemini/agents/)

Report each check as PASS or FAIL with details.
