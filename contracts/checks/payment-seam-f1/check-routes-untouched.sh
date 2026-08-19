#!/usr/bin/env bash
# A10 — F1 IS ADDITIVE: NEITHER ROUTE NOR lib/payfast.ts IS TOUCHED.
#
# Route rewiring is F2. Keeping F1 purely additive is what gives F3's live sandbox purchase ONE
# candidate cause if it regresses instead of two — the stated reason this mission was split this
# way. These three sha256 values were taken from the working tree on 2026-08-19, before any code
# moved.
#
# WHAT MAKES THIS FAIL: @dev rewiring either route inside F1 (i.e. F1 silently becoming F1+F2);
# any edit to lib/payfast.ts, whose primitives four other contracts' checks import by that path.
#
# NOTE — PRE-EXISTING, FLAGGED NOT FIXED: the ITN route's OTHER four pins (ticketing-f1-show-
# collision, ticketing-m1-m2, ticketing-f10-itn-repin, ticketing-hardening) are all STALE against
# the current file, almost certainly from the 2026-08-18 source-IP "logged, not enforced" change.
# The value pinned here is the CURRENT file only, as an "F1 did not touch this" boundary — it is
# deliberately NOT an endorsement of that content, and re-pinning the other four is a ceremony F2
# must plan. See contracts/golden/payment-seam-f1/fail-closed-guards.golden.md.
#
# Run as: bash contracts/checks/payment-seam-f1/check-routes-untouched.sh
set -uo pipefail

EXPECTED_CHECKOUT="b458ed702c72f5551b97503a6683e8856d4a973db1fc6e804aa2fa5940a55309"
EXPECTED_ITN="a71f9505a21775425c9952dccf3e02abbe06fef0e2b58a1529cb3a2408f395d1"
EXPECTED_PAYFAST_LIB="b5ab57a236758f16946a6477f61bae1ad90195cba6064bd99368158b805c2066"

status=0
check() {
  local path="$1" expected="$2"
  if [ ! -f "$path" ]; then
    echo "FAIL A10: $path is missing."
    status=1
    return
  fi
  local actual
  actual=$(shasum -a 256 "$path" | cut -d' ' -f1)
  if [ "$actual" != "$expected" ]; then
    echo "FAIL A10: $path changed during F1."
    echo "         expected $expected"
    echo "         actual   $actual"
    echo "         F1 is additive only — route rewiring is F2."
    status=1
  fi
}

check app/api/tickets/checkout/route.ts "$EXPECTED_CHECKOUT"
check app/api/tickets/itn/route.ts "$EXPECTED_ITN"
check lib/payfast.ts "$EXPECTED_PAYFAST_LIB"

[ "$status" -eq 0 ] && echo "PASS A10: both routes and lib/payfast.ts are byte-identical to their pre-F1 state."
exit "$status"
