#!/usr/bin/env bash
# A15 — amount-string-to-cents PARSING lives in the adapter; the route only compares integers.
#
# BACKSTORY. Codex's underpayment fix (parseAmountToCents) landed correctly but landed INSIDE
# app/api/tickets/itn/route.ts, with a doc comment saying why it was safe: "PayFast always sends
# amount_gross in that exact shape." A1 caught it (payfast/amount_gross hits in a route comment).
# The reasoned fix — not a reworded comment — is architectural: converting the gateway's own
# decimal-string convention into a gateway-neutral integer-cents number is a FORMAT TRANSLATION,
# the same category of work mapStatus already does for the gateway's status vocabulary; it moves
# to the adapter. Deciding whether the resulting number is CLOSE ENOUGH to the stored order amount
# — the tolerance comparison and the accept/reject judgement — is ours and stays in the route. See
# contracts/golden/payment-seam-f1/interface.golden.md, "`grossAmountCents` — the seventh field,
# and why".
#
# WHAT MAKES THIS FAIL:
#   1. The ITN route defines its own decimal-string-to-cents parser (a function name matching
#      *AmountToCents*/*ParseAmount*, or a bare decimal-parsing regex literal) instead of reading
#      grossAmountCents off the notification the adapter already produced.
#   2. The ITN route never reads notification.grossAmountCents at all — i.e. the seventh field
#      was added to the interface but nothing calls it, so the route is still comparing something
#      else (or nothing).
#   3. lib/payments/payfast.ts does NOT contain a decimal-string-to-cents parser — i.e. the logic
#      was deleted rather than moved (non-vacuity: this check must prove the parser exists
#      SOMEWHERE, not just that it is absent from the route).
#
# Run as: bash contracts/checks/payment-seam-f2/check-amount-normalized-in-adapter.sh
set -uo pipefail

ITN="app/api/tickets/itn/route.ts"
ADAPTER="lib/payments/payfast.ts"
status=0

if [ ! -f "$ITN" ]; then
  echo "FAIL A15: $ITN does not exist."
  exit 1
fi

# --- 1. No local amount-string parser in the route.
parser_hits=$(grep -nEi 'AmountToCents|ParseAmount' "$ITN" || true)
if [ -n "$parser_hits" ]; then
  echo "FAIL A15: $ITN defines or names its own amount-string-to-cents parser. That parsing is a"
  echo "          gateway wire-format translation and belongs in the adapter (lib/payments/payfast.ts),"
  echo "          not the route:"
  echo "$parser_hits" | sed 's/^/    /'
  status=1
fi

# A bare decimal-parsing regex literal (the shape parseAmountToCents used) is the same defect even
# if it isn't given a AmountToCents/ParseAmount name — a regex over \d{1,2} fraction digits is
# itself PayFast-shaped wire-format knowledge.
regex_hits=$(grep -nE '\\d\{1,2\}' "$ITN" || true)
if [ -n "$regex_hits" ]; then
  echo "FAIL A15: $ITN contains a fraction-digit-counting regex — the wire-format assumption this"
  echo "          assertion exists to keep out of route code, however it is named:"
  echo "$regex_hits" | sed 's/^/    /'
  status=1
fi

# --- 2. The route must actually read grossAmountCents off the notification.
if ! grep -qE 'grossAmountCents' "$ITN"; then
  echo "FAIL A15: $ITN never reads notification.grossAmountCents. Either the seventh interface"
  echo "          field was never wired up, or the route is still comparing something else."
  status=1
fi

# --- 3. Non-vacuity: the parser must actually exist in the adapter, not have been deleted.
if [ -f "$ADAPTER" ]; then
  if ! grep -qEi 'AmountToCents|ParseAmount' "$ADAPTER"; then
    echo "FAIL A15: no amount-string-to-cents parser found in $ADAPTER either — the logic appears"
    echo "          to have been deleted rather than moved. A green A15 must mean 'relocated', never"
    echo "          'the underpayment fix silently regressed'."
    status=1
  fi
else
  echo "FAIL A15: $ADAPTER does not exist — cannot prove the parser was moved rather than lost."
  status=1
fi

if [ "$status" -eq 0 ]; then
  echo "PASS A15: the ITN route reads grossAmountCents from the notification and defines no local"
  echo "          amount-string parser; the parser lives in the adapter, proven present there."
fi
exit "$status"
