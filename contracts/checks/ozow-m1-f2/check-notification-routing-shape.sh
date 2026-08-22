#!/usr/bin/env bash
# A5/A6 — TWO DEDICATED ROUTES SHARING ONE HELPER, NOT ONE ROUTE BRANCHING ON A HINT. The
# architect spec (§2, point 4) rejected a single shared route resolved by query param/path segment
# ("/api/tickets/itn?provider=ozow" or "/api/tickets/itn/[provider]") because trusting a URL
# segment as a routing hint makes "provider unknown" a THIRD reachable state; two routes, each
# hardcoded to exactly one provider, make that state structurally impossible. This check proves
# the STRUCTURE the spec actually demands, not just that some refactor happened:
#   (a) PayFast's route stays at its EXACT current path — app/api/tickets/itn/route.ts — never
#       renamed/moved (its NotifyUrl is already registered with Ozow's — sorry, PayFast's — real
#       sandbox account; moving it breaks in-flight reservations, same reasoning
#       payment-seam-f2's own A1 gave for never renaming /api/tickets/itn).
#   (b) A new app/api/tickets/ozow-itn/route.ts exists, exporting POST.
#   (c) lib/tickets-notification.ts exists and exports ONE shared handler both routes import —
#       not two independently-written copies (which is exactly the risk the spec's own rejected
#       alternative and A4/A5's PayFast-regression concern are both about).
#   (d) BOTH route files import that SAME symbol from that SAME module path.
#   (e) Each route calls the shared helper with a DIFFERENT, single, hardcoded provider argument —
#       app/api/tickets/itn/route.ts must reference payfast's provider and must NOT reference
#       ozow's; ozow-itn/route.ts the reverse. A route naming both providers is the branching
#       shape this decision explicitly rejected.
#   (f) EACH route file's own body (imports + JSDoc stripped, blank lines stripped) is THIN — at
#       most 15 lines — proving it is a pass-through, not a second copy of the 11-step logic.
#   (g) No query-param or dynamic-segment provider routing survives anywhere under
#       app/api/tickets/ (grep for `searchParams.get(` mentioning 'provider', or a `[provider]`
#       directory segment) — the rejected alternative left with zero footprint.
#
# Run as: bash contracts/checks/ozow-m1-f2/check-notification-routing-shape.sh

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

FAIL=0
fail() { echo "FAIL: $1"; FAIL=1; }

PAYFAST_ROUTE="app/api/tickets/itn/route.ts"
OZOW_ROUTE="app/api/tickets/ozow-itn/route.ts"
HELPER="lib/tickets-notification.ts"

[ -f "$PAYFAST_ROUTE" ] || fail "(a) $PAYFAST_ROUTE does not exist — PayFast's route path must be unchanged"
[ -f "$OZOW_ROUTE" ] || fail "(b) $OZOW_ROUTE does not exist — the new dedicated Ozow route is missing"
[ -f "$HELPER" ] || fail "(c) $HELPER does not exist — no extracted shared helper"

if [ -f "$HELPER" ]; then
  HELPER_SYMBOL=$(grep -oE 'export (async )?function [A-Za-z0-9_]+' "$HELPER" | head -1 | awk '{print $NF}')
  if [ -z "${HELPER_SYMBOL:-}" ]; then
    fail "(c) $HELPER exports no named function — cannot identify the shared handler symbol"
  fi
fi

if [ -f "$PAYFAST_ROUTE" ] && [ -f "$OZOW_ROUTE" ] && [ -n "${HELPER_SYMBOL:-}" ]; then
  grep -q "$HELPER_SYMBOL" "$PAYFAST_ROUTE" \
    && grep -qE "from ['\"]@?/?lib/tickets-notification['\"]|from ['\"]\.\./\.\./\.\./\.\./lib/tickets-notification['\"]" "$PAYFAST_ROUTE" \
    || fail "(d) $PAYFAST_ROUTE does not import $HELPER_SYMBOL from $HELPER"
  grep -q "$HELPER_SYMBOL" "$OZOW_ROUTE" \
    && grep -qE "from ['\"]@?/?lib/tickets-notification['\"]|from ['\"]\.\./\.\./\.\./\.\./lib/tickets-notification['\"]" "$OZOW_ROUTE" \
    || fail "(d) $OZOW_ROUTE does not import $HELPER_SYMBOL from $HELPER"

  # (e) each route names exactly one provider, never both.
  payfast_hits=$(grep -icE 'payfastProvider|paymentProviders\.payfast|resolveProvider\(.payfast.\)' "$PAYFAST_ROUTE" || true)
  ozow_hits_in_payfast=$(grep -icE 'ozowProvider|paymentProviders\.ozow|resolveProvider\(.ozow.\)' "$PAYFAST_ROUTE" || true)
  [ "${payfast_hits:-0}" -ge 1 ] || fail "(e) $PAYFAST_ROUTE never references the payfast provider"
  [ "${ozow_hits_in_payfast:-0}" -eq 0 ] || fail "(e) $PAYFAST_ROUTE also references the ozow provider — branching shape"

  ozow_hits=$(grep -icE 'ozowProvider|paymentProviders\.ozow|resolveProvider\(.ozow.\)' "$OZOW_ROUTE" || true)
  payfast_hits_in_ozow=$(grep -icE 'payfastProvider|paymentProviders\.payfast|resolveProvider\(.payfast.\)' "$OZOW_ROUTE" || true)
  [ "${ozow_hits:-0}" -ge 1 ] || fail "(e) $OZOW_ROUTE never references the ozow provider"
  [ "${payfast_hits_in_ozow:-0}" -eq 0 ] || fail "(e) $OZOW_ROUTE also references the payfast provider — branching shape"

  # (f) thin route bodies: strip block/line comments and blank lines, count what's left.
  for route in "$PAYFAST_ROUTE" "$OZOW_ROUTE"; do
    body_lines=$(sed -E 's#//.*$##' "$route" | sed '/^\s*\*/d; /^\s*\/\*/d' | grep -cve '^\s*$')
    if [ "$body_lines" -gt 40 ]; then
      fail "(f) $route has $body_lines non-blank/non-comment lines (>40) — looks like a reimplementation, not a thin pass-through"
    fi
  done
fi

# (g) the rejected query-param/dynamic-segment routing shape must have zero footprint.
if grep -rInE "searchParams\.get\(['\"]provider['\"]\)" app/api/tickets/ 2>/dev/null; then
  fail "(g) query-param provider routing found under app/api/tickets/ (rejected shape)"
fi
if find app/api/tickets -type d -iname '\[provider\]' | grep -q .; then
  fail "(g) a [provider] dynamic route segment exists under app/api/tickets/ (rejected shape)"
fi

if [ "$FAIL" -ne 0 ]; then
  echo "OVERALL: FAIL"
  exit 1
fi
echo "OVERALL: PASS — two dedicated notification routes sharing one helper, no branching-on-hint shape."
