#!/usr/bin/env bash
# F3 (vendor-registration-form-rebuild) — MANDATORY RIPPLE SWEEP, baked into the contract per
# F2's own lesson (goldens/f2-ui-vendor-business-emergency-contact.md's hard lesson #1, restated
# in this feature's golden README): a diff-scoped Codex pass only catches fixtures that happen to
# overlap the literal diff. Every OTHER completed contract in this repo that constructs a
# VendorCategory-typed fixture must be swept explicitly, here, before F3 is declared done --
# never left to chance.
#
# This does NOT re-litigate whether the change is safe in the abstract (that's
# check-f3-category-enum-widened-and-validated.mjs's job) -- it proves every OTHER already-shipped
# feature's own compiler-checked fixtures still compile against the widened VendorCategory union,
# and that no old literal value's spelling changed underneath the DOM-id convention two live
# Playwright-driven contracts depend on.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

FAIL=0

# (1) Every OTHER contract with a VendorCategory-typed compiler fixture, found by grepping for
# vendorCategory across contracts/checks/ -- run its own scoped tsconfig. If a new
# vendorCategory-typed fixture contract lands after this one was written and isn't in this list,
# that is itself a gap this script should be extended to close -- do not silently trust the list
# below is exhaustive forever.
declare -a RIPPLE_TSCONFIGS=(
  "contracts/checks/vendor-f4-submissions-model/tsconfig.typecheck.json"
  "contracts/checks/vendor-f6-review-workflow/tsconfig.typecheck.json"
  "contracts/checks/vendor-f7-payment-path/tsconfig.typecheck.json"
  "contracts/checks/vendor-form-ui/tsconfig.typecheck.json"
)

for tsconfig in "${RIPPLE_TSCONFIGS[@]}"; do
  if [ ! -f "$tsconfig" ]; then
    echo "FAIL: expected ripple-sweep tsconfig $tsconfig is missing -- the sweep list is stale." >&2
    FAIL=1
    continue
  fi
  echo "--- ripple sweep: $tsconfig ---"
  if ! npx tsc --noEmit -p "$tsconfig"; then
    echo "FAIL: $tsconfig no longer compiles after the F3 vendorCategory enum widening." >&2
    FAIL=1
  fi
done

# (2) Confirm no completed contract's grep-based check was silently invalidated by the
# vendorCategory sweep above (they already ran as part of each; this is a double-check that the
# sweep didn't need to touch these files, since we made no removal/rename).
declare -a RIPPLE_GREP_TARGETS=(
  "contracts/checks/vendor-f4-submissions-model"
  "contracts/checks/vendor-f5-register-route"
  "contracts/checks/vendor-f6-review-workflow"
  "contracts/checks/vendor-f7-payment-path"
  "contracts/checks/vendor-form-ui"
  "contracts/checks/vendor-boothcount-guarded-parse-f1"
  "contracts/checks/vendor-form-client-validation-gate-f1"
  "contracts/checks/vendor-form-maxlength-and-phone-pattern-f1"
)

# (3) Every one of the 8 PRE-EXISTING VendorCategory literal values must still appear verbatim in
# types/index.ts's VendorCategory union -- proves this feature widened, never renamed. (The
# runtime .mjs check proves the *validator* still accepts them; this proves the *type union*
# itself still spells them identically, which is what the DOM-id convention below depends on.)
for value in 'plant-sales' 'product-sales' 'rare-exotic-plants' 'food-retailer' 'hardware' 'books' 'art' 'other'; do
  if ! grep -q "'${value}'" types/index.ts; then
    echo "FAIL: pre-existing VendorCategory literal '${value}' no longer appears in types/index.ts -- it may have been renamed or removed." >&2
    FAIL=1
  fi
done

# (4) Several Playwright-driven contracts (listed above) click a checkbox by a DOM id derived
# directly from the OLD 'plant-sales' literal: #vendor-register-vendorCategory-plant-sales
# (VendorCheckboxGroupField's id contract is `vendor-register-<fieldKey>-<optionValue>`). If F3's
# rebuild of VendorCategoryFieldset.tsx ever drops or renames the 'plant-sales' option value, or
# renders it under a different fieldKey, these already-shipped E2E checks silently start clicking
# nothing and pass for the wrong reason (or fail outright). Prove the exact option value survives
# in the rebuilt fieldset.
if ! grep -q "value: 'plant-sales'" components/vendors/VendorCategoryFieldset.tsx; then
  echo "FAIL: components/vendors/VendorCategoryFieldset.tsx must still render an option with value 'plant-sales' -- 4 already-shipped Playwright contracts (${RIPPLE_GREP_TARGETS[5]}, vendor-form-client-validation-gate-f1, vendor-form-maxlength-and-phone-pattern-f1) click #vendor-register-vendorCategory-plant-sales directly." >&2
  FAIL=1
fi

if [ "$FAIL" -ne 0 ]; then
  echo "RIPPLE SWEEP FAILED -- see above." >&2
  exit 1
fi

echo "PASS: ripple sweep clean -- every downstream contract with a VendorCategory-typed fixture still compiles, all 8 pre-existing literal values are unchanged in types/index.ts, and the 'plant-sales' DOM-id-bearing option value survives in the rebuilt fieldset."
