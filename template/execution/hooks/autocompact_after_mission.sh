#!/usr/bin/env bash
# autocompact_after_mission.sh — Stop hook.
# Runs the decider only when an arm flag or a Route-A record exists. The decider acts
# only on a flag written by THIS claude session's mission close-out and restores an
# expired Route-A window. Fail closed: any error does nothing and never blocks the Stop.
set -uo pipefail

if [ -f .agent/memory/scratch/autocompact-armed.json ] \
  || [ -f .agent/memory/scratch/autocompact-route-a.json ]; then
  python3 execution/hooks/lib/autocompact_decider.py run >/dev/null 2>&1 || true
fi

echo '{}'
exit 0
