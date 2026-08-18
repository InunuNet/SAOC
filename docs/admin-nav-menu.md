# Admin Navigation Menu

**Code:** [`components/admin/AdminNav.tsx`](../components/admin/AdminNav.tsx),
[`components/admin/DoorScannerClient.tsx`](../components/admin/DoorScannerClient.tsx),
[`app/admin/page.tsx`](../app/admin/page.tsx), [`app/admin/vendors/page.tsx`](../app/admin/vendors/page.tsx),
[`app/admin/door/page.tsx`](../app/admin/door/page.tsx), [`app/api/admin/session/route.ts`](../app/api/admin/session/route.ts).
**Contract:** `.agent/memory/project/specs/admin-nav-menu/contract-f1.yaml`, feature F1.
Golden spec: [`.agent/memory/project/specs/admin-nav-menu/goldens/f1-admin-nav-menu.golden.md`](../.agent/memory/project/specs/admin-nav-menu/goldens/f1-admin-nav-menu.golden.md).

## What this is

Before this feature, `/admin` (ticket dashboard), `/admin/door` (check-in scanner), and
`/admin/vendors` (vendor review) were three unlinked silos — an admin had to know and type
exact URLs, and there was no way to sign out anywhere in the codebase. This feature adds one
shared component, `AdminNav`, rendered on all three surfaces, plus a real sign-out.

Links: Dashboard, Door Scanner, Vendors (only if the viewer holds the capability), Sign out.

## The nav is never the access boundary

This is the load-bearing design decision, and it must not be undone.

`AdminNav` is presentation-only. It takes one prop, `canReviewVendors: boolean`, and renders
the Vendors link if and only if that prop is `true`. It never imports `getAdminSession` or
`hasCapability` — it has no way to make its own authorization decision, by construction. Each
caller (`app/admin/page.tsx`, `app/admin/vendors/page.tsx`, `app/admin/door/page.tsx`)
independently re-derives `canReviewVendors` server-side, the same way
`app/admin/vendors/layout.tsx`'s own route gate already does
(`hasCapability(session.decodedToken, NATIONAL_SHOW_ID, 'review-vendor-applications', { now,
lookupShowWindow })`), and passes the result in.

Every protected route keeps its own independent server-side gate, unchanged by this feature:

- `app/admin/vendors/layout.tsx` and all three `app/api/admin/vendors/*` routes gate on the
  `review-vendor-applications` capability, exactly as before.
- `app/admin/page.tsx` and `app/admin/door/layout.tsx` still only require `getAdminSession().ok`
  — this feature does **not** wire `view-admin-dashboard` or `scan-checkin` into either route
  (those capabilities exist in `lib/admin-roles.ts` but nothing checks them yet). The nav
  deliberately does not gate the Dashboard or Door Scanner links on either capability, so it
  never hides a link an admin could otherwise reach by typing the URL.

QA verified this behaviourally, not just structurally: a signed-in admin without
`review-vendor-applications` sees no Vendors link in the nav, and a direct navigation to
`/admin/vendors` is still bounced by the route's own gate. **Deleting `AdminNav` entirely would
change zero routes' actual accessibility** — it is a UX courtesy against a confusing dead end,
never the thing standing between an unauthorized viewer and a protected page.

## Two variants

`variant: 'bar' | 'minimal'`, both driven by the same `canReviewVendors` prop and the same link
list:

- **`bar`** — a persistent horizontal bar, used on `/admin` and `/admin/vendors`. Collapses to a
  hamburger below the same 1240px breakpoint `components/chrome/Header.tsx` already uses.
