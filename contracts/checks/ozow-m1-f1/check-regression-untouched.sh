#!/usr/bin/env bash
# A8 — THIS FEATURE IS ADDITIVE ONLY. Neither checkout route, the ITN route, nor any PayFast file
# is touched. Checkout wiring, provider-registry selection and the new ozow-itn route are ALL F2's
# job (per the mission's own milestone split — README.md, and matching how
# contract-payment-seam-f1.yaml A10 kept its own F1 additive for the identical reason: F3's live
# sandbox purchase gets ONE candidate cause if it regresses, not two). sha256 pins taken from the
# working tree on 2026-08-22, before any Ozow code was written.
#
# WHAT MAKES THIS FAIL: @dev touching checkout/ITN routing inside this feature (silently becoming
# F1+F2); any edit to lib/payments/types.ts (the interface holds unchanged per the architect
# spec's own walkthrough — editing it here would mean the spec's central claim was wrong and
# nobody flagged it); any edit to lib/payments/index.ts, lib/payments/payfast.ts or lib/payfast.ts.
#
# Run as: bash contracts/checks/ozow-m1-f1/check-regression-untouched.sh
set -uo pipefail

EXPECTED_INDEX="5529c2407f192e599c21943b29123e1e354e7e96aa8a17b1214380900404de02"
EXPECTED_TYPES="3d72fe895768527f2b0e6446d822f42ffb38090c9018ca8db7995216de98c988"
EXPECTED_PAYFAST_ADAPTER="6f16144811d3a0b7a9a24795f374cf4dd99cc097b445fd39e2a1c97f20201d54"
EXPECTED_PAYFAST_LIB="b5ab57a236758f16946a6477f61bae1ad90195cba6064bd99368158b805c2066"
EXPECTED_CHECKOUT="35b4a37e32349eff18652ebb48f7eebd308ef9d5dd5a980dce4741246666f8f3"
EXPECTED_ITN="dba77f9d0f09b37cb560ec824fef05c3997b83f0fe24d84ad836d5095de0c72a"

status=0
check() {
  local path="$1" expected="$2"
  if [ ! -f "$path" ]; then
    echo "FAIL A8: $path is missing."
    status=1
    return
  fi
  local actual
  actual=$(shasum -a 256 "$path" | cut -d' ' -f1)
  if [ "$actual" != "$expected" ]; then
    echo "FAIL A8: $path changed during this feature."
    echo "         expected $expected"
    echo "         actual   $actual"
    echo "         This feature is additive only — checkout wiring is F2."
    status=1
  fi
}

check lib/payments/index.ts "$EXPECTED_INDEX"
check lib/payments/types.ts "$EXPECTED_TYPES"
check lib/payments/payfast.ts "$EXPECTED_PAYFAST_ADAPTER"
check lib/payfast.ts "$EXPECTED_PAYFAST_LIB"
check app/api/tickets/checkout/route.ts "$EXPECTED_CHECKOUT"
check app/api/tickets/itn/route.ts "$EXPECTED_ITN"

[ "$status" -eq 0 ] && echo "PASS A8: index.ts, types.ts, PayFast's adapter/lib, and both existing routes are byte-identical to their pre-feature state."
exit "$status"
