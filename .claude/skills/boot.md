---
description: Boot the project — load all context, verify workspace, recall last session
---

# /boot

Run the full Athanor boot sequence. Use this at session start or any time you need to force a full context reload.

## Steps

### 0. Check workspace status

```bash
cat .agent/profile.json | python3 -c "
import sys, json
p = json.load(sys.stdin)
status = p.get('status', 'active')
if status == 'archive':
    print('⚠️  WARNING: This workspace is ARCHIVED. It has been superseded.')
    print('   Check goals.md for the replacement project.')
else:
    print('✅ Status: active')
"
```

If status is `archive` → warn the user before proceeding. Do not stop — archived projects can still be worked on.

### 1. Verify workspace boundary

```bash
cat WORKSPACE 2>/dev/null || echo "MISSING"
pwd && cat .agent/profile.json | python3 -c "import sys,json; p=json.load(sys.stdin); print('Project:', p.get('project_name','UNKNOWN'), '| Type:', p.get('project_type','?'), '| Soul:', p.get('soul_type','?'), '| Onboarded:', p.get('onboarding_complete', False))"
```

If `WORKSPACE` is missing or names don't match the directory → **STOP**. Tell the user to open this project in its own IDE window.

### 2. Last session recall

```bash
python3 execution/brain.py last-session --quiet
```

Also show the most recent session_log entry:
```bash
python3 -c "
import re
content = open('.agent/memory/project/session_log.md').read()
entries = re.split(r'(?=^## \d{4})', content, flags=re.MULTILINE)
entry = next((e.strip() for e in entries if e.startswith('## ')), None)
print(entry or 'No session log entries yet')
" 2>/dev/null || true
```

### 3. KI recall (cross-project patterns)

```bash
python3 execution/ki_recall.py "$(cat .agent/profile.json | python3 -c "import sys,json; p=json.load(sys.stdin); print(p.get('project_type','general'))")" --n 3 2>/dev/null || true
```

Non-blocking — skip if no results.

### 4. Read project context

Read these files:
- `.agent/memory/project/goals.md`
- `.agent/memory/project/learned.md`
- `.agent/memory/project/backlog.md` (if exists)

### 5. Brain recall

```bash
python3 execution/brain.py recall "current work" --n 3
```

### 6. Scan for recurring blockers

```bash
python3 execution/brain.py scan-blockers
```

If recurring blockers are detected:
- **🟡 RESEARCH (2 occurrences):** Before starting work, delegate to the analyst agent to do deep research on the blocker. The analyst should use web search to determine if this is a known issue, find workarounds or alternatives, and present findings before the team continues down the same path.
- **🔴 PIVOT (3+ occurrences):** Escalate to the architect agent. The architect should evaluate whether to continue the current approach or pivot to an alternative. Present the options with tradeoffs to the user. Do NOT continue the current approach without explicit user approval.

When blockers are found at either threshold, run `/pain-point-monitor` to research the root cause and record a fix (learned lesson or backlog item) rather than just noting the warning.

If no recurring blockers → proceed normally.

### 7. Git remotes check

```bash
git remote -v
```

Every project needs `origin` (your repo). Updates from the template happen via `make update-template` (using `gh` CLI). Warn if `origin` is missing or `gh` is not authenticated.

### 8. Version check

```bash
current=$(cat .agent/version 2>/dev/null | tr -d '[:space:]')
latest=$(gh release view --repo InunuNet/Athanor --json tagName -q .tagName 2>/dev/null | sed 's/^v//')
if [ -n "$current" ] && [ -n "$latest" ]; then
  if [ "$current" = "$latest" ]; then
    echo "✅ Athanor $current — up to date"
  else
    echo "⚠️ Athanor $current — latest is $latest. Run \`make update-template\` to upgrade."
  fi
fi
```

Non-blocking — skip silently if `gh` fails (no auth, no network, no `.agent/version`).

### 9. Pulse Status

```bash
bash execution/get_pulse_status.sh
```

### 10. Report status

Summarise in the standard boot output:
```
✅ WORKSPACE: [name]
✅ Last session: [one line]
📋 Active goals: [count]
🔧 Open backlog items: [count]
➡️ Ready. What are we working on?
```

If `onboarding_complete: false` → prompt user to run `/onboard` first.
