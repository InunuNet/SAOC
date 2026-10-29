#!/usr/bin/env bash
# Production build for the contract-f2 gates. Same public env as checks/build.sh, with ONE difference: no Sanity fixture at build time.
# On 9b8a1e63 the recorded fixture (nos-content-standard/fixtures/sanity) has no entry for the current societyEvent slugs query
# (*[_type == "societyEvent" ...]{ "slug", "updatedAt" }), so a replay build fails closed in generateStaticParams for /events/[slug]
# ("Failed to collect page data"). The build therefore reads Sanity (GET only, public dataset); the RUNTIME gates still serve under
# SANITY_FIXTURE_MODE=replay (checks/_lib.mjs). Refreshing the fixture would remove this exception; that is the fixture owner's call.
set -euo pipefail
PORT="${SAOC_PAGEHERO_PORT:-3081}"
export NEXT_PUBLIC_SANITY_PROJECT_ID="${NEXT_PUBLIC_SANITY_PROJECT_ID:-26yfbug4}"
export NEXT_PUBLIC_SANITY_DATASET="${NEXT_PUBLIC_SANITY_DATASET:-production}"
export NEXT_PUBLIC_NOS_SITE_URL="http://nos.localhost:${PORT}"
export NEXT_PUBLIC_SAOC_SITE_URL="http://saoc.localhost:${PORT}"
export BETA_PASSWORD_WALL_OFF=true
unset SANITY_FIXTURE_MODE
unset SANITY_FIXTURE_DIR
unset SITE_PUBLIC_LAUNCH
exec pnpm build
