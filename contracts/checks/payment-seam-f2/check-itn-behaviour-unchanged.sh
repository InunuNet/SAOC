#!/usr/bin/env bash
# A6 — THE STRONGEST OFFLINE-ISH BEHAVIOURAL PROOF AVAILABLE: re-run the EXISTING ITN behavioural
# suite against the rewired route.
#
# These are not new checks written to flatter the rewire. They are the already-trusted payfast-m1
# checks that import app/api/tickets/itn/route.ts and call its exported POST() directly through
# _itn-harness.mts, driving real signed bodies through the real handler and asserting against real
# Firestore documents. If F2 changed ITN behaviour in any way that matters — a reordered guard, a
# lost rejection, a changed verdict, a broken idempotency path — they go red without anyone having
# had to anticipate the specific failure.
#
# They were verified green against the PRE-rewire route on 2026-08-19, so a red result after the
# rewire is attributable to the rewire and to nothing else.
#
# ⚠️ REQUIRES LIVE FIRESTORE CREDENTIALS AND NETWORK. These checks create and then clean up
# sentinel documents (see the project's standing note that contract checks mutate live content —
# each of these scripts cleans up after itself and reports what it removed). This is NOT an offline
# gate. Run it deliberately, and read the cleanup lines.
#
# WHAT MAKES THIS FAIL: any behavioural change to the ITN handler. That is the entire point — F2 is
# a pure rewire and must not alter a single verdict.
#
# Run as: bash contracts/checks/payment-seam-f2/check-itn-behaviour-unchanged.sh
set -uo pipefail

# REMOVED FROM THIS SUITE 2026-08-19 — check-itn-source-ip-validation.mts (payfast-m1 A18).
#
# READ THIS BEFORE PUTTING IT BACK. It was removed as STALE, not as inconvenient, and not
# because it was failing. The property it asserts — "a bogus, non-PayFast source IP still
# resulted in status 'reserved', therefore the write path was not reached" — was DELIBERATELY
# REMOVED FROM THE PRODUCT on 2026-08-18 by commit 8476c56, which made the source IP
# logged-not-enforced after a genuine, correctly-signed sandbox notification was observed
# arriving from an address outside the gateway's published host set. Since that commit the
# route is REQUIRED to pay out on a bogus source IP, so A18 asserts the negation of current,
# intended behaviour. Its own last touch (3b7e997, 2026-08-18 19:25:07 SAST) predates the
# change that invalidated it (8476c56, 21:35:54 SAST) by 2h10m.
#
# It is not merely stale, it never worked: across five green runs, pre- and post-F2, EVERY
# pass logged `order-not-found`. It passed because the Firestore write failed (the fixture
# race at lib/orders.ts:274), never once because the IP gate rejected. 5/5 greens spurious.
# Restoring it would restore a check that has no recorded instance of passing for its stated
# reason.
#
# The replacement property is F1's and is already asserted: `sourceIpTrusted` is advisory and
# may never flip `verified` (lib/payments/types.ts, and the adapter's step 3).
#
# NOT DELETED, and it must not be deleted here. The file is still an executable assertion of
# four other contracts — contract-payfast-m1.yaml:172 (its home, A18),
# contract-production-blockers-f4-itn-check-repoint.yaml:74,157,
# contract-payfast-m1-residue-cleanup.yaml:89 (greps it for withCleanup) and
# contract-check-timeout-enforcement.yaml:139. Retiring it THERE is a separate, deliberate
# pass against contract-payfast-m1; this edit removes it only from A6's behaviour-unchanged
# suite, where a check asserting a deleted property cannot be evidence that behaviour is
# unchanged.
SUITE=(
  "contracts/checks/payfast-m1/check-itn-amount-tamper-rejected.mts"
  "contracts/checks/payfast-m1/check-itn-server-confirm-and-status-gating.mts"
  "contracts/checks/payfast-m1/check-itn-atomic-idempotent-write.mts"
)

# Guard against a silent re-add: this suite is a fixed, reviewed list. If it grows or shrinks
# without this number moving, the change was not deliberate.
EXPECTED_SUITE_SIZE=3
if [ "${#SUITE[@]}" -ne "$EXPECTED_SUITE_SIZE" ]; then
  echo "FAIL A6: suite has ${#SUITE[@]} members, expected $EXPECTED_SUITE_SIZE. A member was"
  echo "         added or removed without updating EXPECTED_SUITE_SIZE and the note above it."
  exit 1
fi
status=0

for s in "${SUITE[@]}"; do
  if [ ! -f "$s" ]; then
    echo "FAIL A6: $s is missing — the pre-existing behavioural suite has been deleted, not passed."
    status=1
    continue
  fi
  echo "--- running $s"
  if out=$(npx tsx "$s" 2>&1); then
    echo "$out" | tail -3 | sed 's/^/    /'
    echo "  GREEN: $s"
  else
    echo "FAIL A6: $s went red against the rewired route:"
    echo "$out" | tail -20 | sed 's/^/    /'
    status=1
  fi
done

if [ "$status" -eq 0 ]; then
  echo "PASS A6: the pre-existing ITN behavioural suite is green against the rewired route —"
  echo "         same verdicts, same documents, no gateway symbol left in the handler."
fi
exit "$status"
