#!/usr/bin/env bash
# F4: PAYMENT_GATEWAYS_SANDBOX_ONLY may only be false once no payment adapter is sandbox-only.
# Exit 0 when consistent, 1 when an adapter is still sandbox-only while the flag says live.
set -u
f=lib/ticket-issuance-mode.ts
grep -qE '^export const PAYMENT_GATEWAYS_SANDBOX_ONLY = (true|false);$' "$f" || { echo "flag missing or malformed in $f"; exit 1; }
if grep -q '^export const PAYMENT_GATEWAYS_SANDBOX_ONLY = true;$' "$f"; then exit 0; fi
if grep -qE "OZOW_IS_TEST = 'true'|PAYFAST_SANDBOX_PROCESS_URL|OZOW_SANDBOX_PRIVATE_KEY" lib/payments/ozow.ts lib/payments/payfast.ts; then
  echo "an adapter is still sandbox-only but PAYMENT_GATEWAYS_SANDBOX_ONLY is false"; exit 1
fi
