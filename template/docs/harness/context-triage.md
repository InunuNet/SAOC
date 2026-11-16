# Context triage

Keeps the context that loads every turn small, so a fresh post-compaction session starts under
budget. Tool: `python3 execution/context_audit.py` (stdlib, each command takes `--root DIR`).

## What is measured

`report [--json] [--strict]` counts tokens as `(bytes + 3) // 4` per source and flags any over its
budget. A missing source is skipped. `--strict` exits 1 when anything is over.

| Source | Budget (tokens) |
|---|---|
| `CLAUDE.md` | 3000 |
| rules (`.claude/rules/*.md`) | 5000 |
| `goals.md` | 1500 |
| `backlog.md` | 2000 |
| `rules.md` (project) | 2500 |
| identity (`.agent/identity/*.md`) | 500 |
| skills (frontmatter descriptions) | 2500 |
| agents (frontmatter descriptions) | 1500 |

## The 7th close-out rule

`mission.py close-out` runs `context_audit.py tick`, which counts close-outs in
`.agent/memory/project/context_triage.json`. On every 7th it writes
`.agent/memory/scratch/CONTEXT_TRIAGE_DUE` (over-budget sources and the steps below) and prints
`CONTEXT TRIAGE DUE`. A failing tick never fails the close-out.

## Maintainer triage

1. Read the marker; run `context_audit.py report`.
2. Bring each over-budget source under its budget by archiving, never deleting.
3. Run `context_audit.py done` (clears the marker, records `last_triage`).

`learned.md` is not per-turn; archive it only when over 400 KB.

## Archive commands

- `archive FILE --done` moves every `- [x]` line to the archive.
- `archive FILE --section '## Heading'` moves the heading and its body up to the next heading of
  the same or higher level.

FILE must be a regular file inside `.agent/memory/`, otherwise nothing changes and the exit is
non-zero. The archive is `.agent/memory/archive/<stem>-<YYYYMMDD>.md`, appended to. Nothing is
deleted: the source plus the archive always cover the original, and a repeat run is a no-op.
