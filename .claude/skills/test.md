---
description: Run validation tests — JSON configs, brain ops, agent sync, symlinks
---

# /test

Run every step in `.agent/workflows/test.md`. Execute each test and report results.

## Quick Reference

1. Validate all JSON configs (settings.json, profile.json)
2. Test brain operations (stats, last-session)
3. Verify agent sync (run sync_agents.sh, check output dirs)
4. Check symlinks (AGENTS.md → CLAUDE.md/GEMINI.md, skills dirs)

Report each test as PASS or FAIL.
