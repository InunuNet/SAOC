---
description: Detect recurring blockers, research root causes, and resolve them — analyst researches, maintainer records fix
---

# /pain-point-monitor

Invoked automatically from /boot when scan-blockers finds recurring issues.
Can also be run manually: `/pain-point-monitor`

## When to run
- Boot step 6 detected a blocker at threshold (2x = RESEARCH, 3x+ = PIVOT)
- User manually suspects a recurring pattern

## Steps

### 1. Parse blocker input
Identify the blocker tag(s) from `python3 execution/brain.py scan-blockers` output.
Note occurrence count and escalation level (RESEARCH or PIVOT).

### 2. Analyst: research root cause
Delegate to analyst with a focused brief:
- Run `python3 execution/brain.py recall "{blocker-tag}" --n 5` — has this been solved before?
- Scan `.agent/memory/project/learned.md` — is there a lesson being ignored?
- If web search tools available: search for known solutions
- Produce: root cause, fix type (`learned` or `backlog`), recommended action, confidence (high/medium/low)

### 3. Determine fix type
- **`learned`** — the fix is behavioral (stop doing X, do Y). Maintainer adds a lesson to learned.md.
- **`backlog`** — the fix requires implementation work. Maintainer adds a specified backlog item.
- **Escalate to human** — if confidence is low or fix type is `code`, produce a clear summary for the user and stop.

### 4. Maintainer: record the fix
- For `learned`: append entry to `.agent/memory/project/learned.md`
- For `backlog`: append item to `.agent/memory/project/backlog.md` with implementation spec

### 5. Mark blocker resolved
```bash
python3 execution/brain.py resolve-blocker --blocker "{tag}" --resolution "{what was done}" --fix-type "{learned|backlog}"
```

### 6. Report
```
✅ PAIN POINT RESOLVED
- Blocker: {tag} ({N}x occurrences)
- Root cause: {analyst finding}
- Fix type: {learned|backlog}
- Action taken: {what maintainer did}
- Confidence: {high|medium|low}
```
