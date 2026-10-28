#!/usr/bin/env bash
# A14 on Sanity fixture replay only (no live Sanity read). Run from the repo root. SITE_PUBLIC_LAUNCH and BETA_PASSWORD_WALL_OFF are removed from the environment, never set.
#   1. The full CI e2e command (scripts/ci-e2e.sh pnpm test:e2e) on SANITY_FIXTURE_MODE=replay with the sandbox fixture copy, K_SERVICE unset and the Sanity API blocked,
#      minus the one spec that needs the fixture OFF.
#   2. That spec (sanity-fetch-fixture-miss.spec.ts) in its OWN invocation with SANITY_FIXTURE_MODE and SANITY_FIXTURE_DIR unset and the Sanity API still blocked (it has no
#      server and makes no request; a blocked request would be logged and fails the run).
# The runner refuses to start if SANITY_FIXTURE_MODE is already exported as anything but replay, and proves afterwards that run 1 was on replay and that neither run made a
# Sanity API request.
set -euo pipefail
SPEC=".agent/memory/project/specs/nos-hub-tablet-serif"
if [ -n "${SANITY_FIXTURE_MODE:-}" ] && [ "${SANITY_FIXTURE_MODE}" != "replay" ]; then
  echo "refusing to start: SANITY_FIXTURE_MODE=${SANITY_FIXTURE_MODE} (A14 runs on replay only)" >&2
  exit 1
fi
bash "$SPEC/checks/prep-fixtures.sh"
export NEXT_PUBLIC_SANITY_PROJECT_ID=26yfbug4
export NEXT_PUBLIC_SANITY_DATASET=production
unset BETA_PASSWORD_WALL_OFF SITE_PUBLIC_LAUNCH K_SERVICE
LOGS="$PWD/.tmp/sandbox/nos-hub-tablet-serif-gate"
FIX_LOG="$LOGS/fixture-logs-e2e"
OFF_LOG="$LOGS/fixture-logs-e2e-fixture-off"
for d in "$FIX_LOG" "$OFF_LOG"; do mkdir -p "$d"; for f in _started.log _hits.log _misses.log _requests.log _net.log _assets.log; do : > "$d/$f"; done; done
BLOCK="--require \"$PWD/$SPEC/checks/block-sanity-net.cjs\""

export SANITY_FIXTURE_MODE=replay
export SANITY_FIXTURE_DIR="$PWD/.tmp/sandbox/nos-hub-tablet-serif-fixtures/sanity"
export SANITY_FIXTURE_LOGDIR="$FIX_LOG"
[ "$SANITY_FIXTURE_MODE" = "replay" ] || { echo "SANITY_FIXTURE_MODE is not replay" >&2; exit 1; }
NODE_OPTIONS="${NODE_OPTIONS:-} $BLOCK" bash scripts/ci-e2e.sh pnpm test:e2e --grep-invert "with the fixture off"

# Run 2: the fixture-off spec, alone, fixture mode unset, API blocked.
env -u SANITY_FIXTURE_MODE -u SANITY_FIXTURE_DIR SANITY_FIXTURE_LOGDIR="$OFF_LOG" NODE_OPTIONS="${NODE_OPTIONS:-} $BLOCK" \
  pnpm exec playwright test --config "$SPEC/checks/playwright.fixture-off.config.mjs" --grep "with the fixture off"

# Proof.
node "$SPEC/checks/check-fixture-misses.mjs" "$FIX_LOG"
node "$SPEC/checks/check-fixture-misses.mjs" "$OFF_LOG"
grep -q "mode=replay" "$FIX_LOG/_started.log" || { echo "run 1 never ran on fixture replay (no mode=replay in _started.log)" >&2; exit 1; }
