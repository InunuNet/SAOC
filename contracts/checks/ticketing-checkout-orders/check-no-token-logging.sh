#!/usr/bin/env bash
# ticketing-checkout-orders (architect contract) — no credential/token VALUE may reach gate output
# on pass or fail (dispatch hard constraint), extended here to source: neither the minted
# recoveryToken nor RECOVERY_TOKEN_SECRET may appear as an argument to any console.* call in the
# two files this contract touches. This is a static/source check, deliberately narrow — it proves
# no console.* CALL SITE references the token/secret-holding variables by name; it cannot prove a
# renamed variable that happens to hold the same value is also safe (see golden README's "What
# this contract does NOT prove").
#
# DEFEATING MUTATION this check kills: a debug `console.log('minted recovery token:', token)` (or
# `console.error(..., { recoveryTokenSecret })`) added during development and left in — exactly
# the class of defect lib/confirmation-email.ts's own header comment already warns against
# ("NEVER log recoveryToken's value... this project has a standing rule against logging secrets,
# four prior incidents").
#
# Run as: bash contracts/checks/ticketing-checkout-orders/check-no-token-logging.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
ROUTE_FILE="$REPO_ROOT/app/api/tickets/checkout/route.ts"
RESERVATION_FILE="$REPO_ROOT/lib/checkout-reservation.ts"

FAILED=0

check_file() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    echo "FAIL: $file does not exist."
    FAILED=1
    return
  fi

  # Every console.* call, with up to 4 following lines (covers multi-line calls/object literals),
  # searched for the token/secret variable names. A match means a console.* call's argument list
  # (or an object literal it spans into) mentions one of these names.
  local matches
  matches=$(grep -n -A4 'console\.\(log\|error\|warn\|info\|debug\)' "$file" \
    | grep -iE '\b(recoveryToken|recoveryTokenSecret)\b' || true)

  if [[ -n "$matches" ]]; then
    echo "FAIL: $file has a console.* call whose argument list mentions a token/secret variable:"
    echo "$matches" | sed 's/^/      /'
    FAILED=1
  fi
}

check_file "$ROUTE_FILE"
check_file "$RESERVATION_FILE"

if [[ "$FAILED" -ne 0 ]]; then
  exit 1
fi

echo "PASS: no console.* call in app/api/tickets/checkout/route.ts or lib/checkout-reservation.ts"
echo "      references the recoveryToken or recoveryTokenSecret variables by name."
exit 0
