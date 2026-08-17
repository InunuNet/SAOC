#!/usr/bin/env bash
# F9 (ticketing-foundation) — door admission parity, STRUCTURAL ONLY. See golden README
# "Door admission parity — what this contract does NOT prove" for why: lib/checkin.ts's
# admit() takes a live Firestore Transaction (db.collection(...).where(...).limit(1) chained
# on a real getFirestore(initAdmin()) call), which cannot be faked in-memory without
# reimplementing a large slice of the Firestore SDK's query-builder chain, and no local
# Firestore emulator is pinned in this repo (firebase.json has no emulators block;
# firebase-tools is not a pinned dependency). This check catches an accidental future
# special-case (the naive first move if someone wanted to treat demo tickets differently at
# the door) but does NOT prove the demo ticket type admits/refuses identically end to end —
# that is F12's live, human proof, on a real deployed host against real Firestore.
#
# Run as: bash contracts/checks/ticketing-f9-demo-ticket/check-door-admission-no-special-case.sh

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
FILE="${REPO_ROOT}/lib/checkin.ts"

if [ ! -f "$FILE" ]; then
  echo "FAIL: ${FILE} not found." >&2
  exit 1
fi

# Extract admit()'s function body only (from its signature to its closing brace at column 0).
BODY="$(sed -n '/^async function admit(/,/^}/p' "$FILE")"

if [ -z "$BODY" ]; then
  echo "FAIL: could not locate admit()'s function body in ${FILE} — the function may have been renamed or restructured; update this check's sed range to match the current shape." >&2
  exit 1
fi

if echo "$BODY" | grep -q "ticketType"; then
  echo "FAIL: admit()'s decision logic in lib/checkin.ts references 'ticketType' — a demo ticket type would then risk being treated differently at the door than a real one. See golden README." >&2
  echo "--- matching lines ---" >&2
  echo "$BODY" | grep -n "ticketType" >&2
  exit 1
fi

echo "PASS (structural only): admit()'s decision logic in lib/checkin.ts never branches on 'ticketType' — consistent with a demo ticket admitting/refusing identically to a real one. This is NOT a behavioural proof; see golden README 'Door admission parity — what this contract does NOT prove'. F12's live human proof is where this becomes a real end-to-end claim."
exit 0
