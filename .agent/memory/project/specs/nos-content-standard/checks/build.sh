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
unset BETA_PASSWORD_WALL_OFF
[ -n "$NEXT_PUBLIC_SANITY_PROJECT_ID" ] && [ -n "$NEXT_PUBLIC_SANITY_DATASET" ] || { echo "could not read Sanity ids from apphosting.yaml" >&2; exit 1; }
exec pnpm build
