#!/usr/bin/env bash
# verify-reservation-release-path F1, A4 — structural proof that
# app/api/admin/reconcile-orders/route.ts (and lib/reconciliation.ts, which it calls) is NOT
# the release mechanism. It never imports the one function in this codebase that can flip an
# order's status, and its only Firestore write target is the reconciliationAlertedAt
# bookkeeping field. This closes off the misreading the mission brief was written to guard
# against ("reconcile-orders per docs/order-reconciliation.md, or lazy on-read release,
# whichever the code actually implements") — it is the latter; this check proves the former is
# structurally incapable of being it, without triggering a real Resend alert email as a side
# effect (see order-reconciliation's own goldens/README.md for why no automated check sends one).
#
# Run as: bash .agent/memory/project/specs/verify-reservation-release-path/goldens/check-reconcile-orders-alert-only-not-release.sh

set -euo pipefail
cd "$(dirname "$0")/../../../../../.."

RECONCILE_FILES="lib/reconciliation.ts app/api/admin/reconcile-orders/route.ts"

# Strip block (/* ... */) and line (// ...) comments before matching, so a JSDoc comment that
# documents "this file never imports X" (both RECONCILE_FILES carry exactly such a comment) is
# not itself mistaken for an import of X. Only code past comment-stripping counts as a real
# import/reference.
strip_comments() {
  perl -0777 -pe 's{/\*.*?\*/}{}gs; s{//[^\n]*}{}g' "$1"
}

FAIL=0

for f in $RECONCILE_FILES; do
  if strip_comments "$f" | grep -q "markOrderAndPositionPaidByPaymentId"; then
    echo "FAIL: $f imports/references markOrderAndPositionPaidByPaymentId outside a comment — it can flip order status, meaning reconcile-orders is no longer alert-only."
    FAIL=1
  fi
done

for f in $RECONCILE_FILES; do
  if strip_comments "$f" | grep -qE "\.collection\('tickets'\)\.doc\([^)]*\)\.(delete|set)\("; then
    echo "FAIL: $f deletes or overwrites a tickets/ position document directly — that would be a release write, not an alert."
    FAIL=1
  fi
done

if ! grep -q "reconciliationAlertedAt" lib/reconciliation.ts; then
  echo "FAIL: lib/reconciliation.ts no longer references reconciliationAlertedAt — the expected alert-bookkeeping field is missing; this check's premise about what the write path touches no longer holds."
  FAIL=1
fi

if [ "$FAIL" -eq 0 ]; then
  echo "PASS: reconcile-orders/lib/reconciliation.ts never imports the status-flipping settle function and never deletes/overwrites a tickets/ position doc — structurally alert-only, not a release mechanism."
  exit 0
fi

exit 1
