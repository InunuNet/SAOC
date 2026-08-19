#!/usr/bin/env bash
# A8 — lib/payments/types.ts IS GATEWAY-NEUTRAL.
#
# The whole point of the seam is that the interface is drawn against three real gateways (PayFast,
# Ozow, Peach) and not against PayFast alone. If PayFast's vocabulary leaks into the interface
# file, the "abstraction" is PayFast wearing a coat and the second gateway will require reopening
# it — which is the exact outcome this mission exists to prevent. This is the F1-scoped half of
# F2's route-wide ban.
#
# WHAT MAKES THIS FAIL: the file not existing (pre-move — step 1 hard-fails); any PayFast-specific
# identifier appearing in it. Observe it failing by adding `m_payment_id` to a comment in
# lib/payments/types.ts and re-running — it must go red.
#
# Run as: bash contracts/checks/payment-seam-f1/check-interface-gateway-neutral.sh
set -uo pipefail

TYPES="lib/payments/types.ts"

# 1. Positive control FIRST. Without this, a deleted file would satisfy every ban below.
if [ ! -f "$TYPES" ]; then
  echo "FAIL A8: $TYPES does not exist — the interface has not been created."
  exit 1
fi
if ! grep -q "interface PaymentProvider" "$TYPES"; then
  echo "FAIL A8: $TYPES exists but declares no PaymentProvider interface."
  exit 1
fi

# 2. Every PayFast-specific token that must not appear in a gateway-neutral file.
#
#    BOTH CASINGS, deliberately. An earlier version of this list matched only the snake_case wire
#    names, and @qa defeated it empirically during F1 review by adding `readonly merchantId`,
#    `readonly pfPaymentId` and `readonly amountGross` to types.ts — step 2 passed all three. In a
#    TypeScript interface camelCase is the LIKELIER leak shape, because that is simply how one
#    writes a property here. That is exactly how the seam becomes PayFast wearing a coat with this
#    assertion still green, so the camelCase forms are now first-class entries, not an afterthought.
VOCAB='m_payment_id|pf_payment_id|amount_gross|amount_fee|amount_net|merchant_key|merchant_id|mPaymentId|pfPaymentId|amountGross|amountFee|amountNet|merchantKey|merchantId|passphrase|eng/process|eng/query|sandbox\.payfast|itn\b|md5'

# The interface file additionally may not name the vendor at all.
BANNED="payfast|$VOCAB"

FOUND=$(grep -nEi "$BANNED" "$TYPES" || true)
if [ -n "$FOUND" ]; then
  echo "FAIL A8: PayFast-specific vocabulary found in the gateway-neutral interface file:"
  echo "$FOUND"
  exit 1
fi

# 3. Every OTHER file under lib/payments/ is gateway-neutral too — with one adjudicated exception
#    for the selection point.
#
#    WHY index.ts IS TREATED SEPARATELY (do not "fix" this back to a blanket ban):
#    The property this step protects is *no gateway-specific vocabulary leaks into neutral files*.
#    It is NOT *the vendor's name never appears at the one place we select the vendor*. A selection
#    point must name what it selects — that is what a selection point IS — and the interface golden
#    mandates `export const paymentProvider: PaymentProvider = payfastProvider`, which cannot exist
#    without naming both the symbol and its module. A blanket ban here is unsatisfiable by any
#    correct implementation, and step 5 below independently REQUIRES this file to exist and export
#    that binding.
#
#    So index.ts is held to something STRICTER THAN AN EXEMPTION rather than waved through: the
#    only two permitted forms of the vendor's name are the identifier `payfastProvider` and the
#    module specifier './payfast'. Both are stripped, and ANY remaining occurrence fails. Counting
#    occurrences was considered and rejected — the file legitimately contains three across two
#    lines today, and a literal count breaks on reformatting or an added re-export while still
#    permitting a genuine leak that happens to fit the budget. Requiring every match to sit on an
#    `import` line was also rejected: it fails correct code, because the assignment on the
#    `export const` line is not an import. The stripping form survives both and still fires the
#    moment real PayFast detail (a URL, an env var, a wire field) lands in the selection file.
for f in lib/payments/*.ts; do
  [ "$f" = "lib/payments/payfast.ts" ] && continue

  vocab_hits=$(grep -nEi "$VOCAB" "$f" || true)
  if [ -n "$vocab_hits" ]; then
    echo "FAIL A8: gateway-specific vocabulary in the neutral file $f:"
    echo "$vocab_hits"
    exit 1
  fi

  if [ "$f" = "lib/payments/index.ts" ]; then
    residue=$(sed -E "s/payfastProvider//g; s/'\.\/payfast'//g" "$f" | grep -nEi 'payfast' || true)
    if [ -n "$residue" ]; then
      echo "FAIL A8: $f names PayFast beyond selecting it. Only the identifier 'payfastProvider'"
      echo "         and the module specifier './payfast' are permitted here; found:"
      echo "$residue"
      exit 1
    fi
  else
    named=$(grep -nEi 'payfast' "$f" || true)
    if [ -n "$named" ]; then
      echo "FAIL A8: the neutral file $f mentions PayFast:"
      echo "$named"
      exit 1
    fi
  fi
done

# 4. NON-VACUITY: the ban above must be capable of firing. Prove the pattern matches by running it
#    against the adapter, which certainly does name PayFast.
if ! grep -qEi 'payfast' lib/payments/payfast.ts 2>/dev/null; then
  echo "FAIL A8: the banned-token pattern found nothing in lib/payments/payfast.ts either —"
  echo "         the check is not actually able to detect a leak. Green here would be false."
  exit 1
fi

# 5. Provider selection is ONE config point, not a registry. Packaging is explicitly deferred
#    (Brad, 2026-08-19): no plugin map, no dynamic import, no env-var switch in F1.
if [ ! -f lib/payments/index.ts ]; then
  echo "FAIL A8: lib/payments/index.ts (the single config point) does not exist."
  exit 1
fi
if ! grep -q 'paymentProvider' lib/payments/index.ts; then
  echo "FAIL A8: lib/payments/index.ts does not export a paymentProvider binding."
  exit 1
fi
# Comment lines are stripped first: the registry claim is about CODE. @dev's own header comment
# says "no registry, no map, no dynamic import, no PAYMENT_PROVIDER env switch" — an unfiltered
# grep fails the file for correctly documenting the very property being asserted, which is the
# same prose-defeats-the-check defect this contract exists to hunt.
REGISTRY=$(grep -vE "^[[:space:]]*(//|\*|/\*)" lib/payments/index.ts \
  | grep -nE "process\.env\.PAYMENT_PROVIDER|PAYMENT_PROVIDER|await import\(|require\(|Record<string, *PaymentProvider>|providers\[" || true)
if [ -n "$REGISTRY" ]; then
  echo "FAIL A8: lib/payments/index.ts looks like a provider registry. Packaging is deferred —"
  echo "         F1 selects one provider with one const."
  echo "$REGISTRY"
  exit 1
fi

echo "PASS A8: lib/payments/types.ts is gateway-neutral; only the adapter names PayFast;"
echo "         selection is a single config point."
