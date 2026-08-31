#!/usr/bin/env bash
# quick_gate.sh — Find active mission's contract and run the phase 4 gate.
# Usage: bash execution/skills/quick_gate.sh
# Called by Skill("quick-gate") — no need to construct contract path manually.

set -euo pipefail

ACTIVE=$(python3 -c "
import json, pathlib
p = pathlib.Path('.agent/memory/project/missions/active.json')
if p.exists():
    d = json.loads(p.read_text())
    print(d.get('mission') or 'null')
else:
    print('null')
" 2>/dev/null || echo "null")

if [[ "$ACTIVE" == "null" ]]; then
  echo "[quick-gate] No active mission." >&2
  exit 1
fi

SLUG=$(python3 -c "import os,sys; print(os.path.splitext(os.path.basename('$ACTIVE'))[0].lstrip('0123456789-'))" 2>/dev/null || echo "")
# Strip date prefix
SLUG=$(echo "$SLUG" | sed 's/^[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}-//' || true)

if [[ "$SLUG" == *[\*\?\[]* ]]; then
  echo "[quick-gate] ERROR: mission slug '$SLUG' contains glob metacharacters (*, ?, [) -- refusing to use it in a filesystem glob pattern." >&2
  exit 1
fi

mapfile -t CONTRACT_MATCHES < <(find .agent/memory/project/specs -ipath "*/specs/${SLUG}/contract-f*.yaml" 2>/dev/null || true)

if [[ ${#CONTRACT_MATCHES[@]} -eq 0 ]]; then
  CONTRACT=""
elif [[ ${#CONTRACT_MATCHES[@]} -eq 1 ]]; then
  CONTRACT="${CONTRACT_MATCHES[0]}"
else
  CONTRACT=$(printf '%s\n' "${CONTRACT_MATCHES[@]}" | sed -E 's/.*contract-f([0-9]+)\.yaml$/\1 &/' | sort -rn -k1,1 | head -1 | cut -d' ' -f2-)
  echo "[quick-gate] WARNING: ${#CONTRACT_MATCHES[@]} contracts match slug '$SLUG' -- picking deterministically." >&2
  for m in "${CONTRACT_MATCHES[@]}"; do
    echo "[quick-gate]   candidate: $m" >&2
  done
  echo "[quick-gate]   picked (highest feature number): $CONTRACT" >&2
fi

if [[ -z "$CONTRACT" ]]; then
  # Fallback: any recent contract
  CONTRACT=$(find .agent/memory/project/specs -name "contract-f*.yaml" -newer "$ACTIVE" 2>/dev/null | head -1 || echo "")
fi

if [[ -z "$CONTRACT" ]]; then
  echo "[quick-gate] No contract found for mission $SLUG." >&2
  exit 1
fi

echo "[quick-gate] Running gate: $CONTRACT"
python3 execution/contract.py gate "$CONTRACT" --phase 4 --run-checks
