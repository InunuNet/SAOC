#!/usr/bin/env bash
# Production build for the nos-footer-colour-logos gates: Sanity in replay (no live Sanity traffic, SANITY_NET_ALLOW unset).
# Sanity ids are the CI values (scripts/ci-e2e.sh, apphosting.yaml); site URLs point at the local gate port.
set -euo pipefail
PORT="${NOS_FCL_PORT:-3141}"
export SANITY_FIXTURE_MODE=replay
export SANITY_FIXTURE_DIR="${SANITY_FIXTURE_DIR:-$PWD/.agent/memory/project/specs/nos-content-standard/fixtures/sanity}"
unset SANITY_NET_ALLOW
export NEXT_PUBLIC_SANITY_PROJECT_ID=26yfbug4
export NEXT_PUBLIC_SANITY_DATASET=production
export NEXT_PUBLIC_NOS_SITE_URL="http://nos.localhost:${PORT}"
export NEXT_PUBLIC_SAOC_SITE_URL="http://saoc.localhost:${PORT}"
unset BETA_PASSWORD_WALL_OFF
unset SITE_PUBLIC_LAUNCH
exec pnpm build
