# `app/api/admin/session/route.ts` — refuse to mint for a non-admin identity

This is the highest-severity fix in F1: today this route mints a session cookie for ANY
valid `idToken`, admin or not. It is the sole choke point through which every browser
session is created, so closing it here is the cleanest single fix — but the per-route
checks (`lib/admin-auth.ts` in the other five surfaces) MUST remain regardless; this is
defence in depth, not a replacement for them.

## Required behaviour

1. Parse `idToken` from the request body exactly as today (400 if missing/not a
   string — unchanged).
2. Verify it with `getAuth(initAdmin()).verifyIdToken(idToken, /* checkRevoked */
   true)`. (Today's code skips straight to `createSessionCookie`, which does not itself
   decode/validate claims the same way — verifying first is what makes step 3 possible.)
   On verification failure: 401, no cookie set — unchanged from today's catch-all.
3. Call `isAdminToken(decodedIdToken)` from `lib/admin-auth.ts`. If `false`: **403**,
   response body an error object (e.g. `{ error: 'Forbidden' }`), and
   `createSessionCookie` must NEVER be called — the whole point is that no cookie is
   minted for a refused identity. No `Set-Cookie` header may appear on this response.
4. Only if `isAdminToken` returns `true`: proceed to `createSessionCookie` and
   `cookieStore.set('session', …)` exactly as today (unchanged — `httpOnly`, `secure`,
   `sameSite: 'strict'`, `SESSION_DURATION_MS`).

## What must NOT change

- `SESSION_DURATION_MS` (5 days) — untouched, F3's problem if it needs to shrink.
- Cookie attributes (`httpOnly`, `secure`, `path`, `sameSite`, `maxAge`) — untouched.
- The 400 for a missing/malformed `idToken` — untouched.

## Why this is checked by real HTTP, not by source

A grep for "403" or "isAdminToken" in this file cannot tell you whether the check
actually runs BEFORE `createSessionCookie` or merely exists somewhere in the file
unreachably. `A-PROBE-01` sends a real, freshly self-registered account's idToken to the
real running route and asserts (a) HTTP 403, (b) no `Set-Cookie` header in the response,
and (c) that same non-existent cookie value, when presented to every other admin
surface, is refused there too.
