#!/usr/bin/env bash
# wrap_mission.sh — Complete a mission: brain wrap-up + git commit + push.
# Usage: bash execution/skills/wrap_mission.sh "summary" "tag1,tag2"
# Called by Skill("wrap-mission") — reduces token cost of repeated wrap-up pattern.

set -euo pipefail
SUMMARY="${1:-mission complete}"
TAGS="${2:-mission,complete}"

echo "[wrap-mission] Running brain wrap-up..."
python3 execution/brain.py wrap-up -s "$SUMMARY" -t "$TAGS"

echo "[wrap-mission] Committing..."
git add -A 2>/dev/null || true
SLUG=$(python3 -c "
import json, pathlib
p = pathlib.Path('.agent/memory/project/missions/active.json')
if p.exists():
    d = json.loads(p.read_text())
    m = d.get('mission', '') or ''
    import os; print(os.path.splitext(os.path.basename(m))[0])
else:
    print('mission')
" 2>/dev/null || echo "mission")
git commit -m "chore(auto): mission complete — $SLUG" 2>/dev/null || true

echo "[wrap-mission] Pushing..."
git push origin HEAD 2>/dev/null || true

echo "[wrap-mission] Clearing active.json..."
python3 -c "
import json, pathlib
p = pathlib.Path('.agent/memory/project/missions/active.json')
p.write_text(json.dumps({'mission': None, 'checkpoint': None, 'note': 'mission complete'}, indent=2))
" 2>/dev/null || true

echo "[wrap-mission] Done."
