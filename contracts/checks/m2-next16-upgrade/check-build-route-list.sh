#!/usr/bin/env bash
# Proves all filesystem routes (page.tsx/route.ts under app/) actually made
# it into the production build output — a check against `pnpm build`'s own
# route manifest printout, matched EXACTLY, not by substring. Derives the
# expected route list live from the app/ tree rather than hardcoding a
# count that silently drifts as pages are added or removed.
#
# A prior version used `grep -qF "$route" "$LOG"` — a substring match.
# @qa falsified it (2026-07-29): deleting the manifest's root `/` line
# still passed, because every route line contains "/"; deleting the
# `/societies` parent line still passed via the `/societies/[slug]` child
# line containing it as a substring. Fixed by extracting the manifest's
# route TOKENS onto their own lines (stripping the box-drawing tree
# prefix and the ○/●/ƒ glyph) and comparing with `grep -xF` (whole-line,
# fixed-string) instead of a substring search — bracket characters in
# dynamic segments like [slug] or [[...tool]] are matched literally, no
# regex escaping needed, because -F treats the pattern as a literal
# string, not a regex.
#
# MUST run only when no dev server is bound to port 3333/3002 — shares
# .next with the dev server and a concurrent build corrupts its manifest.
# Caller (the contract) sequences this before server-ctl.sh start and
# never after it without an intervening stop.
#
# Usage:
#   check-build-route-list.sh              — runs a real `pnpm build`, checks it
#   check-build-route-list.sh --check-log <path>  — self-test mode: skips the
#     build and runs the same exact-match logic against an arbitrary log file
#     (e.g. a deliberately tampered copy, to prove the check can actually
#     fail). Never used by the contract; exists so this check's own
#     correctness is independently re-verifiable without paying for a build.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

check_routes_against_log() {
  # $1 = path to a build log (real or, for self-test, a tampered copy)
  local log="$1"
  local manifest
  manifest=$(mktemp)
  # Route-manifest lines look like "┌ ○ /", "├ ƒ /api/admin/checkin",
  # "└ ○ /terms" — a box-drawing tree prefix, one of Next's route-type
  # glyphs (○ static, ● SSG/generateStaticParams, ƒ server-rendered), then
  # the route path. "[+N more paths]" child-collapse lines carry none of
  # those glyphs and are correctly excluded by requiring one in the match,
  # not by accident of substring luck.
  grep -E '^[│├└┌ ]*[○●ƒ] ' "$log" \
    | sed -E 's/^[│├└┌ ]*[○●ƒ] +//' \
    | awk '{print $1}' > "$manifest"

  local fail=0
  while IFS= read -r f; do
    # app/(marketing)/about/page.tsx -> /about ; app/(marketing)/page.tsx -> /
    # app/api/tickets/checkout/route.ts -> /api/tickets/checkout
    local route
    route=$(echo "$f" | sed -E 's#^app##; s#/\(marketing\)##; s#/page\.tsx$##; s#/route\.ts$##')
    [ -z "$route" ] && route="/"
    # grep -x = whole-line match, -F = fixed string (no regex metachar
    # interpretation of [slug]/[[...tool]]) — exact match, not substring.
    if ! grep -qxF "$route" "$manifest"; then
      echo "MISSING from build output: $route (source: $f)"
      fail=1
    fi
  done < <(find app -name "page.tsx" -o -name "route.ts")

  rm -f "$manifest"
  return $fail
}

if [ "${1:-}" = "--check-log" ]; then
  LOG="${2:?usage: check-build-route-list.sh --check-log <path>}"
  if check_routes_against_log "$LOG"; then
    echo "PASS: all filesystem routes present in $LOG (exact match against the route manifest, not a substring search)"
    exit 0
  else
    exit 1
  fi
fi

LOG=/tmp/saoc-m2-build.log
lsof -ti:3333 -ti:3002 | xargs -r kill -9 2>/dev/null || true
pnpm build >"$LOG" 2>&1
CODE=$?
if [ "$CODE" -ne 0 ]; then
  echo "pnpm build failed (exit $CODE)"
  cat "$LOG"
  exit 1
fi

if check_routes_against_log "$LOG"; then
  echo "PASS: all filesystem routes present in build output (exact match against the route manifest, not a substring search)"
else
  exit 1
fi
