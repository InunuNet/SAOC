# `lib/admin-auth.ts` — the single home for the admin authorisation decision

This is the spec @dev implements against. Function names, file path, and fail-closed
behaviour below are load-bearing — the check scripts assert this exact shape. Internal
details (e.g. exact TypeScript formatting) are not.

## Env var

`ADMIN_EMAIL_ALLOWLIST` — server-only (no `NEXT_PUBLIC_` prefix), comma-separated email
addresses, e.g. `ADMIN_EMAIL_ALLOWLIST=chair@saoc.co.za,secretary@saoc.co.za`. Add it to
`.env.local.example` (empty, as every other secret-shaped var in that file) and to
`.env.local` locally. Missing/empty env var means an EMPTY allowlist — nobody is
admin — never "allow all". This is the fail-closed default the whole gate rests on.

## Exports

```ts
import type { DecodedIdToken } from 'firebase-admin/auth';

export type AdminAuthResult =
  | { ok: true; decodedToken: DecodedIdToken }
  | { ok: false; reason: 'no-session' | 'invalid-session' | 'no-claim' | 'email-unverified' | 'not-allowlisted' };

// Pure allowlist membership check. Case-insensitive. Empty/missing env → false for
// everything, always.
export function isEmailAllowlisted(email: string | null | undefined): boolean;

// Full admin policy against an ALREADY-DECODED token (custom claim + email_verified +
// allowlist). Used by the session-mint route, which has an idToken, not a cookie.
export function isAdminToken(decoded: DecodedIdToken | null | undefined): boolean;

// Full admin policy against the `session` cookie, for Route Handlers and Server
// Components. Reads cookies() itself. NEVER throws — every failure path returns
// { ok: false, reason }, so a caller that forgets a try/catch still fails closed.
export async function getAdminSession(): Promise<AdminAuthResult>;
```

## Policy (identical logic in `isAdminToken` and `getAdminSession`)

A token is admin if, and ONLY if, ALL of:
1. `decoded.admin === true` — strict boolean equality. `'true'` (string), `1`, or any
   other truthy-but-not-`true` value is NOT admin. (`role === 'admin'` from the old
   inline checks is dropped — see below.)
2. `decoded.email_verified === true`.
3. `isEmailAllowlisted(decoded.email)` — checked live, on every call, against the
   CURRENT env var value. Never cached from claim-grant time.

Any other state — missing claim, malformed claim, unverified email, verified email not
on the allowlist, no session cookie at all, a session cookie that fails
`verifySessionCookie` (forged, expired, or revoked) — is NOT admin. `getAdminSession()`
distinguishes these with the `reason` field for logging, but every caller's branching
logic is the same: `if (!result.ok) { …refuse… }`.

`verifySessionCookie` MUST be called with `checkRevoked: true` (the second argument),
exactly as all four existing inline checks already do — this is what makes
`revokeRefreshTokens` (F3, not built here) actually take effect instead of being
silently ignored. Do not drop this argument while refactoring.

### On dropping `role === 'admin'`

The four existing inline checks accept EITHER `decoded.admin === true` OR
`decoded['role'] === 'admin'`. No code anywhere in this repo sets a `role` custom claim
— grep confirms zero writers. Carrying forward a second, never-used way to become admin
adds attack surface for no product reason, so the shared helper accepts only the `admin`
claim. If a future feature needs role-based claims, it can be added back deliberately,
with its own allowlist-equivalent control — not preserved here "just in case".

## Callers — every one of these six files, ALL of them, must go through the helper

Route Handlers / Server Components use `getAdminSession()`:
- `app/admin/page.tsx`
- `app/admin/door/layout.tsx` (new file — see `door-gate.golden.md`)
- `app/api/admin/tickets/route.ts`
- `app/api/admin/checkin/route.ts`
- `app/api/admin/export-csv/route.ts`

`app/api/admin/session/route.ts` uses `isAdminToken()` on the freshly-verified idToken
(see `session-route.golden.md`) — it cannot use `getAdminSession()` because at that
point in the flow there is no session cookie yet, only the idToken the client sent to be
exchanged.

None of the six files may contain its own inline
`decodedToken.admin === true` / `['role'] === 'admin'` check after this change — the
structural assertion in the contract greps for exactly that residue.
