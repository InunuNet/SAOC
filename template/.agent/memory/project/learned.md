# Learned Lessons

This file documents key learnings, decisions, and pitfalls encountered during the project's development. It serves as a knowledge base to avoid repeating mistakes and to streamline future work.

## General
- **Backlog format**: Always use `- [ ]` / `- [x]` checkbox format in backlog.md. The maintainer agent's tick step only matches this format. Tables, prose bullets, and `~~struck~~` sections will be silently skipped, causing backlog drift. If you see a ⚠️ STALE BACKLOG warning at boot, run @maintainer to fix it.
