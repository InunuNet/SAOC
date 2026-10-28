#!/usr/bin/env bash
# Production build for the nos-hub-tablet-serif gates, on Sanity FIXTURE REPLAY only (no live Sanity read): SANITY_FIXTURE_MODE=replay, SANITY_FIXTURE_DIR a
# sandbox copy of the tracked capture, K_SERVICE unset, the Sanity API blocked for the build process. A blocked request, or a fixture miss outside the known-pending list (values.json fixture.knownMisses), fails the build.
# The site URLs point at the local gate port. BETA_PASSWORD_WALL_OFF and SITE_PUBLIC_LAUNCH are removed from the environment, never set.
set -euo pipefail
SPEC=".agent/memory/project/specs/nos-hub-tablet-serif"
PORT="${NOS_HUB_SERIF_PORT:-3081}"
export NEXT_PUBLIC_SANITY_PROJECT_ID=26yfbug4
export NEXT_PUBLIC_SANITY_DATASET=production
export NEXT_PUBLIC_NOS_SITE_URL="http://nos.localhost:${PORT}"
export NEXT_PUBLIC_SAOC_SITE_URL="http://saoc.localhost:${PORT}"
unset BETA_PASSWORD_WALL_OFF
unset SITE_PUBLIC_LAUNCH
unset K_SERVICE
bash "$SPEC/checks/prep-fixtures.sh"
FIX_LOG="$PWD/.tmp/sandbox/nos-hub-tablet-serif-gate/fixture-logs-build"
mkdir -p "$FIX_LOG"
for f in _started.log _hits.log _misses.log _requests.log _net.log _assets.log; do : > "$FIX_LOG/$f"; done
export SANITY_FIXTURE_MODE=replay
export SANITY_FIXTURE_DIR="$PWD/.tmp/sandbox/nos-hub-tablet-serif-fixtures/sanity"
export SANITY_FIXTURE_LOGDIR="$FIX_LOG"
export NODE_OPTIONS="${NODE_OPTIONS:-} --require \"$PWD/$SPEC/checks/block-sanity-net.cjs\""
pnpm build
node "$SPEC/checks/check-fixture-misses.mjs" "$FIX_LOG"
