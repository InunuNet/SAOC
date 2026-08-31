#!/usr/bin/env bash
# F4 (vendor-registration-form-rebuild) — MANDATORY RIPPLE SWEEP for the boothType BREAKING
# RENAME, baked into the contract per F2/F3's own lesson: a diff-scoped Codex pass only catches
# fixtures that happen to overlap the literal diff. A rename (unlike F3's pure widening) can
# silently break a fixture that never appears anywhere near this feature's own diff -- this
# sweep proves the exactly one known downstream occurrence is fixed and still compiles, not left
# to chance.
#
# This does NOT re-litigate whether the rename itself is correct (that's
# check-f4-boothtype-renamed-and-validated.mjs's job) -- it proves every OTHER already-shipped
# contract with a VendorBoothType-typed compiler fixture still compiles, and that no Playwright
# contract silently started depending on a boothType DOM id since F1's investigation.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

FAIL=0

# (1) The ONE known pre-existing occurrence of the literal 'standard' as a VendorBoothType-typed
# value (see goldens/f4-ui-booth-requirements-electricity-water.md's ripple-sweep section) must
# be gone -- @dev must have updated it to a still-valid post-rename member as part of this
# feature's own diff.
F8_FIXTURE="contracts/checks/vendor-f8-approval-email/fixtures/vendor-f8-approval-email-typecheck.ts"
if [ ! -f "$F8_FIXTURE" ]; then
  echo "FAIL: expected ripple-sweep target $F8_FIXTURE is missing -- the sweep list is stale." >&2
  FAIL=1
elif grep -q "boothType: 'standard'" "$F8_FIXTURE"; then
  echo "FAIL: $F8_FIXTURE still hardcodes boothType: 'standard', which no longer exists in VendorBoothType after this feature's rename. Update it to a valid post-rename member (e.g. 'standard-in-row')." >&2
  FAIL=1
fi

# (2) That fixture's own scoped tsconfig must still compile after the fix above.
F8_TSCONFIG="contracts/checks/vendor-f8-approval-email/tsconfig.typecheck.json"
if [ ! -f "$F8_TSCONFIG" ]; then
  echo "FAIL: expected ripple-sweep tsconfig $F8_TSCONFIG is missing -- the sweep list is stale." >&2
  FAIL=1
else
  echo "--- ripple sweep: $F8_TSCONFIG ---"
  if ! npx tsc --noEmit -p "$F8_TSCONFIG"; then
    echo "FAIL: $F8_TSCONFIG no longer compiles after the F4 boothType rename." >&2
    FAIL=1
  fi
fi

# (3) The two OTHER contracts with a boothType-touching compiler fixture, confirmed by
# investigation to be unaffected (one uses the unrenamed 'corner' literal, the other types
# boothType as a plain string, never the closed union) -- re-run anyway, belt-and-suspenders,
# rather than trusting "unaffected" without proof.
declare -a OTHER_TSCONFIGS=(
  "contracts/checks/vendor-f4-submissions-model/tsconfig.typecheck.json"
  "contracts/checks/vendor-form-ui/tsconfig.typecheck.json"
)

for tsconfig in "${OTHER_TSCONFIGS[@]}"; do
  if [ ! -f "$tsconfig" ]; then
    echo "FAIL: expected ripple-sweep tsconfig $tsconfig is missing -- the sweep list is stale." >&2
    FAIL=1
    continue
  fi
  echo "--- ripple sweep: $tsconfig ---"
  if ! npx tsc --noEmit -p "$tsconfig"; then
    echo "FAIL: $tsconfig no longer compiles after the F4 boothType rename." >&2
    FAIL=1
  fi
done

# (4) The two unrenamed values must still appear verbatim in types/index.ts's VendorBoothType
# union, proving this was a targeted rename of 'standard' only, not a wider break.
for value in 'corner' 'end-of-row'; do
  if ! grep -q "'${value}'" types/index.ts; then
    echo "FAIL: pre-existing VendorBoothType literal '${value}' no longer appears in types/index.ts -- it may have been accidentally renamed or removed." >&2
    FAIL=1
  fi
done

# (5) The two new/renamed-target values must now appear.
for value in 'standard-in-row' 'no-preference'; do
  if ! grep -q "'${value}'" types/index.ts; then
    echo "FAIL: expected new VendorBoothType literal '${value}' does not appear in types/index.ts -- the rename/addition did not happen." >&2
    FAIL=1
  fi
done

# (6) The OLD value 'standard' must no longer appear as a VendorBoothType union member in
# types/index.ts's declaration line itself (a stray reference elsewhere, e.g. a comment
# documenting the rename, is fine -- this only checks the union type alias line).
if grep -n "^export type VendorBoothType" types/index.ts | grep -q "'standard'"; then
  echo "FAIL: types/index.ts's VendorBoothType union still contains the old 'standard' member -- this feature must RENAME it, not widen alongside it." >&2
  FAIL=1
fi

# (7) No Playwright-driven contract in this repo constructs a boothType DOM id
# (vendor-register-boothType-<value>) -- confirmed absent before this feature by investigation;
# re-confirm here so a future contract introducing one without extending this sweep is caught.
if grep -rq "vendor-register-boothType" --include="*.ts" --include="*.tsx" --include="*.mjs" contracts/ components/ 2>/dev/null; then
  echo "FAIL: a boothType DOM id reference (vendor-register-boothType-<value>) now exists somewhere in contracts/ or components/ -- this sweep's Playwright-independence assumption is stale and must be extended to cover it." >&2
  FAIL=1
fi

if [ "$FAIL" -ne 0 ]; then
  echo "RIPPLE SWEEP FAILED -- see above." >&2
  exit 1
fi

echo "PASS: ripple sweep clean -- the one known downstream 'standard' literal was fixed and its contract still compiles, the two other boothType-touching contracts still compile, 'corner'/'end-of-row' survive unrenamed, 'standard-in-row'/'no-preference' now exist, 'standard' itself is gone from the union, and no Playwright contract depends on a boothType DOM id."
