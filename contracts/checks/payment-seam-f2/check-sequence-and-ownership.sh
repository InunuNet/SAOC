#!/usr/bin/env bash
# A4 — THE SECURITY SEQUENCE AND THE OWNERSHIP BOUNDARY SURVIVE THE REWIRE.
#
# Carries all three findings F1 flagged as "cannot be moved without a behaviour change" into
# executable form, so a future tidy-up trips a gate instead of a live payment.
#
#   FINDING 1 — THE GUARDS ARE DELIBERATELY ASYMMETRIC. Pre-F2, checkout had NO gateway-passphrase
#     guard (it passed a possibly-undefined passphrase through) while the ITN route failed closed
#     on one, because an unset passphrase there degrades verification to a plain MD5 over
#     publicly-known fields. Post-F2 both routes receive the same 'not-configured' reason code and
#     must still handle it DIFFERENTLY: checkout refuses the purchase with a 500; the ITN route
#     acknowledges with no order change. Part 3 asserts both handlings exist and differ.
#
#   FINDING 2 — THE AMOUNT CHECK, ORDER LOOKUP AND SETTLED SHORT-CIRCUIT SIT BETWEEN VERIFICATION
#     AND SERVER-CONFIRM and must stay in the route. Part 2 asserts the full eleven-step source
#     order, so moving any of them into the provider — or reordering confirm before the amount
#     check — fails.
#
#   FINDING 3 — RECOVERY_TOKEN_SECRET'S GUARD IS LOAD-BEARING BY SOURCE POSITION, not merely by
#     presence. Part 4 asserts the position, matching the claim
#     contracts/checks/ticketing-checkout-orders/check-fail-closed-secret-guard.sh already makes.
#
# WHAT MAKES THIS FAIL: any of the eleven ITN steps reordered or removed; the amount comparison or
# the order lookup migrating into the provider; either route reading process.env for a gateway
# credential (the provider owns that now); the two routes converging on one handling of
# 'not-configured'; the recovery-secret guard moving after the reservation write; the checkout
# route dropping its ticketTypeMatchesActiveShow export, which four other contracts import.
#
# Run as: bash contracts/checks/payment-seam-f2/check-sequence-and-ownership.sh
set -uo pipefail

CODE_LINES=contracts/checks/payment-seam-f2/code_lines.py

# Path overrides exist ONLY so check-ordering-mutations.sh can run this logic against deliberately
# broken copies. Every committed invocation leaves them unset and reads the real routes.
CHECKOUT="${CHECKOUT_PATH_OVERRIDE:-app/api/tickets/checkout/route.ts}"
ITN="${ITN_PATH_OVERRIDE:-app/api/tickets/itn/route.ts}"
status=0

# First CODE line (strictly after $3) containing the LITERAL substring $2.
#
# Two defects are closed here, both proven by mutation rather than reasoning:
#
#   1. COMMENTS. The previous filter skipped a line only when its LEADING non-whitespace was a
#      comment marker, so a TRAILING comment counted as code. @qa deleted the RECOVERY_TOKEN_SECRET
#      guard, left `const decoy = 0; // RECOVERY_TOKEN_SECRET must be set`, and this check stayed
#      green; moving the real read to the end of the file, after the write, also stayed green — so
#      part 4 asserted no ordering whatsoever. code_lines.py strips comments string-aware (a URL's
#      `//` survives) and preserves line numbers.
#
#   2. LITERALS ARE CODE CONSTRUCTS, NOT BARE TOKENS. Comment-stripping alone is not enough: a
#      token surviving only inside a log STRING would still satisfy a bare-token search, and
#      `console.error('... Missing RECOVERY_TOKEN_SECRET ...')` is exactly such a string in this
#      very file. Each landmark below therefore matches the code that performs the step
#      (`process.env.RECOVERY_TOKEN_SECRET`, `>= AMOUNT_MATCH_TOLERANCE`), never its name.
#
# Matching is LITERAL, never a regex: both awk-escaping bugs in this contract's checks came from
# dynamic regexes, and there is nothing to escape in a substring test.
# An INSTRUMENT failure is not a finding. `2>/dev/null || true` made a broken stripper report every
# landmark as absent, so A4 failed with "step X is absent from the ITN route" against a route that
# contains it — sending the next reader hunting a defect that is not there. It errs safe (red, not
# green) but it lies about why, which is the same swallow class as the awk `2>/dev/null` already
# fixed here. code_lines.py exits 0 with a line number, 1 with NOTHING on stderr for a genuine
# absence, and anything else (usage error, traceback) with a message on stderr. Only the middle case
# is an absence; everything else aborts the whole check.
#
# It sets a GLOBAL rather than printing, deliberately: called as `x=$(first_code …)` the function
# body runs in a subshell, where `exit` kills only the subshell and every diagnostic it printed is
# captured as the result — the abort silently becomes the answer. That is the same shape of bug as
# the swallow it replaces.
CODE_LINES_ERR=$(mktemp)
trap 'rm -f "$CODE_LINES_ERR"' EXIT

FIRST_CODE=""
first_code() {  # sets FIRST_CODE; aborts the whole check if the instrument itself fails
  local rc
  FIRST_CODE=$(python3 "$CODE_LINES" --first "$1" "$2" "${3:-0}" 2>"$CODE_LINES_ERR"); rc=$?
  if [ "$rc" -gt 1 ] || [ -s "$CODE_LINES_ERR" ]; then
    echo "FAIL A4 (INSTRUMENT): code_lines.py failed while scanning $1 for '$2', so NO verdict about"
    echo "         the routes is possible. This is not a finding about the source."
    sed 's/^/         /' "$CODE_LINES_ERR"
    exit 1
  fi
}

