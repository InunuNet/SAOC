# F1 — Admin navigation menu

## Problem

Brad's ask, direct (see `.agent/memory/project/backlog.md`, "admin-nav"): `/admin/*` today is
three unlinked silos. `/admin` (dashboard), `/admin/door` (door check-in scanner), and
`/admin/vendors` (vendor review) each render standalone with no way to move between them, and
there is no sign-out anywhere in the codebase (confirmed: `grep -rn "signOut" app/admin
app/api/admin` returns nothing but the unused import in `firebase/auth`'s type list). An admin
has to know and type exact URLs.

## What actually exists (mapped before designing)

| Surface | File | Today's gate |
|---|---|---|
| `/admin` (ticket dashboard) | `app/admin/page.tsx` | `getAdminSession().ok` only — no capability check |
| `/admin/door` (check-in scanner) | `app/admin/door/page.tsx` + `app/admin/door/layout.tsx` | `getAdminSession().ok` only, via layout — no capability check |
| `/admin/vendors` (vendor review) | `app/admin/vendors/page.tsx` + `app/admin/vendors/layout.tsx` | `getAdminSession().ok` **and** `hasCapability(..., 'review-vendor-applications', ...)`, via layout |
| `/admin/login` | `app/admin/login/page.tsx` | deliberately ungated (see `docs/admin-access.md`) |
| CSV export | `app/api/admin/export-csv/route.ts` | API route only, no page; already surfaced as a "Download CSV" button on the dashboard — **not** a new nav destination in this feature |
| Sign-out | none | does not exist anywhere; added by this feature |

`lib/admin-roles.ts` defines seven capabilities including `view-admin-dashboard` and
`scan-checkin`, but per `docs/admin-access.md` §"Capability Checks (F4)", **no route calls
`hasCapability()` for either of those yet** — only `/admin/vendors` is capability-wired today.
This is load-bearing for the nav design below.

## The core design decision: the nav mirrors each route's *existing* gate, exactly, and adds no new one

The nav must show a link if, and only if, the signed-in viewer could reach that destination by
typing its URL directly today. That means:

- **Dashboard and Door Scanner links are shown to every admin whose session is `ok`** — because
  that is the entirety of what `app/admin/page.tsx` and `app/admin/door/layout.tsx` currently
  require. Do **not** invent a `hasCapability(..., 'view-admin-dashboard', ...)` or
  `hasCapability(..., 'scan-checkin', ...)` check to gate these nav links. Those capabilities
  exist in `lib/admin-roles.ts` but are not wired into either route — gating the *nav link* on a
  capability the *route itself* does not check would create exactly the confusing mismatch this
  feature exists to avoid, just inverted: a link hidden from an admin who could actually reach
  the page by URL. Wiring those two capabilities into their routes is separate, future work
  (tracked by F4's own "not yet wired" note), not part of this feature.
- **The Vendors link is shown if, and only if,
  `hasCapability(session.decodedToken, NATIONAL_SHOW_ID, 'review-vendor-applications', { now,
  lookupShowWindow })` returns true** — computed with the exact same inputs
  `app/admin/vendors/layout.tsx` already uses (`resolveShowWindowLookup(NATIONAL_SHOW_ID, now)`
  from `lib/show-window-lookup.ts`). This is the one destination where nav visibility and route
  access are already capability-gated, so the nav reuses that real gate rather than
  re-deriving its own notion of who can see vendors.

**The nav is presentation, not authorization.** Every route keeps its own independent
server-side `getAdminSession()` / `hasCapability()` check exactly as today. Hiding a link from
someone who lacks a capability is a UX courtesy against a confusing dead-end and, secondarily,
avoids advertising the existence of a capability-gated surface to someone who cannot use it — it
is not, and must never be treated as, the access-control decision itself. An implementer must
not remove or weaken any existing route-level check on the theory that "the nav already hides
it." A future engineer reading this golden should come away certain that deleting the nav
entirely would change zero routes' actual accessibility.

## Component architecture

One new component, `components/admin/AdminNav.tsx` (`'use client'` — needs `usePathname()` for
current-page highlighting and local state for the mobile/minimal collapse), is the single
source of truth for the link list and sign-out action. It takes exactly one prop from its
server-component caller:

```ts
canReviewVendors: boolean
```

It does **not** take a `current` prop — it derives current-page highlighting itself via
`usePathname()`, the same pattern `components/chrome/Header.tsx` already uses, rather than
threading a second parallel source of truth for "where am I" through every caller.

It renders in one of two variants, controlled by a `variant: 'bar' | 'minimal'` prop:

- **`variant="bar"`** — a persistent horizontal bar, used on `/admin` and `/admin/vendors`.
  Links: Dashboard, Door Scanner (both unconditional), Vendors (conditional on
  `canReviewVendors`), Sign out (unconditional, styled as the trailing/distinct action — see
  Sign-out below). Collapses to a hamburger below the same breakpoint `components/chrome/
  Header.tsx` already uses for its own nav→hamburger collapse, for visual consistency with the
  rest of the site's responsive pattern — **do not invent a new breakpoint value**.
- **`variant="minimal"`** — used on `/admin/door` only. Renders as a single small
  (~40×40px touch target) icon-only trigger button, fixed-position, that on tap/click/Enter
  opens an overlay containing the exact same link list (computed from the exact same
  `canReviewVendors` prop) and sign-out action, then closes on a second tap, `Escape`, or a
  click outside. **Never a persistent full-height bar** — this variant exists because
  `app/admin/door/page.tsx`'s own header comment already documents, correctly, that a
  persistent nav bar is an obstacle for a volunteer scanning tickets one-handed at a show
  entrance in bright daylight. That reasoning is not overridden by this feature; it is
  accommodated by making the door variant occupy effectively zero vertical space until
  explicitly opened.

### `/admin/door` must be restructured to compute the capability server-side

`app/admin/door/page.tsx` is currently a single `'use client'` file. Client components cannot
call `getAdminSession()` / `hasCapability()` (server-only: `cookies()`, Admin SDK). To give the
minimal nav a real `canReviewVendors` value without duplicating capability logic client-side:

1. Extract the current file's entire scanner implementation, unchanged, into a new
   `components/admin/DoorScannerClient.tsx` (`'use client'`, same export shape, just renamed/
   relocated — no logic changes).
2. Rewrite `app/admin/door/page.tsx` as an `async` Server Component (no `'use client'`) that
   computes `canReviewVendors` the same way `app/admin/vendors/layout.tsx` does
   (`resolveShowWindowLookup(NATIONAL_SHOW_ID, now)` + `hasCapability(...)` against the session
   already re-verified by `app/admin/door/layout.tsx`'s own gate — `getAdminSession()` is cheap
   and idempotent to call a second time here, same pattern `app/admin/vendors/page.tsx` uses
   below), then renders `<AdminNav variant="minimal" canReviewVendors={...} />` followed by
   `<DoorScannerClient />`.

This is the only structural change to the door page. Its scanner behavior, camera handling, and
manual-entry fallback are untouched.

### `/admin` and `/admin/vendors`

Both already are `async` Server Components. Each independently calls `getAdminSession()` +
`hasCapability(..., 'review-vendor-applications', ...)` to derive its own `canReviewVendors`
(yes, `app/admin/vendors/page.tsx` re-derives a value its own layout already proved true to
reach the page at all — a few extra lines, deliberately not a hardcoded `true` literal, so this
stays correct if the vendors gate criteria ever changes without anyone remembering to update a
hardcoded prop). Each renders `<AdminNav variant="bar" canReviewVendors={...} />` immediately
after its existing `<Header />` and before `<main>`.

`/admin/login` is untouched — it stays public and ungated exactly as documented in
`docs/admin-access.md`, and never renders `AdminNav` (an unauthenticated visitor has no session
to compute `canReviewVendors` from, and showing admin nav on the sign-in page makes no sense).

## Sign-out

Does not exist today; added as part of this feature. Two things must both happen, and the
cookie-clear must happen **even if the Firebase client-side sign-out throws** — use a
`try`/`finally`, not sequential awaits with no error handling:

1. **Server-side session cookie clear** — a new `DELETE` handler on the existing
   `app/api/admin/session/route.ts` (same file the `POST` mint handler already lives in, kept
   as one choke point for session lifecycle rather than a new route). It clears the `session`
   cookie (e.g. `cookieStore.set('session', '', { ...same attributes as POST's set, maxAge: 0
   })` or `cookieStore.delete('session')` — either is acceptable as long as the response's
   `Set-Cookie` header actually expires the existing cookie, not merely omits setting a new
   one). No request body, no auth check required on this handler — clearing a cookie that may
   already be absent, expired, or invalid is always safe, and requiring a valid session to sign
   out would make it impossible to sign out of an *already-broken* session.
2. **Client-side Firebase sign-out** — `AdminNav`'s sign-out control calls `signOut(getAuth(
   getFirebaseApp()))` (same `getFirebaseApp()` singleton `app/admin/login/page.tsx` already
   uses) to clear the client SDK's local auth state, then redirects to `/admin/login` via
   `useRouter()` regardless of whether the Firebase call succeeded — the redirect and the
   server-side cookie DELETE are not conditional on it.

The sign-out control is a real `<button type="button">`, not a link or a styled `<div>` — no
extra ARIA role/keyboard wiring needed beyond what a native button already provides for free.

## Accessibility (project rule: every interactive element needs a label, role, keyboard handler, visible focus)

- The nav bar is `<nav aria-label="Admin">`. The active link carries `aria-current="page"`.
- The minimal variant's trigger button has `aria-label="Admin menu"` (icon-only, so the
  accessible name comes entirely from this attribute) and `aria-expanded`, toggled correctly.
- Every link/button in both variants is keyboard-reachable in DOM order and shows a visible
  focus ring using this project's existing token pattern (`focus-visible:outline-none
  focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2`, already used
  on the dashboard's "Download CSV" link) — no new focus-style vocabulary invented.
- The minimal variant's overlay closes on `Escape`.

## Styling — reuse only, no new brand decisions

Per `CLAUDE.md`'s "No invented brand assets" rule, `AdminNav` uses only tokens and classes
already established across `components/chrome/*` and the existing admin pages: `ink`, `ivory`,
`bone`, `rule`, `primary` color tokens, the `font-serif`/`eyebrow` text conventions, and the
existing `rounded-sm border border-rule` button treatment already visible in `app/admin/
page.tsx`'s CSV button. No `@designer` pass is warranted — the vocabulary to match already
exists and is exhaustively demonstrated in the files this feature touches; inventing new visual
language here would violate the no-invented-assets rule, not satisfy it.

## What this feature explicitly does NOT do

- Does not wire `hasCapability()` for `view-admin-dashboard` or `scan-checkin` into any route —
  see "core design decision" above.
- Does not add CSV export as a nav destination — it stays a dashboard-page action button,
  unchanged.
- Does not touch `/admin/login`'s chrome or gating.
- Does not change any existing route's authorization logic. `AdminNav` reads capability
  booleans computed by its caller; it never itself calls `getAdminSession()` or
  `hasCapability()`.
