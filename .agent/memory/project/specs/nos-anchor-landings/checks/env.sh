# Sourced by build.sh and serve.sh. Replay-only Sanity, NOS site URL at the gate port, no wall, no network allowance.
PORT="${NOS_ANCHOR_PORT:-3961}"
yaml_value() { grep -A1 "variable: $1\$" apphosting.yaml | grep 'value:' | head -1 | sed -E 's/.*value: *"([^"]*)".*/\1/'; }
export NEXT_PUBLIC_SANITY_PROJECT_ID="$(yaml_value NEXT_PUBLIC_SANITY_PROJECT_ID)"
export NEXT_PUBLIC_SANITY_DATASET="$(yaml_value NEXT_PUBLIC_SANITY_DATASET)"
[ -n "$NEXT_PUBLIC_SANITY_PROJECT_ID" ] && [ -n "$NEXT_PUBLIC_SANITY_DATASET" ] || { echo "could not read Sanity ids from apphosting.yaml" >&2; exit 1; }
export NEXT_PUBLIC_NOS_SITE_URL="http://nos.localhost:${PORT}"
export NEXT_PUBLIC_SAOC_SITE_URL="http://saoc.localhost:${PORT}"
export SITE_URL="http://nos.localhost:${PORT}"
export BETA_PASSWORD_WALL_OFF=true
unset SITE_PUBLIC_LAUNCH K_SERVICE SANITY_NET_ALLOW SANITY_FIXTURE_RECORD_CONFIRM
export SANITY_FIXTURE_MODE=replay
export SANITY_FIXTURE_DIR="$PWD/.agent/memory/project/specs/nos-content-standard/fixtures/sanity"
