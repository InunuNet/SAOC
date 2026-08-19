#!/usr/bin/env bash
# A12 — A11's OWN REGRESSION NET. Proves check-reject-paths-behavioural.mts can actually go red.
#
# WHY THIS IS A SEPARATE, WIRED ASSERTION AND NOT A ONE-OFF CEREMONY. This project has already
# been bitten twice by the gap this closes: payfast-m1's A18 sat green for a property that had
# been deleted from the product, and the A4 trailing-comment hardening had to be redone because
# the hardening itself was never mutation-tested. An assertion nobody has seen fail is not
# evidence, and an assertion that was seen to fail ONCE, months ago, by an agent nobody can now
# ask, is barely better. So the mutations live here, run every gate, and are counted.
#
# HOW IT MUTATES WITHOUT TOUCHING PRODUCTION CODE. Every mutant is GENERATED AT RUN TIME from
# the current contents of the real files into _mutants/ (gitignored scratch, rebuilt each run).
# Nothing under lib/ or app/ is ever written. Two consequences are deliberate:
#   - a mutant can never go stale against the real source, because it is derived from it; and
#   - if a substitution target is not found, this script FAILS rather than silently reporting a
#     clean detection against an unmutated copy. That failure mode — "N mutations, N detections,
#     none of them actually applied" — is exactly how a mutation suite becomes decorative.
# The unmutated copy is run FIRST as CONTROL and must be GREEN, which is what proves the
# copy-and-rewrite mechanism faithful enough for the mutant results to mean anything.
#
# Run as: bash contracts/checks/payment-seam-f2/check-reject-path-mutations.sh
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT" || exit 2

CHECK="contracts/checks/payment-seam-f2/check-reject-paths-behavioural.mts"
ADAPTER="lib/payments/payfast.ts"
ROUTE="app/api/tickets/itn/route.ts"
MUT_DIR="contracts/checks/payment-seam-f2/_mutants"

for f in "$CHECK" "$ADAPTER" "$ROUTE"; do
  if [ ! -f "$f" ]; then
    echo "FAIL A12: $f is missing — cannot generate mutants from a file that is not there."
    exit 1
  fi
done

rm -rf "$MUT_DIR"
mkdir -p "$MUT_DIR"
trap 'rm -rf "$MUT_DIR"' EXIT

# Build the mutant pair. $1 = adapter python-regex substitution (empty for none),
# $2 = route python-regex substitution (empty for none). Both are (pattern, replacement)
# pairs passed as two NUL-free lines through the environment.
build_mutant() {
  local a_pat="$1" a_rep="$2" r_pat="$3" r_rep="$4"
  A_PAT="$a_pat" A_REP="$a_rep" R_PAT="$r_pat" R_REP="$r_rep" \
  ADAPTER="$ADAPTER" ROUTE="$ROUTE" MUT_DIR="$MUT_DIR" python3 - <<'PY'
import os, sys

def rewrite(src, dst, pat, rep, import_fixups):
    text = open(src).read()
    for old, new in import_fixups:
        if old not in text:
            print(f"FAIL A12: import fixup target {old!r} not found in {src} — the mutant would not compile.")
            sys.exit(3)
        text = text.replace(old, new)
    if pat:
        if pat not in text:
            print(f"FAIL A12: mutation target not found in {src}:\n    {pat}\n"
                  "  The source has moved. This is reported as a FAILURE, never as a clean\n"
                  "  detection — a mutation that was never applied detects nothing.")
            sys.exit(3)
        if text.count(pat) != 1:
            print(f"FAIL A12: mutation target appears {text.count(pat)} times in {src}; it must be unique.")
            sys.exit(3)
        text = text.replace(pat, rep)
    open(dst, 'w').write(text)

mut = os.environ['MUT_DIR']
rewrite(os.environ['ADAPTER'], f"{mut}/payfast.ts", os.environ['A_PAT'], os.environ['A_REP'],
        [("} from './types';", "} from '@/lib/payments/types';")])
rewrite(os.environ['ROUTE'], f"{mut}/route.ts", os.environ['R_PAT'], os.environ['R_REP'],
        [("from '@/lib/payments';", "from './provider';")])
open(f"{mut}/provider.ts", 'w').write(
    "import { payfastProvider } from './payfast';\n"
    "import type { PaymentProvider } from '@/lib/payments/types';\n"
    "export const paymentProvider: PaymentProvider = payfastProvider;\n"
)
PY
}

