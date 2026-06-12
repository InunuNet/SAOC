#!/usr/bin/env bash
# Golden test: creating a mission with a slug that collides with an IN_PROGRESS
# mission must still exit 1 and must not create a new file. This guards against
# over-correcting the done-slug fix (we must NOT also loosen in_progress).
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../../.." && pwd)"
MISSION_PY="${REPO_ROOT}/execution/mission.py"

if [ ! -f "${MISSION_PY}" ]; then
  echo "FAIL  mission.py not found at ${MISSION_PY}"
  exit 1
fi

TMP="$(mktemp -d -t mission_slug_inprog.XXXXXX)"
cleanup() { find "${TMP}" -depth -delete 2>/dev/null || true; }
trap cleanup EXIT

SEED_DIR="${TMP}/.agent/memory/project/missions"
mkdir -p "${SEED_DIR}"

SEED_FILE="${SEED_DIR}/2026-01-01-bar-mission.md"
cat > "${SEED_FILE}" <<SEED
---
schema: athanor.mission/v1
slug: bar-mission
goal: a currently active bar mission
created_at: '2026-01-01T00:00:00+00:00'
started_at: '2026-01-01T00:00:00+00:00'
last_active_at: '2026-01-02T00:00:00+00:00'
status: in_progress
cost_estimate:
  features: 0
  milestones: 0
  total_calls: 0
last_checkpoint:
  milestone: null
  feature: null
  ts: null
features: []
milestones: []
---

# Bar Mission

In progress.
SEED

cd "${TMP}"
OUT="$(python3 "${MISSION_PY}" new "bar mission" --slug bar-mission 2>&1)"
RC=$?

# Assert exit 1.
if [ "${RC}" -ne 1 ]; then
  echo "FAIL  expected exit 1 from in_progress collision, got ${RC}"
  echo "----- mission.py output -----"
  echo "${OUT}"
  exit 1
fi

# Assert NO new bar-mission file was created today (only the seed should remain).
TODAY="$(date -u +%Y-%m-%d)"
UNEXPECTED="${SEED_DIR}/${TODAY}-bar-mission.md"
if [ -f "${UNEXPECTED}" ]; then
  echo "FAIL  in_progress collision wrongly created new mission file: ${UNEXPECTED}"
  exit 1
fi

# Also confirm no second *-bar-mission.md beyond the seed.
COUNT=$(find "${SEED_DIR}" -maxdepth 1 -type f -name '*-bar-mission.md' 2>/dev/null | wc -l | tr -d ' ')
if [ "${COUNT}" != "1" ]; then
  echo "FAIL  expected exactly 1 *-bar-mission.md file (the seed), found ${COUNT}"
  ls -la "${SEED_DIR}"
  exit 1
fi

echo "PASS  in_progress-slug collision -> exit 1 and no new file"
exit 0
