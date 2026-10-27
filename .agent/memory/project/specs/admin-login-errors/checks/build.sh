#!/usr/bin/env bash
# Production build for the admin-login-errors gate. Sanity ids from apphosting.yaml; Firebase public config gets inert
# placeholders when unset (the gate mocks every Firebase call, so nothing real is contacted).
set -euo pipefail
yaml_value() { grep -A1 "variable: $1\$" apphosting.yaml | grep 'value:' | head -1 | sed -E 's/.*value: *"([^"]*)".*/\1/'; }
export NEXT_PUBLIC_SANITY_PROJECT_ID="${NEXT_PUBLIC_SANITY_PROJECT_ID:-$(yaml_value NEXT_PUBLIC_SANITY_PROJECT_ID)}"
export NEXT_PUBLIC_SANITY_DATASET="${NEXT_PUBLIC_SANITY_DATASET:-$(yaml_value NEXT_PUBLIC_SANITY_DATASET)}"
export NEXT_PUBLIC_FIREBASE_API_KEY="${NEXT_PUBLIC_FIREBASE_API_KEY:-gate-placeholder-key}"
export NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:-gate-placeholder.firebaseapp.com}"
export NEXT_PUBLIC_FIREBASE_PROJECT_ID="${NEXT_PUBLIC_FIREBASE_PROJECT_ID:-gate-placeholder}"
unset BETA_PASSWORD_WALL_OFF
[ -n "$NEXT_PUBLIC_SANITY_PROJECT_ID" ] && [ -n "$NEXT_PUBLIC_SANITY_DATASET" ] || { echo "could not read Sanity ids" >&2; exit 1; }
exec pnpm build
