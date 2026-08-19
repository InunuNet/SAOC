#!/usr/bin/env bash
# A5 — THE DOWNSTREAM REPOINTS. Rewiring the routes breaks four artefacts in OTHER contracts that
# depend on gateway internals living inside app/api/tickets/itn/route.ts. They are enumerated here
# so they are repointed deliberately, as part of F2, rather than discovered as red gates afterwards.
#
#   R1  contracts/checks/ticketing-f10-itn-repin/check-signature-brutal.mjs
#   R2  contracts/checks/ticketing-f10-itn-repin/check-break-fix-field-order.mjs
#   R3  contracts/checks/ticketing-f10-itn-repin/fixtures/itn-repin-typecheck.ts
#         All three import parseOrderedFields FROM THE ROUTE. That function is the gateway's own
#         inbound body parse and belongs in the adapter, so F2 moves it to lib/payments/payfast.ts
#         (exported, same signature) and repoints all three imports. F10's own A2/A3/A4 keep
#         asserting exactly what they asserted before, against the same function in its new home.
#
#   R4  contracts/checks/payfast-m1/check-server-confirm-fetch-outside-transaction-scope.mjs (A32)
#         Requires a literal fetch(PAYFAST_SANDBOX_VALIDATE_URL, ...) in the route source, which
#         F2 necessarily removes. Its INTENT — the network round-trip is not inside the Firestore
#         transaction — is preserved by repointing claim 1 to the paymentProvider.confirmNotification
#         call site, keeping the lib/orders.ts claim untouched, and adding the structural fact that
#         makes the whole class impossible: the adapter has no Firestore access at all (part 3).
#
# WHAT MAKES THIS FAIL: parseOrderedFields not exported from the adapter; any of the three F10
# artefacts still importing it from the route; the adapter importing Firestore; any of the four
# repointed checks failing after the rewire.
#
# Run as: bash contracts/checks/payment-seam-f2/check-downstream-repoints.sh
set -uo pipefail

ADAPTER=lib/payments/payfast.ts
ROUTE_IMPORT_PATTERN="app/api/tickets/itn/route"
status=0
fail() { echo "FAIL A5: $*"; status=1; }

# --- Part 0: positive control. -----------------------------------------------------------------
[ -f "$ADAPTER" ] || { echo "FAIL A5: $ADAPTER does not exist — nothing has been repointed."; exit 1; }

# --- Part 1: parseOrderedFields lives in the adapter, exported. --------------------------------
grep -qE "export (function|const) parseOrderedFields" "$ADAPTER" \
  || fail "$ADAPTER does not export parseOrderedFields. F10's checks have nowhere to point."

# --- Part 2: no downstream artefact still imports it from the route. ---------------------------
F10_ARTEFACTS=(
  "contracts/checks/ticketing-f10-itn-repin/check-signature-brutal.mjs"
  "contracts/checks/ticketing-f10-itn-repin/check-break-fix-field-order.mjs"
  "contracts/checks/ticketing-f10-itn-repin/fixtures/itn-repin-typecheck.ts"
)
for a in "${F10_ARTEFACTS[@]}"; do
  [ -f "$a" ] || { fail "$a is missing."; continue; }
  if grep -qE "parseOrderedFields.*from.*${ROUTE_IMPORT_PATTERN}|from '.*${ROUTE_IMPORT_PATTERN}'" "$a"; then
    fail "$a still imports from the route:
$(grep -nE "${ROUTE_IMPORT_PATTERN}" "$a")"
  fi
  grep -q "lib/payments/payfast" "$a" \
    || fail "$a does not import from lib/payments/payfast — it was not repointed, merely edited."
done

# --- Part 3: the adapter cannot possibly hold a Firestore transaction. -------------------------
# This is the structural fact that retires A32's whole defect class rather than relocating it: the
# server-confirm network call lives in a module that has no database access to wrap it in.
fsimports=$(grep -nE "firebase-admin|getFirestore|runTransaction|@/lib/orders" "$ADAPTER" || true)
[ -n "$fsimports" ] && fail "$ADAPTER touches Firestore. The server-confirm round-trip must live in a
         module that cannot open a transaction around it:
$fsimports"

# --- Part 4: re-run every repointed check. Not "we think they still work" — run them. -----------
REPOINTED=(
  "npx tsx contracts/checks/ticketing-f10-itn-repin/check-signature-brutal.mjs"
  "npx tsx contracts/checks/ticketing-f10-itn-repin/check-break-fix-field-order.mjs"
  "npx tsc --noEmit -p contracts/checks/ticketing-f10-itn-repin/tsconfig.typecheck.json"
  "npx tsx contracts/checks/payfast-m1/check-server-confirm-fetch-outside-transaction-scope.mjs"
)
for cmd in "${REPOINTED[@]}"; do
  if ! out=$($cmd 2>&1); then
    fail "repointed check failed: $cmd
$(echo "$out" | tail -12 | sed 's/^/         /')"
  else
    echo "  repointed check green: $cmd"
  fi
done

if [ "$status" -eq 0 ]; then
  echo "PASS A5: parseOrderedFields moved to the adapter and all three F10 artefacts repointed;"
  echo "         the adapter has no Firestore access; all four repointed checks are green."
fi
exit "$status"
