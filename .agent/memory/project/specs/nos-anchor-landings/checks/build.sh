#!/usr/bin/env bash
# Production build on Sanity fixture replay (tracked nos-content-standard capture, read-only), Sanity API blocked for the build process.
set -euo pipefail
. .agent/memory/project/specs/nos-anchor-landings/checks/env.sh
# Turbopack kept serving a stale globals.css from .next/cache in a reused worktree (observed while writing this spec): refuse to build over a .next older than any CSS source.
if [ -f .next/BUILD_ID ] && [ -n "$(find app components -name '*.css' -newer .next/BUILD_ID 2>/dev/null | head -1)" ]; then
  echo "stale .next: a CSS source is newer than the last build. Remove .next (python3 execution/safe_delete.py .next from inside .tmp/sandbox) and rebuild." >&2; exit 1
fi
FIX_LOG="$PWD/.tmp/sandbox/nos-anchor-landings-run/fixture-logs"
mkdir -p "$FIX_LOG"
for f in _started.log _hits.log _misses.log _requests.log _net.log _assets.log; do : > "$FIX_LOG/$f"; done
export SANITY_FIXTURE_LOGDIR="$FIX_LOG"
export NODE_OPTIONS="${NODE_OPTIONS:-} --require \"$PWD/.agent/memory/project/specs/nos-content-standard/checks/block-sanity-net.cjs\""
pnpm build
[ ! -s "$FIX_LOG/_net.log" ] || { echo "build made a Sanity API request:" >&2; cat "$FIX_LOG/_net.log" >&2; exit 1; }
[ ! -s "$FIX_LOG/_misses.log" ] || { echo "build hit a fixture miss:" >&2; cat "$FIX_LOG/_misses.log" >&2; exit 1; }
echo "build ok"
