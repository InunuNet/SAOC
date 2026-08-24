#!/usr/bin/env bash
# F1 (admin-settings-deploy-and-chrome-fix) — proves the deployed backend the chrome-verification
# BrowserAgent run tests against actually carries THIS feature's code (the /admin/settings 404 was
# caused by exactly this gap: code committed/gated locally but never confirmed live). Firebase App
# Hosting (backend saoc-prod, project saoc-webapp) auto-deploys on push to `main`
# (docs/a7-firebase-checklist.md) — there is no separate manual deploy step, but a stale rollout
# would make every BrowserAgent finding meaningless, so this is checked explicitly, not assumed.
# Copied verbatim (mechanics unchanged) from contracts/checks/ozow-m1-f3/check-deploy-freshness.sh.
#
# Two conditions, both required:
#   1. HEAD is reachable from origin/main (i.e. actually pushed, not merely committed locally).
#   2. The backend's most recent rollout `updateTime` (from `firebase apphosting:backends:list -j`)
#      is AFTER HEAD's own commit time — proof App Hosting has rolled out a build that includes
#      this commit, not an earlier one still mid-flight or a rollout that predates the push.
#
# Usage: check-deploy-freshness.sh
#
# FAILS ON: HEAD not present on origin/main; the backend's updateTime older than HEAD's commit
# time; the `firebase` CLI or `jq` unavailable; the backend lookup itself erroring.
set -euo pipefail

BACKEND="saoc-prod"
PROJECT="saoc-webapp"

command -v firebase >/dev/null 2>&1 || { echo "FAIL: firebase CLI not found on PATH"; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "FAIL: jq not found on PATH"; exit 1; }

git fetch origin main --quiet
if ! git merge-base --is-ancestor HEAD origin/main; then
  echo "FAIL: HEAD is not reachable from origin/main — commit exists locally but has not been pushed"
  exit 1
fi

HEAD_COMMIT_EPOCH=$(git show -s --format=%ct HEAD)

BACKEND_JSON=$(firebase apphosting:backends:list --project "$PROJECT" -j 2>&1) \
  || { echo "FAIL: firebase apphosting:backends:list failed: $BACKEND_JSON"; exit 1; }

BACKEND_UPDATE_TIME=$(echo "$BACKEND_JSON" | jq -r --arg b "$BACKEND" \
  '.result[] | select(.name | test($b + "$")) | .updateTime // empty')

if [ -z "$BACKEND_UPDATE_TIME" ]; then
  echo "FAIL: could not find backend '$BACKEND' in 'firebase apphosting:backends:list -j' output"
  exit 1
fi

# -u is required on the BSD `date -j` fallback: stripping the fractional seconds also drops
# the trailing 'Z', and without -u this parses the remaining timestamp as LOCAL time (SAST,
# UTC+2) instead of UTC, silently shifting the computed epoch back 2 hours and producing false
# FAILs on genuinely-fresh rollouts.
BACKEND_UPDATE_EPOCH=$(date -d "$BACKEND_UPDATE_TIME" +%s 2>/dev/null \
  || date -j -u -f "%Y-%m-%dT%H:%M:%S" "${BACKEND_UPDATE_TIME%%.*}" +%s 2>/dev/null) \
  || { echo "FAIL: could not parse backend updateTime '$BACKEND_UPDATE_TIME'"; exit 1; }

if [ "$BACKEND_UPDATE_EPOCH" -lt "$HEAD_COMMIT_EPOCH" ]; then
  echo "FAIL: backend '$BACKEND' last rollout ($BACKEND_UPDATE_TIME) predates HEAD's commit time" \
    "($(date -d "@$HEAD_COMMIT_EPOCH" 2>/dev/null || date -r "$HEAD_COMMIT_EPOCH")) —" \
    "the live site has not yet picked up this mission's changes"
  exit 1
fi

echo "PASS: backend '$BACKEND' rollout ($BACKEND_UPDATE_TIME) is newer than HEAD's commit time," \
  "and HEAD is present on origin/main"
exit 0
