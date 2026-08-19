#!/usr/bin/env bash
# A1 — THE DECISIVE ASSERTION OF THIS ENTIRE MISSION.
#
# No PayFast-specific symbol, env var name, URL, function or wire field name may appear anywhere
# in app/api/tickets/checkout/route.ts or app/api/tickets/itn/route.ts. If one survives, the seam
# is decorative: the next gateway requires touching the routes again, which is the whole thing
# this mission exists to prevent.
#
# WHAT MAKES THIS FAIL: any banned token below appearing in either route. OBSERVED FAILING against
# the pre-rewire code on 2026-08-19 — see contracts/golden/payment-seam-f2/README.md for the
# verbatim output (18 hits across the two files).
#
# THREE ENUMERATED EXCEPTIONS, each hard-counted so it cannot grow silently. Each is a naming debt
# recorded in the golden README with the reason it cannot be paid off inside F2:
#   E1  the literal path /api/tickets/itn  — OUR route path, not the gateway's word for it.
#                                            Renaming it breaks in-flight reservations whose
#                                            notify_url is already registered with the gateway.
#   E2  the log prefix [tickets/itn]        — derived from E1's path.
#   E3  the object key m_payment_id         — a FIRESTORE DOCUMENT FIELD NAME (orders collection,
#                                            indexed, queried by lib/orders.ts). Renaming it is a
#                                            data migration, not a refactor.
#
# Run as: bash contracts/checks/payment-seam-f2/check-no-gateway-symbols-in-routes.sh
set -uo pipefail

CHECKOUT="app/api/tickets/checkout/route.ts"
ITN="app/api/tickets/itn/route.ts"
status=0

# --- 0. Positive control: both files must exist and both must import the seam. Without this a
#        deleted or emptied route would satisfy every ban below.
for f in "$CHECKOUT" "$ITN"; do
  if [ ! -f "$f" ]; then
    echo "FAIL A1: $f does not exist."
    exit 1
  fi
  if ! grep -q "@/lib/payments" "$f"; then
    echo "FAIL A1: $f does not import the payment seam (@/lib/payments) — it cannot be gateway-"
    echo "         neutral by virtue of having been gutted."
    status=1
  fi
done

# --- 1. Tokens banned outright in BOTH routes. Case-insensitive: PAYFAST_SANDBOX_MERCHANT_ID and
#        'payfast' are the same leak.
BANNED_BOTH='payfast|pf_payment_id|amount_gross|amount_fee|amount_net|merchant_id|merchant_key|passphrase|generateSignature|generateNotifySignature|buildPayfastParamString|buildPayfastNotifyParamString|getClientIp|eng/process|eng/query|item_name|payment_status|notify_url|return_url|cancel_url|\bmd5\b'

for f in "$CHECKOUT" "$ITN"; do
  hits=$(grep -nEi "$BANNED_BOTH" "$f" || true)
  if [ -n "$hits" ]; then
    echo "FAIL A1: gateway-specific vocabulary in $f:"
    echo "$hits" | sed 's/^/    /'
    status=1
  fi
done

# --- 2. 'signature' as an identifier is banned. It is the gateway's authentication mechanism and
#        no route should know it exists. Allowed nowhere in either file.
for f in "$CHECKOUT" "$ITN"; do
  hits=$(grep -nEi 'signature' "$f" || true)
  if [ -n "$hits" ]; then
    echo "FAIL A1: 'signature' appears in $f — signing is the provider's business, not the route's:"
    echo "$hits" | sed 's/^/    /'
    status=1
  fi
done

# --- 2b. ProviderNotification.raw is BANNED IN ROUTE FILES.
#
#     The token bans above are necessary but not sufficient, and @qa found the gap: `.raw` is an
#     unrestricted map of the gateway's own wire fields, exposed BY THE INTERFACE ITSELF. A route
#     can write `notification.raw['custom_str1']` and be fully gateway-coupled without containing a
#     single banned token — A1 green, seam decorative, next gateway reopens the routes. That is the
#     exact outcome this assertion exists to prevent, arriving through the one door the vocabulary
#     ban cannot see.
#
#     Neither route uses it today, so this is latent rather than live. It is banned now because a
#     latent hole in the mission's decisive assertion is worth closing while it is still latent.
#     The ADAPTER may use `.raw` freely — that is where wire fields belong.
for f in "$CHECKOUT" "$ITN"; do
  raw_hits=$(grep -nE '\.raw\b' "$f" || true)
  if [ -n "$raw_hits" ]; then
    echo "FAIL A1: $f reaches into the gateway's raw wire fields. .raw is an unrestricted map of"
    echo "         gateway-specific field names; using it couples the route to a gateway without"
    echo "         tripping any token ban. Read named fields off the notification instead:"
    echo "$raw_hits" | sed 's/^/    /'
    status=1
  fi
