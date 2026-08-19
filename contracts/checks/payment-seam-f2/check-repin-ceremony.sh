#!/usr/bin/env bash
# A2 + A3 — THE TWO-STEP RE-PIN CEREMONY. Deliberately two steps, not one, because the four
# existing pins of app/api/tickets/itn/route.ts are stale for a DIFFERENT reason than F2's rewire
# will make them stale, and collapsing the two would erase that distinction permanently.
#
#   STEP 1 (A2) — CATCH-UP AUDIT. Before F2 touched anything, the route on disk was a71f9505… while
#     the four contracts pinned 253c15c4… / 553f67d8…. The team lead reviewed that drift on
#     2026-08-19 and ruled the on-disk content the INTENDED baseline: it is the 2026-08-18
#     source-IP "logged, not enforced" change, deliberate and documented in the route's own
#     comment, simply never re-pinned. Step 1 proves that ruling against an IMMUTABLE artefact —
#     the git blob 8b8a3f71… that was HEAD's version of the route at the moment F2 began — so the
#     claim stays checkable forever, long after HEAD has moved past F2.
#
#   STEP 2 (A3) — THE F2 RE-PIN. The route becomes byte-identical to
#     contracts/golden/payment-seam-f2/itn-route.expected.ts.txt, an architect-authored file
#     written BEFORE any code was changed and verified to compile and lint against the
#     PaymentProvider interface. @dev never computes a pin value; the only route to a green A3 is
#     to make the source byte-identical to a file @dev did not author. All four downstream
#     contracts are then updated to that same new value.
#
# WHAT MAKES STEP 1 FAIL: the baseline blob not hashing to a71f9505… — i.e. the drift the team lead
# reviewed was not the only change in that file, and something else rode in alongside it.
# WHAT MAKES STEP 2 FAIL: the route not matching the expected file byte-for-byte; any of the four
# downstream .sha256 goldens left at an old value, which would leave that contract silently red.
#
# Run as: bash contracts/checks/payment-seam-f2/check-repin-ceremony.sh
set -uo pipefail

G=contracts/golden/payment-seam-f2
ROUTE=app/api/tickets/itn/route.ts
status=0

BASELINE_SHA=$(cat "$G/itn-route.baseline-2026-08-18.sha256")
BASELINE_BLOB=$(cat "$G/itn-route.baseline-2026-08-18.blob")
NEW_SHA=$(cat "$G/itn-route.golden.sha256")

# --- STEP 1: the catch-up audit, against the immutable git blob. -------------------------------
if ! git cat-file -e "$BASELINE_BLOB" 2>/dev/null; then
  echo "FAIL A2: git blob $BASELINE_BLOB is not present in this repository — the reviewed"
  echo "         2026-08-18 baseline cannot be audited. Do NOT proceed with the re-pin."
  status=1
else
  actual_baseline=$(git cat-file blob "$BASELINE_BLOB" | shasum -a 256 | cut -d' ' -f1)
  if [ "$actual_baseline" != "$BASELINE_SHA" ]; then
    echo "FAIL A2: the reviewed baseline blob does not hash to the recorded value."
    echo "         expected $BASELINE_SHA"
    echo "         actual   $actual_baseline"
    status=1
  else
    echo "  step 1 OK: reviewed 2026-08-18 baseline (blob $BASELINE_BLOB) = $BASELINE_SHA"
  fi
fi

# --- Non-vacuity: the two values must differ, or the ceremony's two steps are the same step. ----
if [ "$BASELINE_SHA" = "$NEW_SHA" ]; then
  echo "FAIL A2/A3: the pre-F2 baseline and the post-F2 pin are identical, so F2 changed nothing"
  echo "            about this route — the rewire did not happen."
  status=1
fi

# --- STEP 2: the route matches the architect-authored expected file. ---------------------------
if [ ! -f "$ROUTE" ]; then
  echo "FAIL A3: $ROUTE does not exist."
  exit 1
fi
actual_route=$(shasum -a 256 "$ROUTE" | cut -d' ' -f1)
expected_file_sha=$(shasum -a 256 "$G/itn-route.expected.ts.txt" | cut -d' ' -f1)

if [ "$expected_file_sha" != "$NEW_SHA" ]; then
  echo "FAIL A3: the expected file has been edited since the pin was authored."
  echo "         $G/itn-route.expected.ts.txt hashes to $expected_file_sha"
  echo "         but $G/itn-route.golden.sha256 records $NEW_SHA."
  echo "         Only @architect re-authors this pair, and always together."
  status=1
fi
if [ "$actual_route" != "$NEW_SHA" ]; then
  echo "FAIL A3: $ROUTE is not byte-identical to the architect-authored expected file."
  echo "         expected $NEW_SHA"
  echo "         actual   $actual_route"
  status=1
fi

# --- STEP 2b: every downstream pin of this file carries the NEW value. -------------------------
# DISCOVERED, NOT ENUMERATED. This step used to hold a hardcoded list of four .sha256 goldens. All
# four were updated correctly, this step went green — and contract-ticketing-hardening's A33, which
# pins the SAME file by diff against an .expected.ts.txt, stayed red. The check asserted its own
# completeness while being incomplete. The list is gone; the pin set now comes from
# discover_route_pins.py, which reads every contract's assertion commands through a YAML parser.
PINS=$(python3 contracts/checks/payment-seam-f2/discover_route_pins.py "$ROUTE" \
  | grep -E "^(SHA256|DIFF)\|" || true)

if [ -z "$PINS" ]; then
  echo "FAIL A3: discovery found NO golden-backed pin for $ROUTE. Either the file moved or"
  echo "         discovery has broken; a green verdict here would be meaningless."
  status=1
else
  while IFS='|' read -r kind contract assertion golden _target; do
    [ -z "$kind" ] && continue
    if [ ! -f "$golden" ]; then
      echo "FAIL A3: $contract $assertion pins $golden, which does not exist."
      status=1
      continue
    fi
    case "$kind" in
      SHA256)
        value=$(cat "$golden")
        if [ "$value" != "$NEW_SHA" ]; then
          echo "FAIL A3: $contract $assertion — $golden reads $value"
          echo "         and must be updated to $NEW_SHA, or that contract goes silently red."
          status=1
        fi
        ;;
      DIFF)
        if ! diff -q "$ROUTE" "$golden" >/dev/null 2>&1; then
          echo "FAIL A3: $contract $assertion — $golden is a full expected copy that no longer"
          echo "         matches $ROUTE. See contracts/golden/payment-seam-f2/broken-by-rewire.ledger"
          echo "         for its declared disposition."
          status=1
        fi
        ;;
    esac
  done <<< "$PINS"
fi

if [ "$status" -eq 0 ]; then
  echo "PASS A2/A3: reviewed baseline audited against its immutable blob; route re-pinned to the"
  echo "            architect-authored expected file; all four downstream pins carry the new value."
fi
exit "$status"