- **`minimal`** — used on `/admin/door` **only**. A single fixed-position ~40×40px icon trigger
  that opens an overlay with the same links. This is a constraint, not a preference: a
  persistent bar would obstruct one-handed camera scanning at a show entrance in bright
  daylight (see `DoorScannerClient.tsx`'s own header comment). If you're tempted to switch the
  door page to `variant="bar"` for visual consistency, don't — that's the exact regression this
  golden exists to prevent.

Current-page highlighting (`aria-current="page"`) comes from `usePathname()` inside `AdminNav`
itself, not a threaded `current` prop — same pattern `components/chrome/Header.tsx` already
uses.

## The door page became an async Server Component

`app/admin/door/page.tsx` was a single `'use client'` file before this feature. Client
components can't call `getAdminSession()` / `hasCapability()` (server-only APIs — `cookies()`,
the Admin SDK), so computing a real `canReviewVendors` for the minimal nav required splitting
the file:

- The entire scanner implementation — camera lifecycle, QR decode loop, manual-entry fallback,
  `classifyCameraError` — moved unchanged into `components/admin/DoorScannerClient.tsx`
  (`'use client'`).
- `app/admin/door/page.tsx` is now `async`, computes `canReviewVendors` the same way
  `app/admin/vendors/page.tsx` does, and renders `<AdminNav variant="minimal" ... />` followed
  by `<DoorScannerClient />`.

The camera lifecycle crosses this new component boundary. The unmount cleanup that releases the
`MediaStream` lives inside `DoorScannerClient.tsx` and is load-bearing — if it's ever lost in a
future refactor, a volunteer navigating away from the door page mid-scan would leave the camera
running in the background.

## Sign-out

Did not exist anywhere in the codebase before this feature. `AdminNav`'s sign-out button does
two things, in `try`/`finally` so the second always runs even if the first throws:

1. `signOut(getAuth(getFirebaseApp()))` — clears the Firebase client SDK's local auth state.
2. `DELETE /api/admin/session` — a new handler on the same route file the session-mint `POST`
   already lives in (one choke point for session lifecycle, not a new route). It clears the
   `session` cookie server-side with `maxAge: 0` and the same `httpOnly` / `secure` / `path` /
   `sameSite: 'strict'` attributes the `POST` handler sets, so the browser actually drops the
   cookie rather than just receiving an ignored `Set-Cookie`.

Both then redirect to `/admin/login` regardless of whether the Firebase call succeeded.

### Known limitation — not a solved problem

Sign-out clears the session cookie but does **not** call `revokeRefreshTokens()`. If a session
cookie was exfiltrated before sign-out (XSS, a shared/compromised device), that cookie remains
valid server-side until its natural expiry — up to 5 days
(`SESSION_DURATION_MS` in `app/api/admin/session/route.ts`) — even after the legitimate user
signs out through the UI. This is a known follow-up, not something this feature closes. Compare
`scripts/admin-revoke.ts`, which does call `revokeRefreshTokens()` for an operator-initiated
revoke — sign-out and revoke are different operations with different guarantees today.

CSRF is not a live concern for the `DELETE` handler as shipped: the cookie is
`sameSite: 'strict'`, the request uses a non-simple method, and there is no CORS middleware in
this repo that would relax that default.

## Running the checks

The behavioral proof (`execution/checks/verify_admin_nav.ts`, contract assertion A13) drives a
real Playwright browser against a real built-and-served instance, reusing
`contracts/checks/admin-auth-hardening/server-ctl.sh`'s start/stop pattern.

```bash
node_modules/.bin/tsx execution/checks/verify_admin_nav.ts
```

**Port collision hazard:** both this check and
`contracts/checks/admin-auth-hardening/server-ctl.sh` bind a **fixed** port (3400) and use a
shared lockfile. If two agents run an admin-gate check concurrently, the second `start` doesn't
queue — it collides with the first, and both runs can produce false FAILs that look like real
regressions but aren't. If a run reports the lock/port already held, wait for the other run to
finish rather than killing it (killing a concurrent run can leave the lock directory or scratch
build in a state the next `start` has to clean up by hand — see
[docs/admin-access.md](admin-access.md)'s "Running the contract gate" section for the same
guidance on the shared `server-ctl.sh`). This cost real cycles during this feature's own QA
pass.
