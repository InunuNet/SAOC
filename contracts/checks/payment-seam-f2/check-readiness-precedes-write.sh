#!/usr/bin/env bash
# A9 — THE READINESS VERDICT GATES THE WRITE. NOT THE POSITION OF A CALL.
#
# contracts/golden/payment-seam-f1/fail-closed-guards.golden.md pins the gateway-credential guard as
# "Before reserveTicket(), i.e. before any Firestore write". F2's first form broke that: initiate()
# needs the booking reference and the server-derived amount, both of which only exist AFTER
# reserveTicket(), so the refusal necessarily landed after the reservation. A misconfigured gateway
# stopped producing a clean 500 and started producing orphaned reservations that burn capacity until
# their TTL expires.
#
# That is not an acceptable narrow trade. The seam exists to make gateway swaps cheap, SAOC will
# swap under deadline against a live show with credentials never exercised in production, and a
# misconfigured gateway is therefore the most likely failure mode, arriving exactly when tickets are
# selling. readiness('initiate') restores the ordering without the route touching gateway env.
#
# THIS CHECK ONCE ASSERTED ONLY POSITION, AND THAT WAS NOT ENOUGH. Two mutations against copies of
# the real route left it GREEN (both are now standing regressions in check-ordering-mutations.sh):
#
#   M1  the probe replaced by `gatewayReadiness = { ready: true }; // paymentProvider.readiness(…)`
#       with a real probe appended AFTER the write — the old leading-comment-only filter counted the
#       trailing comment as the call and reported "refuses at line 319"
#   M2  `paymentProvider.readiness('initiate');` with the verdict DISCARDED — no assignment, no
#       branch, no refusal. A probe whose answer is thrown away is indistinguishable from no probe,
#       and an assertion about the position of a call cannot tell them apart.
#
# The property is a CHAIN, and readiness_gate.py asserts every link against comment-stripped code:
# a probe before the write, its verdict CAPTURED, that verdict tested for NOT-ready, that branch
# returning the pinned 500 — still before the write — a catch that leaves the verdict unready when
# the adapter throws, no `ready: true` fabricated by the route, and the post-initiate refusal
# surviving as defence in depth.
#
# WHAT MAKES THIS FAIL: no readiness() call; a call that does not precede reserveTicket(); a verdict
# that is never assigned, never tested, or tested without refusing; a throwing probe falling through
# as if configured; the route minting its own `ready: true`; either refusal deleted. An INSTRUMENT
# failure (exit 3) is reported as an instrument failure, never as an absent landmark.
#
# Run as: bash contracts/checks/payment-seam-f2/check-readiness-precedes-write.sh
set -uo pipefail

# The override exists ONLY so check-ordering-mutations.sh can drive this logic against deliberately
# broken COPIES. Every committed invocation leaves it unset and reads the real route.
CHECKOUT="${CHECKOUT_PATH_OVERRIDE:-app/api/tickets/checkout/route.ts}"
ANALYSER=contracts/checks/payment-seam-f2/readiness_gate.py

python3 "$ANALYSER" "$CHECKOUT"
rc=$?

if [ "$rc" -eq 3 ]; then
  echo "FAIL A9: the analyser could not run, so this result says nothing about $CHECKOUT."
  exit 1
fi
exit "$rc"
