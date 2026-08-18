#!/usr/bin/env bash
# STRUCTURAL, not behavioural (mirrors the pattern of A10 in
# contracts/contract-fictional-test-show.yaml). The behavioural correctness of the guard
# logic itself is proven against fixtures in check-conflict-detection-and-message.mjs and
# check-published-draft-dedup.mjs; those checks call lib/active-show-guard.ts directly
# and would pass even if show.ts never wired it in. This script closes that gap: it
# proves the `active` field's `validation` in sanity/schemas/documents/show.ts actually
# calls findConflictingActiveShow()/formatActiveShowConflictMessage() via Rule.custom(),
# and that ticketType.ts's `show` reference field carries the P3 fold-in filter — so the
# guard is not merely a dead, unreferenced module sitting in lib/.
set -euo pipefail

SHOW_SCHEMA="sanity/schemas/documents/show.ts"
TICKET_TYPE_SCHEMA="sanity/schemas/documents/ticketType.ts"

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

[ -f "$SHOW_SCHEMA" ] || fail "$SHOW_SCHEMA not found"
[ -f "$TICKET_TYPE_SCHEMA" ] || fail "$TICKET_TYPE_SCHEMA not found"

grep -q "active-show-guard" "$SHOW_SCHEMA" \
  || fail "$SHOW_SCHEMA does not import from lib/active-show-guard"

grep -q "findConflictingActiveShow" "$SHOW_SCHEMA" \
  || fail "$SHOW_SCHEMA does not call findConflictingActiveShow()"

grep -q "formatActiveShowConflictMessage" "$SHOW_SCHEMA" \
  || fail "$SHOW_SCHEMA does not call formatActiveShowConflictMessage()"

grep -q "Rule.custom" "$SHOW_SCHEMA" \
  || fail "$SHOW_SCHEMA does not use Rule.custom() anywhere"

# The active field block itself must contain the Rule.custom wiring — a bare presence of
# these tokens somewhere else in the file (e.g. a different field) would not satisfy this.
ACTIVE_FIELD_BLOCK=$(awk "/name: 'active'/,/^\s*\}\),\s*\$/" "$SHOW_SCHEMA")
echo "$ACTIVE_FIELD_BLOCK" | grep -q "Rule.custom" \
  || fail "the 'active' field's own defineField block does not contain Rule.custom()"
echo "$ACTIVE_FIELD_BLOCK" | grep -q "findConflictingActiveShow" \
  || fail "the 'active' field's own defineField block does not call findConflictingActiveShow()"

# P3 fold-in: ticketType.show's reference picker should be filtered to active shows only,
# so an editor building a new ticket type cannot casually point it at a 2012 archive show.
grep -q "options: { filter: 'active == true' }" "$TICKET_TYPE_SCHEMA" \
  || fail "$TICKET_TYPE_SCHEMA's show reference field is missing the active-show filter"

echo "PASS: show.ts's active field wires the guard via Rule.custom(); ticketType.ts's show reference is filtered to active shows."
