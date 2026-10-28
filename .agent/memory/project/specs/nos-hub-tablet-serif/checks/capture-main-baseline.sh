#!/usr/bin/env bash
# Builds the base ref (origin/main by default) under .tmp/sandbox/hub-main-baseline from a git archive (no worktree, no stash, no checkout of the working tree),
# on fixture replay only, then captures its header strips. Skipped when the baseline for the same commit is already captured.
# Run from the repo root. SITE_PUBLIC_LAUNCH and BETA_PASSWORD_WALL_OFF are removed from the environment, never set.
set -euo pipefail
SPEC=".agent/memory/project/specs/nos-hub-tablet-serif"
# The baseline is main as the branch last merged it: the merge-base of HEAD and origin/main, so it cannot go stale when the branch merges main again (it was pinned to e9edbe4a once and went stale after the merge of 48d74378).
REF="${HUB_SERIF_BASE_REF:-$(git merge-base HEAD origin/main)}"
[ -n "$REF" ] || { echo "no merge-base of HEAD and origin/main: fetch origin or set HUB_SERIF_BASE_REF" >&2; exit 2; }
DIR=".tmp/sandbox/hub-main-baseline"
PORT="$(( ${NOS_HUB_SERIF_PORT:-3081} + 9 ))"
SHA="$(git rev-parse "$REF")"
echo "main baseline ref: $SHA (merge-base of HEAD and origin/main unless HUB_SERIF_BASE_REF is set)"
CAPTURE_STAMP="$SHA $(shasum -a 256 "$SPEC/checks/capture-header.mjs" | cut -d' ' -f1)"
if [ -f "$DIR/.baseline-stamp" ] && [ "$(cat "$DIR/.baseline-stamp")" = "$CAPTURE_STAMP" ] && [ -s "$SPEC/evidence/header-baseline/header-767@2.png" ] && [ -s "$SPEC/evidence/header-baseline/header-390@3.png" ]; then
  echo "main header baseline already captured for $CAPTURE_STAMP"
  exit 0
fi
# The build of this commit is reused; only the capture is redone when the capture function changed.
BUILT_SHA="$(cat "$DIR/.build-sha" 2>/dev/null || cat "$DIR/.baseline-sha" 2>/dev/null || true)"
if [ "$BUILT_SHA" = "$SHA" ] && [ -d "$DIR/.next" ]; then
  export NEXT_PUBLIC_NOS_SITE_URL="http://nos.localhost:${PORT}"
  export NEXT_PUBLIC_SAOC_SITE_URL="http://saoc.localhost:${PORT}"
  unset BETA_PASSWORD_WALL_OFF SITE_PUBLIC_LAUNCH K_SERVICE
  node "$SPEC/checks/capture-main-baseline.mjs"
  echo "$CAPTURE_STAMP" > "$DIR/.baseline-stamp"
  exit 0
fi
python3 execution/safe_delete.py "$DIR" || true
mkdir -p "$DIR"
git archive "$REF" | tar -x -C "$DIR"
pnpm --dir "$DIR" install --frozen-lockfile --offline
export NEXT_PUBLIC_SANITY_PROJECT_ID=26yfbug4
export NEXT_PUBLIC_SANITY_DATASET=production
export NEXT_PUBLIC_NOS_SITE_URL="http://nos.localhost:${PORT}"
export NEXT_PUBLIC_SAOC_SITE_URL="http://saoc.localhost:${PORT}"
export SITE_URL="http://nos.localhost:${PORT}"
unset BETA_PASSWORD_WALL_OFF SITE_PUBLIC_LAUNCH K_SERVICE
bash "$SPEC/checks/prep-fixtures.sh"
FIX_LOG="$PWD/.tmp/sandbox/nos-hub-tablet-serif-gate/fixture-logs-baseline-build"
mkdir -p "$FIX_LOG"
for f in _started.log _hits.log _misses.log _requests.log _net.log _assets.log; do : > "$FIX_LOG/$f"; done
export SANITY_FIXTURE_MODE=replay
export SANITY_FIXTURE_DIR="$PWD/.tmp/sandbox/nos-hub-tablet-serif-fixtures/sanity"
export SANITY_FIXTURE_LOGDIR="$FIX_LOG"
export NODE_OPTIONS="${NODE_OPTIONS:-} --require \"$PWD/$SPEC/checks/block-sanity-net.cjs\""
pnpm --dir "$DIR" build
node "$SPEC/checks/check-fixture-misses.mjs" "$FIX_LOG"
unset NODE_OPTIONS
echo "$SHA" > "$DIR/.build-sha"
node "$SPEC/checks/capture-main-baseline.mjs"
echo "$CAPTURE_STAMP" > "$DIR/.baseline-stamp"
