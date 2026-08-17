#!/usr/bin/env bash
# fictional-test-show — STRUCTURAL, not behavioural (mirrors F9's A8's own labelling). Confirms
# none of app/api/tickets/checkout/route.ts, app/api/tickets/itn/route.ts, lib/checkin.ts, or
# lib/orders.ts contains any reference to FICTIONAL_SHOW_ID, FICTIONAL_SHOW_SLUG,
# FICTIONAL_SHOW_TICKET_TYPE_SLUG, or FICTIONAL_SHOW_TICKET_TYPE_ID — proving the fictional
# show is exercised entirely through the real, unmodified checkout/ITN/check-in code paths as
# ordinary data, with no source-level special case introduced for it anywhere those paths live.
# See golden README "The recoverability chain, three hops" closing paragraph, and "OUT OF
# SCOPE" in the contract.
#
# DEFEATING MUTATION named up front: a future edit to any of these four files adding a branch
# such as `if (ticketType.slug === FICTIONAL_SHOW_TICKET_TYPE_SLUG) { ... }` — a plausible-
# looking "just skip PayFast for the test show" shortcut that would make this feature's data
# behave differently from real data, defeating the entire point of routing it through the
# unmodified pipeline. A plain grep for the four exported constant NAMES catches this: the
# constants are deliberately distinctive strings (no other feature or file has any legitimate
# reason to reference them), so a grep hit in any of the four files is unambiguous evidence of
# exactly the special case this check exists to prevent — there is no legitimate reason for a
# false positive to defeat, only a name collision, which the reserved 'fictional-test-show'
# prefix on every constant makes vanishingly unlikely by construction.
#
# Run as: bash contracts/checks/fictional-test-show/check-no-special-case.sh

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

FILES=(
  "app/api/tickets/checkout/route.ts"
  "app/api/tickets/itn/route.ts"
  "lib/checkin.ts"
  "lib/orders.ts"
)

CONSTANTS=(
  "FICTIONAL_SHOW_ID"
  "FICTIONAL_SHOW_SLUG"
  "FICTIONAL_SHOW_TICKET_TYPE_SLUG"
  "FICTIONAL_SHOW_TICKET_TYPE_ID"
)

failures=0

for rel in "${FILES[@]}"; do
  path="${REPO_ROOT}/${rel}"
  if [ ! -f "$path" ]; then
    echo "FAIL: ${path} not found." >&2
    failures=$((failures + 1))
    continue
  fi
  for constant in "${CONSTANTS[@]}"; do
    if grep -q "$constant" "$path"; then
      echo "FAIL: ${rel} references '${constant}' — a source-level special case for the fictional show has been introduced into a real checkout/ITN/check-in code path." >&2
      grep -n "$constant" "$path" >&2
      failures=$((failures + 1))
    fi
  done
done

if [ "$failures" -gt 0 ]; then
  echo "" >&2
  echo "${failures} violation(s) found." >&2
  exit 1
fi

echo "PASS (structural only): none of checkout/route.ts, itn/route.ts, lib/checkin.ts, or lib/orders.ts references any fictional-show constant — the fictional show flows through the real, unmodified pipeline as ordinary data."
exit 0
