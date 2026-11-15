---
description: Finish a mission in one step: brain wrap-up, git commit, push, clear active.json. Use after every chain step is done and the gate has passed.
---

# wrap-mission

Complete a mission cleanly in one step: brain wrap-up + git commit + git push + clear active.json.

## When to use
After ALL chain steps are done and the gate has passed. This is the final step of every mission.

## Usage
```bash
bash execution/skills/wrap_mission.sh "what was accomplished" "tag1,tag2"
```

## What it does
1. `python3 execution/brain.py wrap-up` — stores session learning in semantic memory
2. Stages ONLY the active mission's own files (`execution/skills/lib/scoped_stage.py`: the touched-files
   ledger, the mission file and its spec dir) plus `backlog.md` and `data/`, scans them with
   `secret_guard.py`, then commits. Never `git add -A`: a file changed outside the ledger (e.g. by a
   shell command) stays uncommitted, so commit it yourself.
3. `git push origin HEAD` — pushes to the project's GitHub repo
4. Clears `active.json` — marks mission complete for Pulse

## Token cost
One line invocation vs ~40 tokens of reasoning about each step separately.
