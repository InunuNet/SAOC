#!/usr/bin/env bash
# A9 — lib/ozow.ts AND lib/payments/ozow.ts MUST NOT NAME PAYFAST, AND MUST NOT IMPORT FROM IT.
# The two gateways are genuinely independent (different fields, different digest, different
# secret-placement convention — README.md §1); wiring or borrowing from PayFast's files here would
# be exactly the coupling contract-payment-seam-f1.yaml's own interface was built to prevent (a
# second gateway "wearing PayFast's coat"). Case-insensitive: PayFast's own vocabulary ban
# (contract-payment-seam-f1.yaml A8) found camelCase to be the likelier leak shape in a TypeScript
# file, so this checks both casings the same way.
#
# WHAT MAKES THIS FAIL: 'payfast'/'PayFast'/'PAYFAST' appearing anywhere in either file; an import
# from '../payfast', '../../payfast', './payfast', or 'lib/payfast' anywhere in either file. Step 1
# hard-fails if either file is absent, so this cannot pass vacuously.
#
# Run as: bash contracts/checks/ozow-m1-f1/check-payfast-vocabulary-boundary.sh
set -uo pipefail

FILES=("lib/ozow.ts" "lib/payments/ozow.ts")
status=0

for f in "${FILES[@]}"; do
  if [ ! -f "$f" ]; then
    echo "FAIL A9: $f does not exist."
    status=1
    continue
  fi
  if grep -qi "payfast" "$f"; then
    echo "FAIL A9: $f names PayFast — the two adapters must be independent."
    grep -ni "payfast" "$f"
    status=1
  fi
  if grep -Ei "from ['\"](\.\./)*payfast['\"]|from ['\"]@/lib/payfast['\"]|require\(['\"].*payfast" "$f" >/dev/null; then
    echo "FAIL A9: $f imports from a payfast module."
    status=1
  fi
done

# Non-vacuity: prove the ban pattern can actually fire, by running it against a synthetic fixture
# that DOES mention PayFast, rather than only ever seeing files that pass.
fixture=$(mktemp)
echo "import { payfastProvider } from '../payfast';" > "$fixture"
if ! grep -qi "payfast" "$fixture"; then
  echo "FAIL A9 (self-check): the ban pattern did not fire against a fixture that DOES mention payfast."
  status=1
fi
rm -f "$fixture"

[ "$status" -eq 0 ] && echo "PASS A9: lib/ozow.ts and lib/payments/ozow.ts name and import nothing PayFast-related."
exit "$status"
