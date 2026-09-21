#!/usr/bin/env bash
# pre_compact_snapshot.sh — PreCompact command hook.
# Prior version only stored a 5-line git log via brain.remember, so scratch
# notes, uncommitted diffs, and mission checkpoint state were silently lost
# whenever auto-compact fired mid-session. This captures a full recoverable
# snapshot instead: dirty tree state, diff stat, active mission checkpoint,
# and the scratch directory listing, in one brain.remember entry that
# last-session/boot already surfaces on the next turn.
set -uo pipefail

input=$(cat)
trigger=$(printf '%s' "$input" | python3 -c "import sys,json; print(json.load(sys.stdin).get('compaction_trigger','unknown'))" 2>/dev/null || echo "unknown")

recent=$(git log --oneline -8 2>/dev/null | tr '\n' '; ' || echo "no git")
dirty=$(git status --short 2>/dev/null | tr '\n' '; ' || echo "none")
diffstat=$(git diff --stat HEAD 2>/dev/null | tail -5 | tr '\n' '; ' || echo "none")
branch=$(git branch --show-current 2>/dev/null || echo "unknown")

mission_info="no active mission"
if [ -f .agent/memory/project/missions/active.json ]; then
  mission_info=$(python3 -c "
import json
try:
    a = json.load(open('.agent/memory/project/missions/active.json'))
    print(f\"{a.get('mission','?')} @ {a.get('checkpoint','?')}\")
except Exception as e:
    print(f'unreadable: {e}')
" 2>/dev/null)
fi

scratch_files=$(ls -1 .agent/memory/scratch/ 2>/dev/null | tr '\n' '; ' || echo "empty")

summary="PRE-COMPACT SNAPSHOT ($trigger) branch=$branch | mission=$mission_info | dirty_files=$dirty | diffstat=$diffstat | recent_commits=$recent | scratch=$scratch_files"

python3 execution/brain.py remember --summary "$summary" --tags "compaction,checkpoint,recovery" 2>/dev/null || true

exit 0
