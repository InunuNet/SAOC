#!/usr/bin/env bash
# Production build for the nos-content-standard gates. Sanity ids come from apphosting.yaml; the site URLs point at the local gate port.
# BETA_PASSWORD_WALL_OFF is deliberately left unset.
set -euo pipefail
PORT="${NOS_STD_PORT:-3091}"
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
exec pnpm build