run_mutant() {
  A11_ROUTE_IMPORT_OVERRIDE="$ROOT/$MUT_DIR/route.ts" npx tsx "$CHECK" >/dev/null 2>&1
  echo $?
}

status=0
detected=0
total=0

# ---- CONTROL: an unmutated copy, driven through the same override path. Must be GREEN. If this
# is red the mutant scaffolding is broken and every "detection" below is an artefact of the
# scaffolding rather than of the mutation.
if ! build_mutant "" "" "" ""; then exit 1; fi
control=$(run_mutant)
if [ "$control" -ne 0 ]; then
  echo "FAIL A12: CONTROL (unmutated copy) exited $control, expected 0. The mutant scaffolding"
  echo "         itself breaks the check, so no mutation result below would be attributable to"
  echo "         the mutation. Fix the scaffolding before reading anything else."
  exit 1
fi
echo "  CONTROL (unmutated copy through the override): exit 0 — scaffolding faithful."

mutate() {
  local label="$1"; shift
  total=$((total + 1))
  if ! build_mutant "$@"; then status=1; return; fi
  local rc
  rc=$(run_mutant)
  if [ "$rc" -ne 0 ]; then
    detected=$((detected + 1))
    echo "  KILLED  ($rc)  $label"
  else
    echo "  SURVIVED (0)  $label"
    echo "           ^ A11 is green against code that does NOT have the property A11 claims to"
    echo "             assert. Do not trust A11 until this is red."
    status=1
  fi
}

echo "--- mutating the adapter's refusal paths and the route's refusal branch"

# M1 — the unset-secret guard is deleted. The digest is then computed with an undefined
# passphrase, so the body is refused for the WRONG reason (signature-mismatch), sending an
# operator to debug the gateway for a fault in our own configuration. Kills only because A11
# pins the exact reason code, not merely that a refusal happened.
mutate "M1 unset-secret guard deleted (refusal reason degrades to signature-mismatch)" \
  "      if (!passphrase) {
        console.error('[payments/payfast] Missing PAYFAST_SANDBOX_PASSPHRASE — rejecting.');
        return { verified: false, reason: 'not-configured', reference };
      }" \
  "      // guard removed by A12 M1" \
  "" ""

# M2 — the absent-signature guard is deleted: absent is treated as "nothing to compare".
mutate "M2 absent-signature guard deleted" \
  "      if (!receivedSignature) {
        return { verified: false, reason: 'missing-signature', reference };
      }" \
  "      // guard removed by A12 M2" \
  "" ""

# M3 — signature comparison always succeeds. A forged body verifies and the handler walks on to
# the order. This is the mutation that makes the order-lookup marker earn its place.
mutate "M3 signature comparison neutered (every body verifies)" \
  "      if (generateNotifySignature(fields, passphrase) !== receivedSignature) {" \
  "      if (false) {" \
  "" ""

# M4 — the route keeps the guard and the diagnostic but loses the return: the refusal branch is
# gutted while still looking, to a window-scoped reader, exactly like a refusal. This is the
# proximity-is-not-attribution shape that already defeated one assertion on this contract.
mutate "M4 route's refusal branch gutted — logs, does not return" \
  "" "" \
  "    return acknowledge();
  }

  const { notification } = verification;" \
  "  }

  const { notification } = verification;"

# M5 — verifyNotification refuses EVERYTHING. Cases 1-3 alone would call this a pass; only the
# positive control kills it. This mutation is the reason case 4 exists.
mutate "M5 verifyNotification refuses unconditionally (kills every real payment)" \
  "      const { fields, signature: receivedSignature } = parseOrderedFields(request.rawBody);" \
  "      const { fields, signature: receivedSignature } = parseOrderedFields(request.rawBody);
      if (receivedSignature !== undefined) {
        return { verified: false, reason: 'signature-mismatch', reference: null };
      }" \
  "" ""

echo
if [ "$status" -eq 0 ]; then
  echo "PASS A12: $detected/$total mutations killed by A11, and the unmutated control ran green."
else
  echo "FAIL A12: $detected/$total mutations killed. A11 is not trustworthy while any survived."
fi
exit "$status"
