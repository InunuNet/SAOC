#!/usr/bin/env bash
# Production build for the saoc-pagehero-mirror gates, with CI's public env (scripts/ci-e2e.sh's workflow, .github/workflows/ci.yml:
# NEXT_PUBLIC_SANITY_DATASET=production; the project id is public). The site URLs point at the local gate port.
# BETA_PASSWORD_WALL_OFF and SITE_PUBLIC_LAUNCH are deliberately left unset.
set -euo pipefail
PORT="${SAOC_PAGEHERO_PORT:-3081}"
export NEXT_PUBLIC_SANITY_PROJECT_ID="${NEXT_PUBLIC_SANITY_PROJECT_ID:-26yfbug4}"
export NEXT_PUBLIC_SANITY_DATASET="${NEXT_PUBLIC_SANITY_DATASET:-production}"
export NEXT_PUBLIC_NOS_SITE_URL="http://nos.localhost:${PORT}"
export NEXT_PUBLIC_SAOC_SITE_URL="http://saoc.localhost:${PORT}"
unset BETA_PASSWORD_WALL_OFF
unset SITE_PUBLIC_LAUNCH
exec pnpm build
