#!/usr/bin/env bash
# Production build on Sanity FIXTURE REPLAY only: SANITY_FIXTURE_MODE=replay against the sandbox copy, K_SERVICE unset, the Sanity API blocked for the
# build process. A blocked request or any fixture miss fails the build. Site URLs point at the gate port. BETA_PASSWORD_WALL_OFF and SITE_PUBLIC_LAUNCH are unset, never set.
set -euo pipefail
SPEC=".agent/memory/project/specs/nos-archive-back-arrow"
PORT="${NOS_ARROW_PORT:-3190}"
yaml_value() { grep -A1 "variable: $1\$" apphosting.yaml | grep 'value:' | head -1 | sed -E 's/.*value: *"([^"]*)".*/\1/'; }
export NEXT_PUBLIC_SANITY_PROJECT_ID="$(yaml_value NEXT_PUBLIC_SANITY_PROJECT_ID)"
export NEXT_PUBLIC_SANITY_DATASET="$(yaml_value NEXT_PUBLIC_SANITY_DATASET)"
[ -n "$NEXT_PUBLIC_SANITY_PROJECT_ID" ] && [ -n "$NEXT_PUBLIC_SANITY_DATASET" ] || { echo "could not read Sanity ids from apphosting.yaml" >&2; exit 1; }
export NEXT_PUBLIC_NOS_SITE_URL="http://nos.localhost:${PORT}"
export NEXT_PUBLIC_SAOC_SITE_URL="http://saoc.localhost:${PORT}"
export SITE_URL="http://nos.localhost:${PORT}"
unset BETA_PASSWORD_WALL_OFF
unset SITE_PUBLIC_LAUNCH
unset K_SERVICE
bash "$SPEC/checks/prep-fixtures.sh"
FIX_LOG="$PWD/.tmp/sandbox/nos-archive-back-arrow-gate/fixture-logs-build"
mkdir -p "$FIX_LOG"
for f in _started.log _hits.log _misses.log _requests.log _net.log _assets.log; do : > "$FIX_LOG/$f"; done
export SANITY_FIXTURE_MODE=replay
export SANITY_FIXTURE_DIR="$PWD/.tmp/sandbox/nos-archive-back-arrow-fixtures/sanity"
export SANITY_FIXTURE_LOGDIR="$FIX_LOG"
export NODE_OPTIONS="${NODE_OPTIONS:-} --require \"$PWD/.agent/memory/project/specs/nos-content-standard/checks/block-sanity-net.cjs\""
pnpm build
[ ! -s "$FIX_LOG/_net.log" ] || { echo "build made a Sanity API request while the fixture was in use:" >&2; cat "$FIX_LOG/_net.log" >&2; exit 1; }
[ ! -s "$FIX_LOG/_misses.log" ] || { echo "build hit a fixture miss:" >&2; cat "$FIX_LOG/_misses.log" >&2; exit 1; }