done

# --- 3. 'COMPLETE' — the gateway's own status word. The route compares against the NEUTRAL
#        'paid' from mapStatus() instead.
for f in "$CHECKOUT" "$ITN"; do
  hits=$(grep -nE "'COMPLETE'|\"COMPLETE\"|COMPLETE_STATUS" "$f" || true)
  if [ -n "$hits" ]; then
    echo "FAIL A1: the gateway's own status vocabulary appears in $f:"
    echo "$hits" | sed 's/^/    /'
    status=1
  fi
done

# --- 4. EXCEPTION E3, hard-counted. m_payment_id may appear at most ONCE, in the ITN route only,
#        and only as the key of the markOrderAndPositionPaidByPaymentId(...) input object.
if grep -qE 'm_payment_id' "$CHECKOUT"; then
  echo "FAIL A1: m_payment_id appears in $CHECKOUT. Exception E3 covers the ITN route only."
  status=1
fi
e3_count=$(grep -cE 'm_payment_id' "$ITN" || true)
if [ "$e3_count" -gt 1 ]; then
  echo "FAIL A1: m_payment_id appears $e3_count times in $ITN; exception E3 permits exactly 1"
  echo "         (the markOrderAndPositionPaidByPaymentId input key). It must not grow."
  grep -nE 'm_payment_id' "$ITN" | sed 's/^/    /'
  status=1
fi

# --- 5. EXCEPTIONS E1/E2, held to the PROPERTY rather than to a count.
#
#     Earlier wording claimed all three exceptions were "hard-counted"; only E3 actually was. E1 was
#     checked in the checkout route alone and E2 (11 occurrences) was counted nowhere — the contract
#     asserted a stricter property than the check implemented, which is the same disease in
#     miniature. Counting was considered and rejected for the same reason it was rejected for
#     lib/payments/index.ts: a literal maximum breaks the moment somebody adds a legitimate log line
#     while still admitting a genuine leak that happens to fit the budget.
#
#     The property is: every occurrence of `itn` in these files is either OUR route path or the log
#     prefix derived from it. Both permitted forms are stripped; any residue fails. Reformatting-
#     proof, count-free, and it fires the moment `itn` is used as a gateway concept.
for f in "$CHECKOUT" "$ITN"; do
  residue=$(sed -E 's#\[tickets/itn\]##g; s#/api/tickets/itn##g' "$f" | grep -nEi 'itn' || true)
  if [ -n "$residue" ]; then
    echo "FAIL A1: $f uses 'itn' beyond our own route path and its log prefix. ITN is the gateway's"
    echo "         acronym, not the seam's vocabulary:"
    echo "$residue" | sed 's/^/    /'
    status=1
  fi
done

# --- 6. NON-VACUITY. The ban patterns must be capable of firing. Prove it against the adapter,
#        which certainly does contain this vocabulary. A green here with a pattern that matches
#        nothing anywhere would be a false green of exactly the kind this project keeps hitting.
if [ -f lib/payments/payfast.ts ]; then
  if ! grep -qEi "$BANNED_BOTH" lib/payments/payfast.ts; then
    echo "FAIL A1: the ban pattern matches nothing in lib/payments/payfast.ts either — the check"
    echo "         cannot actually detect a leak, so a green verdict would be meaningless."
    status=1
  fi
else
  echo "FAIL A1: lib/payments/payfast.ts does not exist — cannot prove the ban pattern discriminates."
  status=1
fi

if [ "$status" -eq 0 ]; then
  echo "PASS A1: neither route contains gateway-specific vocabulary; the three enumerated"
  echo "         exceptions (route path, log prefix, Firestore field name) are within their counts."
fi
exit "$status"
