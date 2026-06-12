#!/usr/bin/env bash
# Golden test: creating a mission with a slug that collides with a DONE mission
# from a previous date must succeed (exit 0) and create the new file under today's
# date prefix. This is the regression test for the sys.exit(0) -> continue fix.
set -uo pipefail

# Resolve repo root and mission.py absolute path. Script lives at
# <repo>/execution/tests/golden/mission_py_slug_exit/<script>.sh.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../../.." && pwd)"
MISSION_PY="${REPO_ROOT}/execution/mission.py"

if [ ! -f "${MISSION_PY}" ]; then
  echo "FAIL  mission.py not found at ${MISSION_PY}"
  exit 1
fi

TMP="$(mktemp -d -t mission_slug_done.XXXXXX)"
cleanup() { find "${TMP}" -depth -delete 2>/dev/null || true; }
trap cleanup EXIT

# mission.py uses Path(".agent/memory/project/missions") relative to cwd.
SEED_DIR="${TMP}/.agent/memory/project/missions"
mkdir -p "${SEED_DIR}"

# Seed a DONE mission from a past date with matching slug.
SEED_FILE="${SEED_DIR}/2026-01-01-foo-mission.md"
cat > "${SEED_FILE}" <<SEED
---
schema: athanor.mission/v1
slug: foo-mission
goal: a previously completed foo mission
created_at: '2026-01-01T00:00:00+00:00'
started_at: '2026-01-01T00:00:00+00:00'
last_active_at: '2026-01-02T00:00:00+00:00'
status: done
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

# Foo Mission

Previously completed.
SEED

# Run mission.py new from the temp cwd so its hardcoded MISSIONS_DIR
# resolves into ${TMP}/.agent/memory/project/missions.
cd "${TMP}"
OUT="$(python3 "${MISSION_PY}" new "foo mission" --slug foo-mission 2>&1)"
RC=$?

# Assert exit 0.
if [ "${RC}" -ne 0 ]; then
  echo "FAIL  expected exit 0 from mission.py new, got ${RC}"
  echo "----- mission.py output -----"
  echo "${OUT}"
  exit 1
fi

# Assert a NEW *-foo-mission.md exists that is not the seed file.
TODAY="$(date -u +%Y-%m-%d)"
EXPECTED_NEW="${SEED_DIR}/${TODAY}-foo-mission.md"

NEW_FOUND=0
if [ -f "${EXPECTED_NEW}" ] && [ "${EXPECTED_NEW}" != "${SEED_FILE}" ]; then
  NEW_FOUND=1
else
  # Fallback: any file matching the slug other than the seed.
  while IFS= read -r f; do
    if [ "${f}" != "${SEED_FILE}" ]; then
      NEW_FOUND=1
      break
    fi
  done < <(find "${SEED_DIR}" -maxdepth 1 -type f -name '*-foo-mission.md' 2>/dev/null)
fi

if [ "${NEW_FOUND}" -ne 1 ]; then
  echo "FAIL  no new mission file created for slug foo-mission after done-collision"
  echo "----- mission.py output -----"
  echo "${OUT}"
  echo "----- dir listing -----"
  ls -la "${SEED_DIR}"
  exit 1
fi

echo "PASS  done-slug collision -> exit 0 and new mission file created"
exit 0
