#!/usr/bin/env bash
# A11 — this contract's OWN checks/fixtures/golden README must never carry the real placeholder
# show-date range (18-21 September 2027, and the '2027-09-1[6-9]' date literals that spell it
# out) or an invented day-name range presented as a confirmed show date. This is a guard on this
# feature's OWN artifacts, not a repo-wide scan — see golden README "The blocker this is built
# around": the whole point of this feature is to never let that specific range spread into a
# second file. Prose that explicitly EXPLAINS why the placeholder is avoided (this README, this
# script) does not itself introduce a new instance of the incident, but must not do so via the
# literal date/day-name pattern more than the small, deliberate number of times it is quoted to
# explain the constraint. This script therefore only fails on the DATE LITERAL forms appearing
# inside checks/fixtures (never inside the golden README's own prose, which is explicitly
# permitted to name the incident once for context).
#
# Run as: bash contracts/checks/ticketing-f5-day-attendees/check-no-placeholder-dates.sh

set -euo pipefail

CHECKS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Every check/fixture file (.mjs/.ts/.sh) in this feature's own checks directory, EXCLUDING this
# script itself (which must be allowed to name the pattern it's guarding against in its own
# comments) and EXCLUDING the golden README (prose context, not code/fixtures).
OFFENDERS=$(
  grep -rlE '2027-09-1[6-9]|18-21 September|18\s*-\s*21\s+September' \
    "$CHECKS_DIR" \
    --include='*.mjs' --include='*.ts' --include='*.sh' \
    2>/dev/null \
    | grep -v "^${CHECKS_DIR}/check-no-placeholder-dates.sh$" \
    || true
)

if [[ -n "$OFFENDERS" ]]; then
  echo "FAIL: the following check/fixture file(s) under contracts/checks/ticketing-f5-day-attendees/"
  echo "      contain the real placeholder show-date range (2027-09-16..2027-09-19 / '18-21"
  echo "      September') — this feature's entire point is that no fixture reuses that specific,"
  echo "      unconfirmed range. Use an obviously-synthetic date range (e.g. 2099-*/2098-*) instead:"
  echo "$OFFENDERS" | sed 's/^/  - /'
  exit 1
fi

echo "PASS: no ticketing-f5-day-attendees check/fixture file carries the real placeholder show-date range."
exit 0
