---
description: End-of-session wrap-up — update memory, append session log, store brain summary
---

# /wrap-up

Run this at the end of every session to persist context for the next one.

## Steps

### 1. Review what changed

Check git for this session's work:
```bash
git log --oneline -5
git diff --stat HEAD~3 HEAD 2>/dev/null || true
```

### 2. Update learned.md

Read `.agent/memory/project/learned.md` and add new entries if any lessons were discovered this session. Format:

```markdown
## L[N]: [Title] ([YYYY-MM-DD])

[What was learned — 2-4 sentences]

**Rule**: [Actionable takeaway in one sentence]
```

Only add entries for genuinely new, non-obvious lessons. Skip if nothing new.

### 3. Update goals.md and backlog.md

- Tick completed backlog items with `[x]`
- Add any new tasks discovered this session
- Update goals.md if milestones were reached

### 4. Append to session_log.md

Append a new entry at the TOP of `.agent/memory/project/session_log.md` (below the `<!-- SESSIONS -->` comment or below the header). Keep most recent first. Drop oldest entry if over 20.

Format exactly:
```
## YYYY-MM-DD — [one-line summary]
- [bullet per major change]
- [bullet per major change]
Commits: [git log --oneline -3]
```

### 5. Auto-detect blockers

Run blocker scan and note any recurring issues for tagging:
```bash
python3 execution/brain.py scan-blockers 2>/dev/null
```

If the scan reports recurring blockers, collect their short identifiers (e.g., `tauri-popup`, `api-rate-limit`). If no blockers, omit the `--blockers` flag in step 6.

### 6. Store brain summary

```bash
# With blockers detected in step 5:
python3 execution/brain.py wrap-up --summary "$(git log --oneline -3 2>/dev/null || echo 'no commits')" --tags "session,wrap-up" --blockers "blocker-id-1,blocker-id-2"

# Without blockers:
python3 execution/brain.py wrap-up --summary "$(git log --oneline -3 2>/dev/null || echo 'no commits')" --tags "session,wrap-up"
```

Use real blocker identifiers from step 5 — never paste the placeholder text literally.

### 7. Confirm

Report:
```
✅ WRAP-UP COMPLETE
- Learned: [N new lessons / none]
- Backlog: [N items ticked / N added]
- Session log: entry appended
- Brain: stored [mem_ID]
- Blockers: [tags logged / none]
```
