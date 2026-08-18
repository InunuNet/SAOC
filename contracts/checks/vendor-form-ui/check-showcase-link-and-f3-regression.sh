#!/usr/bin/env bash
# A9 -- (a) the existing showcase page app/(marketing)/national-show/vendors/page.tsx links to
# the new registration route; (b) every one of F3's OWN assertion commands
# (contracts/contract-vendor-f3-showcase-page.yaml) still passes against the current repo state,
# proving this feature has not broken the shipped showcase page. Re-invokes F3's real check
# scripts directly (not a re-derivation of F3's logic) -- if F3's contract ever changes its own
# assertion set, this list must be updated to match; that drift is a known limitation, not
# silently masked (see README's "What this contract does NOT prove").
#
# DEFEATING MUTATION: removing or breaking the cross-link on the showcase page; any edit to
# components/vendors/VendorGrid.tsx, VendorIntro.tsx, VendorEmptyState.tsx, sanity/queries.ts's
# vendorNurseriesQuery, or app/(marketing)/national-show/vendors/page.tsx/loading.tsx that
# regresses F3's own behaviour while adding this feature's register subroute.
#
# Run as: bash contracts/checks/vendor-form-ui/check-showcase-link-and-f3-regression.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

SHOWCASE_PAGE="app/(marketing)/national-show/vendors/page.tsx"

if [[ ! -f "$SHOWCASE_PAGE" ]]; then
  echo "FAIL: $SHOWCASE_PAGE does not exist"
  exit 1
fi

if ! grep -Eq 'href="/national-show/vendors/register"|href=\x27/national-show/vendors/register\x27' "$SHOWCASE_PAGE"; then
  echo "FAIL: $SHOWCASE_PAGE has no <Link href=\"/national-show/vendors/register\"> to the new registration form"
  exit 1
fi
echo "PASS (1/2): showcase page links to /national-show/vendors/register"

# F3's own assertion commands, verbatim from contracts/contract-vendor-f3-showcase-page.yaml.
F3_CHECKS=(
  "node --import tsx/esm contracts/checks/vendor-f3-showcase-page/check-query-projects-every-field.mjs"
  "node --import tsx/esm contracts/checks/vendor-f3-showcase-page/check-grid-renders-fixture-data.mjs"
  "node --import tsx/esm contracts/checks/vendor-f3-showcase-page/check-empty-state-renders.mjs"
  "node --import tsx/esm contracts/checks/vendor-f3-showcase-page/check-page-wiring.mjs"
  "node --import tsx/esm contracts/checks/vendor-f3-showcase-page/check-intro-prose-renders.mjs"
  "node contracts/checks/vendor-f3-showcase-page/check-untouched-scope.mjs"
  "node contracts/checks/vendor-f3-showcase-page/check-responsive-grid-classes.mjs"
)

fail_count=0
for cmd in "${F3_CHECKS[@]}"; do
  echo "--- re-running F3 check: $cmd"
  if ! eval "$cmd"; then
    echo "FAIL: F3 regression -- '$cmd' no longer passes"
    fail_count=$((fail_count + 1))
  fi
done

if [[ $fail_count -gt 0 ]]; then
  echo ""
  echo "$fail_count F3 regression check(s) failed."
  exit 1
fi

echo "PASS (2/2): all F3 showcase-page checks still pass."
exit 0
