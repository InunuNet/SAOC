---
description: Every session compacts itself past 100k at a natural break, never mid-edit. Always loaded.
---

# Self-Compaction

Every session manages its own context; never wait to be told (Brad 2026-11-19). About 100k is
your working context, 350k the hard ceiling, and 500k only the automatic fallback.

- Check `python3 execution/compact.py status` at every natural break: a commit, a gate result,
  a finished feature or answered question.
- Past 100k, run the full wrap-up first so whatever drops out of context stays recallable:
  update `learned.md` and `backlog.md`, run `brain.py wrap-up --summary ... --next ... --facts ...`,
  confirm it stored with `brain.py last-session --quiet`, and only then
  `python3 execution/compact.py now`; `python3 execution/compact.py restore` once resumed.
- Never mid-edit or while waiting on an operator answer: `compact.py delay`, finish, then compact.
