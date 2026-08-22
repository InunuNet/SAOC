#!/usr/bin/env bash
# F3 (ozow-payment-provider) — A3, rescoped. A3 originally cross-checked two LIVE PAID orders'
# gateway fields against each other (README §2). That requires two paid orders; only PayFast's
# purchase (A2) has ever reached 'paid' — Ozow's has not, for the same external/vendor-side
# blocker documented in check-live-purchase-blocked.sh (A1-BLOCKED) and
# contracts/golden/ozow-m1-f3/README-addendum-blocked.md. A3 cannot be evaluated as originally
# written without fabricating a second paid order, which would defeat its purpose.
#
# This script does NOT silently drop A3. It re-verifies the precondition that makes the original
# cross-check inapplicable (no Ozow live-run artifact has reached allStepsPassed=true) and skips
# on that basis. The moment that precondition stops holding — a future Ozow run DOES reach
# allStepsPassed=true — this script fails loudly, forcing A3 back to its original two-order
# cross-check form instead of staying a stale skip forever.
#
# Exit 77 = skip (precondition for "A3 cannot run" confirmed true). Exit 1 = fail (either the
# precondition no longer holds — a paid Ozow order now exists and A3 must be restored — or the
# evidence needed to even check the precondition is missing/malformed).
set -uo pipefail

RUNS_DIR=".agent/memory/scratch/ozow-f3-live-runs"

[ -d "$RUNS_DIR" ] || { echo "FAIL: $RUNS_DIR does not exist — cannot verify A3's precondition"; exit 1; }

ozow_artifacts=("$RUNS_DIR"/ozow-*.json)
if [ ! -e "${ozow_artifacts[0]}" ]; then
  echo "FAIL: no ozow-*.json artifacts found in $RUNS_DIR — cannot verify A3's precondition"
  exit 1
fi

any_paid=0
checked=0
for f in "${ozow_artifacts[@]}"; do
  checked=$((checked + 1))
  all_passed=$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('allStepsPassed'))" "$f" 2>/dev/null) || {
    echo "FAIL: $f is not valid JSON"
    exit 1
  }
  if [ "$all_passed" = "True" ]; then
    any_paid=1
  fi
done

if [ "$any_paid" = "1" ]; then
  echo "FAIL: an Ozow live-run artifact now shows allStepsPassed=true — a second paid order may now exist. A3's original two-order cross-check (gateway fields differ and each matches its own provider) must be restored instead of skipped."
  exit 1
fi

echo "SKIP (documented): checked $checked Ozow live-run artifact(s), none reached allStepsPassed=true — no second paid order exists to cross-check against A2's PayFast order. A3 as originally scoped (two paid orders, gateways differ) cannot be evaluated. See A1-BLOCKED and contracts/golden/ozow-m1-f3/README-addendum-blocked.md for why."
exit 77
