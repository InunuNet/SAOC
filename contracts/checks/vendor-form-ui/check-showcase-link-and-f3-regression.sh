#!/usr/bin/env bash
# A9 -- (a) the existing showcase page app/(marketing)/national-show/vendors/page.tsx links to
# the current public vendor entry route; (b) every one of F3's OWN assertion commands
# (contracts/contract-vendor-f3-showcase-page.yaml) still passes against the current repo state,
# proving this feature has not broken the shipped showcase page. Re-invokes F3's real check
# scripts directly (not a re-derivation of F3's logic) -- if F3's contract ever changes its own
# assertion set, this list must be updated to match; that drift is a known limitation, not
# silently masked (see README's "What this contract does NOT prove").
#
# UPDATED 2026-08-31 (vendor-gated-registration-flow F8, architect pass): the full registration
# form moved behind a single-use token gate (see contract-vendor-gated-registration-flow.yaml,
# A16/A17) and the showcase page's link was correctly repointed from
# /national-show/vendors/register (now reachable ONLY via an emailed token link, never from any
# public page) to /national-show/vendors/apply (the new short public application). This check
# previously asserted the OLD target and would now demand the F7/F8 defect back -- part (a) is
# rewritten below to assert the NEW target and to positively forbid the gated route appearing on
# this page. Part (b) (the F3 regression re-run) is untouched -- that guarantee never depended on
# which route the link pointed at.
#
# DEFEATING MUTATION: the showcase page linking anywhere other than
# /national-show/vendors/apply, or linking to /national-show/vendors/register at all; any edit to
# components/vendors/VendorGrid.tsx, VendorIntro.tsx, VendorEmptyState.tsx, sanity/queries.ts's
# vendorNurseriesQuery, or app/(marketing)/national-show/vendors/page.tsx/loading.tsx that
# regresses F3's own behaviour.
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

if ! grep -Eq 'href="/national-show/vendors/apply"|href=\x27/national-show/vendors/apply\x27' "$SHOWCASE_PAGE"; then
  echo "FAIL: $SHOWCASE_PAGE has no <Link href=\"/national-show/vendors/apply\"> to the public vendor application"
  exit 1
fi

if grep -Eq 'href="/national-show/vendors/register"|href=\x27/national-show/vendors/register\x27' "$SHOWCASE_PAGE"; then
  echo "FAIL: $SHOWCASE_PAGE still links to /national-show/vendors/register -- that route is gated (F7) and must never be linked from a public page (F8)"
  exit 1
fi
echo "PASS (1/2): showcase page links to /national-show/vendors/apply and not to the gated /register route"

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
