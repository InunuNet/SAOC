---
name: recall
description: Canonical brain.py recall invocation — search semantic memory for prior decisions, learnings, and session summaries before starting work.
usage: Invoke this skill before starting any non-trivial work to surface relevant prior context. Replaces ad-hoc grep over learned.md and scratch notes.
---

# recall

Wraps `python3 execution/brain.py recall` with a consistent invocation pattern. Every agent prompt references brain operations directly — this skill makes them one-line and discoverable.

## When to use

- **Before starting work** — search for prior decisions on the topic
- **When stuck** — search for similar problems already solved
- **When unsure** — search for prior consensus before contradicting it
- **NEVER for trivial tasks** — read/status/single-command tasks don't need recall

## Usage

```bash
# Basic recall — top 5 most relevant memories
python3 execution/brain.py recall "your query here" --n 5

# Narrower — top 3
python3 execution/brain.py recall "alembic caching" --n 3

# Wider — top 10 for broad survey
python3 execution/brain.py recall "skill design patterns" --n 10
```

## Output format

Each result includes:
- Timestamp
- Relevance score (0–1, higher = more relevant)
- Tags
- Summary text

Scan scores: above 0.5 = strongly relevant, 0.3–0.5 = tangentially related, under 0.3 = noise.

## Interpretation rules

- **Multiple high-relevance results agreeing** → established pattern, follow it
- **High-relevance result with contradicting evidence** → check `learned.md` for the most recent decision before acting
- **No results above 0.3** → genuinely novel territory, proceed with full chain (architect → dev → qa → docs)

## Related brain commands

```bash
# What was I doing last session?
python3 execution/brain.py last-session

# Store a new learning (usually maintainer does this)
python3 execution/brain.py remember --summary "what happened" --tags "tags"

# Find unresolved blockers
python3 execution/brain.py scan-blockers
```

## Related skills

- `active-mission` — pair with this to recall mission-scoped memories
- `chain-dispatch` — agents in the chain should recall before dispatching
