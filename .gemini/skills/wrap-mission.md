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
2. `git add -A && git commit` — commits all work with auto-generated message
3. `git push origin HEAD` — pushes to the project's GitHub repo
4. Clears `active.json` — marks mission complete for Pulse

## Token cost
One line invocation vs ~40 tokens of reasoning about each step separately.
