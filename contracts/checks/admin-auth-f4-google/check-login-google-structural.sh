#!/usr/bin/env bash
# A-STRUCT-02 (F4) — app/admin/login/page.tsx offers a Google sign-in path (GoogleAuthProvider
# + signInWithPopup or signInWithRedirect from 'firebase/auth', the client SDK — never
# firebase-admin here, this file ships to the browser) and that path converges with the
# password path on ONE session-mint call site — no second, parallel POST to any other route.
#
# TIGHTENED 2026-08-15 after a @qa robustness finding: the original version of this check
# counted occurrences of the literal string "/api/admin/session" anywhere in the file and
# required >= 1. That would still PASS an implementation where the Google branch POSTs to a
# DIFFERENT endpoint, as long as an unrelated "/api/admin/session" string survived somewhere
# else in the file — e.g. in a comment, or in the password path alone — because a literal-
# string count cannot distinguish "both providers converge on the session route" from "the
# string appears in the file." This version instead counts actual call sites:
#   1. Exactly ONE `fetch(` call in the whole file (not "at least one containing the string") —
#      a second, competing POST anywhere in the file changes this count.
#   2. That lone fetch( call's line targets the literal '/api/admin/session' route.
#   3. At least two `await mintSession(` INVOCATIONS (distinguished from the function's own
#      declaration line, which has no `await` prefix) — proving both the password and Google
#      handlers actually call the shared convergence function, not just that the function
#      exists somewhere in the file.
# A broken variant where the Google handler posts to a different route directly (bypassing
# mintSession) fails BOTH (1) — fetch( count becomes 2 — and (3) — mintSession invocation count
# drops to 1 — even if a stray "/api/admin/session" string remains elsewhere in the file. Proof
# this rejects that broken shape is recorded in the golden and was run manually against a
# scratch copy before this tightening shipped (see golden's own note).
set -euo pipefail

FILE="app/admin/login/page.tsx"
FAIL=0

if [ ! -f "$FILE" ]; then
  echo "FAIL: $FILE does not exist"
  exit 1
fi

if ! grep -q "GoogleAuthProvider" "$FILE"; then
  echo "FAIL: $FILE does not import/use GoogleAuthProvider"
  FAIL=1
fi

if ! grep -qE "signInWithPopup|signInWithRedirect" "$FILE"; then
  echo "FAIL: $FILE does not call signInWithPopup or signInWithRedirect for the Google path"
  FAIL=1
fi

if grep -q "from 'firebase-admin" "$FILE"; then
  echo "FAIL: $FILE imports firebase-admin — this is a client component, must use 'firebase/auth' only"
  FAIL=1
fi

FETCH_CALL_COUNT=$(grep -c "fetch(" "$FILE" || true)
if [ "$FETCH_CALL_COUNT" -ne 1 ]; then
  echo "FAIL: $FILE has $FETCH_CALL_COUNT fetch( call site(s), expected exactly 1 — a second call site means a provider is posting somewhere other than the shared session-mint function"
  FAIL=1
else
  FETCH_LINE=$(grep -n "fetch(" "$FILE")
  if ! echo "$FETCH_LINE" | grep -qF "/api/admin/session"; then
    echo "FAIL: the sole fetch( call site does not target /api/admin/session — $FETCH_LINE"
    FAIL=1
  fi
fi

MINT_INVOCATIONS=$(grep -c "await mintSession(" "$FILE" || true)
if [ "$MINT_INVOCATIONS" -lt 2 ]; then
  echo "FAIL: found only $MINT_INVOCATIONS 'await mintSession(' invocation(s), expected >= 2 (both the password and Google handlers must call the shared convergence function, not just define it)"
  FAIL=1
fi

if [ "$FAIL" -eq 0 ]; then
  echo "PASS: A-STRUCT-02 (F4) — Google sign-in path present, both handlers converge on exactly one session-mint call site"
fi

exit "$FAIL"