fail() { echo "FAIL A4: $*"; status=1; }

# --- Part 1: positive control. Both routes exist and go through the seam. ----------------------
for f in "$CHECKOUT" "$ITN"; do
  [ -f "$f" ] || { echo "FAIL A4: $f does not exist."; exit 1; }
done
grep -q 'paymentProvider' "$ITN"      || fail "$ITN never references paymentProvider."
grep -q 'paymentProvider' "$CHECKOUT" || fail "$CHECKOUT never references paymentProvider."

# --- Part 2: the eleven-step ITN sequence, in source order. ------------------------------------
declare -a STEPS=(
  "verifyNotification|1 verification"
  "sourceIpTrusted|4 source-IP logging"
  "findReservedOrderByPaymentId|5 order lookup"
  "already-settled|6 settled short-circuit"
  ">= AMOUNT_MATCH_TOLERANCE|7 amount match"
  "confirmNotification|8 server confirmation"
  "mapStatus|9 status check"
  "markOrderAndPositionPaidByPaymentId|10 atomic write"
  "deliverConfirmationEmailAfterCommit|11 post-commit email"
)
first_code "$ITN" "export async function POST"; POST_LINE="$FIRST_CODE"
if [ -z "$POST_LINE" ]; then
  fail "$ITN has no exported POST handler."
  POST_LINE=0
fi
prev_line="$POST_LINE"
prev_name="the POST() handler opening"
for entry in "${STEPS[@]}"; do
  pattern="${entry%%|*}"
  name="${entry##*|}"
  # The amount-match step is located by its tolerance constant's USE, not its declaration.
  if [ "$pattern" = ">= AMOUNT_MATCH_TOLERANCE" ]; then
    first_code "$ITN" ">= AMOUNT_MATCH_TOLERANCE" "$POST_LINE"; line="$FIRST_CODE"
  else
    first_code "$ITN" "$pattern" "$POST_LINE"; line="$FIRST_CODE"
  fi
  if [ -z "$line" ]; then
    fail "step $name is absent from $ITN (looked for /$pattern/). It cannot have moved into the provider."
    continue
  fi
  if [ "$line" -le "$prev_line" ]; then
    fail "step $name appears at line $line, at or before '$prev_name' (line $prev_line) — the ITN validation sequence has been reordered."
  fi
  prev_line="$line"
  prev_name="$name"
done

# --- Part 3: FINDING 1 — the asymmetry. ---------------------------------------------------------
# Neither route may read a gateway credential from the environment any more; that is the provider's
# job, and a route that still reads one has not actually been rewired.
for f in "$CHECKOUT" "$ITN"; do
  envhits=$(grep -nE "process\.env\.[A-Z_]*(MERCHANT|PASSPHRASE|GATEWAY|PAYMENT)" "$f" || true)
  [ -n "$envhits" ] && fail "$f still reads a gateway credential from the environment:
$envhits"
done
# Checkout REFUSES on not-configured (500). The ITN route ACKNOWLEDGES on it (no order change).
grep -q "not-configured" "$CHECKOUT" \
  || fail "$CHECKOUT never handles the provider's 'not-configured' refusal — the credential guard has been lost, not moved."
grep -qE "status: 500" "$CHECKOUT" \
  || fail "$CHECKOUT no longer returns a 500 for an unconfigured gateway (see fail-closed-guards.golden.md: 500, deliberately not 4xx)."
grep -q "acknowledge()" "$ITN" \
  || fail "$ITN no longer acknowledges — the gateway would retry forever."
# The asymmetry itself: checkout must NOT acknowledge-and-continue, the ITN route must NOT 500.
grep -qE "status: 500" "$ITN" \
  && fail "$ITN returns a 500. Every ITN outcome is HTTP 200 so the gateway stops retrying; a 5xx here re-opens the retry storm."

# --- Part 4: FINDING 3 — the recovery-secret guard, by POSITION. --------------------------------
first_code "$CHECKOUT" "process.env.RECOVERY_TOKEN_SECRET"; secret_guard="$FIRST_CODE"
first_code "$CHECKOUT" "reserveTicket("; reserve_call="$FIRST_CODE"
if [ -z "$secret_guard" ]; then
  fail "$CHECKOUT no longer reads RECOVERY_TOKEN_SECRET — the fail-closed recovery guard is gone."
elif [ -z "$reserve_call" ]; then
  fail "$CHECKOUT no longer calls reserveTicket() — cannot verify the guard's position."
elif [ "$secret_guard" -ge "$reserve_call" ]; then
  fail "the RECOVERY_TOKEN_SECRET guard (line $secret_guard) no longer precedes the reservation write (line $reserve_call). An unset secret must refuse BEFORE any Firestore write, never mint a never-verifiable-again recovery token."
fi

# --- Part 5: the checkout export four other contracts import must survive. ----------------------
grep -qE "export function ticketTypeMatchesActiveShow" "$CHECKOUT" \
  || fail "$CHECKOUT no longer exports ticketTypeMatchesActiveShow. Four other contracts' checks import it (production-blockers-f3, ticketing-f1-show-collision, fictional-test-show, ticketing-f9-demo-ticket) and will fail to resolve."

if [ "$status" -eq 0 ]; then
  echo "PASS A4: the eleven-step ITN sequence is in order, the amount check and order lookup"
  echo "         stayed in the route, the guard asymmetry survives, the recovery-secret guard"
  echo "         still precedes the reservation write, and the shared export is intact."
fi
exit "$status"
