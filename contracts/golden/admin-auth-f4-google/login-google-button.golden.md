# Golden spec — Google sign-in on `app/admin/login/page.tsx` (F4)

## Required behaviour

- Add a "Sign in with Google" button alongside the existing email/password form (the password
  form is NOT removed — F1/F2's password-based fixture accounts and any committee member without
  a Google account still need it).
- On click: construct `new GoogleAuthProvider()` from `firebase/auth`, call
  `signInWithPopup(auth, provider)` (popup preferred for this desktop-oriented admin surface;
  `signInWithRedirect` is acceptable and handled by the same downstream code if used instead —
  see Firebase's own redirect best-practices doc referenced in `README.md`'s research).
- On success, obtain `userCredential.user.getIdToken()` and **POST it to the existing
  `/api/admin/session` route** — the exact same call the password path already makes. Do not add
  a second session-mint endpoint or duplicate the fetch logic; both paths should converge on one
  function that takes an idToken and does the POST + redirect-to-`/admin` + error handling.
- On failure (including a 403 from `/api/admin/session` because the identity isn't allowlisted,
  isn't admin-claimed, or isn't verified), show the SAME kind of inline error the password path
  already shows. Do not leak which specific `reason` the gate returned to the browser — that
  stays server-side/log-only, per `docs/admin-access.md`'s existing "Reading the reason field"
  guidance.
- This file remains a client component (`'use client'`) importing only from `firebase/auth` (the
  client SDK) and `@/lib/firebase` — never `firebase-admin`, which must never ship to the
  browser.

## What must NOT happen

- No new API route. No provider-specific branch inside `/api/admin/session` or
  `lib/admin-auth.ts` (see F4 `A-STRUCT-01`, a regression guard on those two files staying
  provider-agnostic).
- No client-side allowlist or claim check — the gate's server-side decision is the only one that
  counts, exactly as today.

## How `A-STRUCT-02` verifies "converge on one function" (tightened 2026-08-15)

A @qa robustness finding on the first version of this check: it counted occurrences of the
literal string `/api/admin/session` anywhere in the file and required at least one. That would
still PASS an implementation where the Google branch posted to a different endpoint entirely, as
long as an unrelated `/api/admin/session` string survived somewhere else in the file (a comment,
or the password path alone) — a string count cannot tell "both providers converge on the session
route" apart from "the string appears in the file."

`check-login-google-structural.sh` now asserts the convergence property directly instead:
exactly one `fetch(` call site in the whole file (not "at least one match of a string"), that
lone call site targets `/api/admin/session`, and at least two `await mintSession(` invocations
(distinguished from the shared function's own declaration line, which carries no `await`
prefix) — proving both handlers actually call the convergence function, not merely that the
function is defined somewhere.

Proof this rejects the broken shape: a scratch copy of `app/admin/login/page.tsx` was built where
`handleGoogleSignIn` posts directly to `/api/admin/google-session` instead of calling
`mintSession()`, while the stray comment mentioning `/api/admin/session` was left in place
unchanged. Against that scratch copy the tightened check reports 2 `fetch(` call sites (expected
1) and 1 `await mintSession(` invocation (expected >= 2) — FAIL on both new assertions, correctly
rejecting a shape the old check would have passed. Run against the real, shipped
`app/admin/login/page.tsx` (one `fetch(` call, targeting `/api/admin/session`, two
`await mintSession(` invocations), the tightened check PASSes.
