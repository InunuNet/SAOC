#!/usr/bin/env bash
# Production build for the nos-content-standard gates. Sanity ids come from apphosting.yaml; the site URLs point at the local gate port.
# BETA_PASSWORD_WALL_OFF is deliberately left unset.
set -euo pipefail
# The site URLs baked into the build must be the port gate-standard serves on (BASE_PORT + offset 1 in _lib.mjs), or the retired-route redirect leaves the gate origin.
PORT="$(( ${NOS_STD_PORT:-3091} + 1 ))"
yaml_value() { grep -A1 "variable: $1\$" apphosting.yaml | grep 'value:' | head -1 | sed -E 's/.*value: *"([^"]*)".*/\1/'; }
export NEXT_PUBLIC_SANITY_PROJECT_ID="$(yaml_value NEXT_PUBLIC_SANITY_PROJECT_ID)"
export NEXT_PUBLIC_SANITY_DATASET="$(yaml_value NEXT_PUBLIC_SANITY_DATASET)"
export NEXT_PUBLIC_NOS_SITE_URL="http://nos.localhost:${PORT}"
export NEXT_PUBLIC_SAOC_SITE_URL="http://saoc.localhost:${PORT}"
# Same override set as _lib.mjs startServer: NEXT_PUBLIC_*URL is inlined at build time, so every such variable the environment or the dotenv files define
# must name the gate origin (SAOC-named ones the saoc origin). Firebase and Sanity ones are left alone.
# Missing dotenv files are normal (a fresh checkout has none): read only the ones that exist, and let an empty match through under pipefail.
dotenv_names() { for f in .env .env.local .env.production .env.production.local; do [ -f "$f" ] && sed -nE 's/^[[:space:]]*(NEXT_PUBLIC_[A-Z0-9_]*URL)[[:space:]]*=.*/\1/p' "$f"; done; return 0; }
URL_KEYS="$( { env | cut -d= -f1; dotenv_names; } | { grep -E '^NEXT_PUBLIC_.*URL$' || true; } | { grep -vE '^NEXT_PUBLIC_(FIREBASE|SANITY)' || true; } | sort -u )"
for k in $URL_KEYS; do case "$k" in *SAOC*) export "$k=http://saoc.localhost:${PORT}" ;; *) export "$k=http://nos.localhost:${PORT}" ;; esac; done
export SITE_URL="http://nos.localhost:${PORT}"
unset BETA_PASSWORD_WALL_OFF
[ -n "$NEXT_PUBLIC_SANITY_PROJECT_ID" ] && [ -n "$NEXT_PUBLIC_SANITY_DATASET" ] || { echo "could not read Sanity ids from apphosting.yaml" >&2; exit 1; }
# Sanity fixture (rev 43B): `next build` prerenders and reads Sanity too, so the build also reads the captured fixture and makes no Sanity API request.
# NOS_STD_FIXTURE: unset/replay = replay (default), record = capture through the API host, live = no fixture. A miss or a blocked request fails the build.
unset K_SERVICE
FIX_MODE="${NOS_STD_FIXTURE:-replay}"
SPEC_DIR=".agent/memory/project/specs/nos-content-standard"
if [ "$FIX_MODE" != "live" ]; then
  FIX_LOG="$PWD/.tmp/sandbox/nos-content-standard-gate/fixture-logs-build"
  mkdir -p "$FIX_LOG"
  for f in _started.log _hits.log _misses.log _requests.log _net.log _assets.log; do : > "$FIX_LOG/$f"; done
  export SANITY_FIXTURE_DIR="$PWD/$SPEC_DIR/fixtures/sanity"
  export SANITY_FIXTURE_LOGDIR="$FIX_LOG"
  export NODE_OPTIONS="${NODE_OPTIONS:-} --require \"$PWD/$SPEC_DIR/checks/block-sanity-net.cjs\""
  if [ "$FIX_MODE" = "record" ]; then export SANITY_FIXTURE_MODE=record SANITY_NET_ALLOW=api SANITY_FIXTURE_RECORD_CONFIRM=1; else export SANITY_FIXTURE_MODE=replay; fi
fi
pnpm build
if [ "$FIX_MODE" != "live" ]; then
  [ ! -s "$FIX_LOG/_net.log" ] || { echo "build made a Sanity API request while the fixture was in use:" >&2; cat "$FIX_LOG/_net.log" >&2; exit 1; }
  if [ "$FIX_MODE" = "replay" ] && [ -s "$FIX_LOG/_misses.log" ]; then echo "build hit a fixture miss (re-capture with NOS_STD_FIXTURE=record):" >&2; cat "$FIX_LOG/_misses.log" >&2; exit 1; fi
fi
