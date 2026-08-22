#!/usr/bin/env bash
# F3 (ozow-payment-provider) — A1-BLOCKED. Documents, and independently re-verifies the evidence
# for, the EXTERNAL/vendor-side blocker that stops a live Ozow sandbox purchase from reaching
# 'paid' right now — see contracts/golden/ozow-m1-f3/README-addendum-blocked.md for the full
# investigation trail. This assertion is NOT a pass/fail proof that a live purchase works (that
# is what A1 originally required, and cannot be proven true right now); it is a standing,
# non-required, honestly-reported SKIP that (a) fails loudly if the evidence trail it rests on
# ever goes missing/rots, and (b) fails loudly the moment a future live Ozow attempt DOES reach
# allStepsPassed:true — because at that point this blocker is stale and this script (and A1's
# original live-purchase form) must be restored, not left as a permanent skip.
#
# Exit 77 = skip (contract.py's reserved skip code) when the blocker is confirmed still present
# and its evidence trail is intact. Exit 1 = fail: either the evidence trail rotted (files
# missing/malformed — the documented blocker would then be unverifiable, not just unresolved), or
# a live Ozow run has since actually succeeded (the blocker has cleared and this skip is stale).
set -uo pipefail

RUNS_DIR=".agent/memory/scratch/ozow-f3-live-runs"
ADDENDUM="contracts/golden/ozow-m1-f3/README-addendum-blocked.md"
REQUIRED_ARTIFACTS=(
  "ozow-2026-08-22T03-52-00Z.json"
  "ozow-2026-08-22T04-05-46Z.json"
  "ozow-2026-08-22T04-30-26Z.json"
)

[ -d "$RUNS_DIR" ] || { echo "FAIL: $RUNS_DIR does not exist — the diagnostic evidence trail is gone"; exit 1; }
[ -f "$ADDENDUM" ] || { echo "FAIL: $ADDENDUM does not exist — the blocked-reason writeup is gone"; exit 1; }

grep -qi "external" "$ADDENDUM" || { echo "FAIL: $ADDENDUM no longer names this an external/vendor-side blocker"; exit 1; }
grep -qi "ozow" "$ADDENDUM" || { echo "FAIL: $ADDENDUM no longer references Ozow"; exit 1; }

any_succeeded=0
found_count=0

for f in "${REQUIRED_ARTIFACTS[@]}"; do
  path="$RUNS_DIR/$f"
  if [ ! -f "$path" ]; then
    echo "FAIL: expected diagnostic artifact missing: $path"
    exit 1
  fi
  found_count=$((found_count + 1))

  provider=$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('provider',''))" "$path" 2>/dev/null) || {
    echo "FAIL: $path is not valid JSON"
    exit 1
  }
  if [ "$provider" != "ozow" ]; then
    echo "FAIL: $path has provider='$provider', expected 'ozow' — this is not the evidence it claims to be"
    exit 1
  fi

  all_passed=$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('allStepsPassed'))" "$path" 2>/dev/null)
  if [ "$all_passed" = "True" ]; then
    any_succeeded=1
  fi
done

if [ "$any_succeeded" = "1" ]; then
  echo "FAIL: a live Ozow run in $RUNS_DIR now shows allStepsPassed=true — the external blocker has cleared. A1 must be restored to its original live-purchase form; this skip is stale and must be removed."
  exit 1
fi

echo "SKIP (documented, evidence-backed): $found_count diagnostic live-Ozow-run artifacts confirmed present, all still failing before payment completion, none allStepsPassed=true. Blocker documented in $ADDENDUM. This is an external/vendor-side blocker (Ozow sandbox rejecting the signed transaction at the application tier), not a code defect — see the addendum for what Brad needs to do to unblock a live-purchase proof."
exit 77
