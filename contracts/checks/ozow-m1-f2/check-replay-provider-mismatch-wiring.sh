#!/usr/bin/env bash
# A12b — reserveTicket() ACTUALLY CALLS replayGatewayMatches() ON THE REPLAY PATH, AND A FALSE
# RESULT SHORT-CIRCUITS BEFORE THE 'replayed' OUTCOME IS EVER RETURNED. check-replay-provider-
# mismatch-pure.mjs proves the pure decision function is correct in isolation; this proves it is
# not decorative — the same "pure function + wiring" pattern already used for
# resolveChosenDayForPosition() (ticketing-f5-day-attendees).
#
# WHAT MAKES THIS FAIL: reserveTicket()'s replay branch not calling replayGatewayMatches(); the
# call site appearing AFTER the 'replayed' return (dead code, never reached); POST() not mapping
# outcome.kind === 'key-provider-mismatch' to a rejection response.
#
# Run as: bash contracts/checks/ozow-m1-f2/check-replay-provider-mismatch-wiring.sh

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

ROUTE="app/api/tickets/checkout/route.ts"
FAIL=0
fail() { echo "FAIL: $1"; FAIL=1; }

[ -f "$ROUTE" ] || { fail "$ROUTE does not exist"; echo "OVERALL: FAIL"; exit 1; }

grep -q 'replayGatewayMatches(storedGateway, input.gateway)' "$ROUTE" \
  || fail "$ROUTE's replay branch never calls replayGatewayMatches(storedGateway, input.gateway)"

grep -q "kind: 'key-provider-mismatch'" "$ROUTE" \
  || fail "$ROUTE never returns { kind: 'key-provider-mismatch' } — the rejection outcome is missing"

# Ordering: the mismatch return must appear BEFORE the 'replayed' return in reserveTicket()'s
# source (a textual, not runtime, proof — same technique
# check-fail-closed-secret-guard.sh already uses in this codebase for source-position claims).
# `tail -1`, not `head -1`: the ReservationOutcome TYPE UNION declares both kinds' literal shapes
# near the top of the file (in union declaration order, not control-flow order) — the actual
# `return { kind: ... }` statements inside reserveTicket() are what must be compared, and those
# are each kind's LAST occurrence in the file.
MISMATCH_LINE=$(grep -n "kind: 'key-provider-mismatch'" "$ROUTE" | tail -1 | cut -d: -f1)
REPLAYED_LINE=$(grep -n "kind: 'replayed'" "$ROUTE" | tail -1 | cut -d: -f1)
if [ -z "$MISMATCH_LINE" ] || [ -z "$REPLAYED_LINE" ]; then
  fail "could not locate both the mismatch and replayed return sites to compare order"
elif [ "$MISMATCH_LINE" -ge "$REPLAYED_LINE" ]; then
  fail "the mismatch rejection (line $MISMATCH_LINE) does not precede the 'replayed' outcome (line $REPLAYED_LINE) — a mismatched replay could still fall through to a live payment hand-off"
fi

# POST() must actually branch on the new outcome kind and return a rejection (409), not fall
# through to the generic 'created'/'replayed' destructure below it.
grep -q "outcome.kind === 'key-provider-mismatch'" "$ROUTE" \
  || fail "POST() never checks outcome.kind === 'key-provider-mismatch' — the rejection outcome would fall through to the payment hand-off code"

if [ "$FAIL" -ne 0 ]; then
  echo "OVERALL: FAIL"
  exit 1
fi
echo "OVERALL: PASS — reserveTicket() calls replayGatewayMatches() before returning 'replayed', and POST() maps a mismatch to a rejection."
