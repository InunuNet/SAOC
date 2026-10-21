# Route and nav map (golden) — mission admin-redesign F1

Source of truth for visuals: goldens/codi-ruling.md (final). This file records the structural decisions only.

## Decisions

1. Route mapping. `/admin` becomes the Dashboard. The ticket table moves to `/admin/tickets` (the ONLY new page route). `/api/admin/export-csv` and every other API route are unchanged. The old "Ticket Admin" content is the new /admin/tickets page. Commerce data fetch (`fetchTickets`) moves with it.
2. Shell location. Route group `app/admin/(shell)/` holds layout.tsx (the shell) plus page.tsx (dashboard), tickets/, door/, vendors/ (incl. applications/), settings/ — moved with `git mv`, URLs unchanged (route groups add no segment). `app/admin/login/` stays OUTSIDE the group, so it never gets the shell; it keeps its own layout with public chrome. There is deliberately NO `app/admin/layout.tsx` (it would wrap login; the existing comments in app/admin/door/layout.tsx explain why).
3. Public chrome. Root `app/layout.tsx` has no chrome; chrome comes from `app/(marketing)/layout.tsx`, which /admin is not in. The admin pages currently render UtilityBar/Header/Footer/AdminNav themselves (page.tsx, vendors/page.tsx, vendors/applications/page.tsx, settings/layout.tsx). Redesign deletes those imports from those files; the shell provides chrome. Login layout is untouched.
4. Auth. Every existing gate stays byte-equivalent: door/layout.tsx, vendors/layout.tsx, settings/layout.tsx keep their getAdminSession/hasCapability/redirect lines; the dashboard and tickets pages keep `getAdminSession()` + `redirect('/admin/login')`. The (shell) layout additionally calls getAdminSession (redirect to /admin/login) and resolves capabilities to pass to the client shell as props (presentation only). lib/admin-auth.ts and all app/api/admin/** routes except the new whoami route are unchanged.
5. Detail view. A client `DetailDrawer` (components/admin/DetailDrawer.tsx): right-side dialog 520px at >=1024 that leaves the list visible (no scrim blocking list reads: non-modal for pointer, but focus-trapped and Esc closes); below 1024 it is a full-page view with a back link (state-driven, `?view=<id>` search param so Back works). It hosts the EXISTING action controls unchanged in behaviour: review transitions (approve/reject/etc), VendorPaymentLinkControl, VendorPhotoLinkControl, publish listing, reissue code. Action code is lifted out of VendorReviewTable/VendorApplicationReviewTable into the sticky drawer footer; API calls and payloads unchanged.
6. Newsletter. Choice: data-driven nav. `lib/admin-nav-config.ts` exports the groups/items; each item has `available: boolean`. Newsletter is `available: false` and the dashboard subscriber card is shown only when that same flag is true. The newsletter branch flips one flag (and may wire the count). No filesystem probing. Until then both are hidden, not broken.
7. Admin pill. `components/admin/AdminPill.tsx` ('use client'), mounted in `app/(marketing)/layout.tsx` as a sibling AFTER the ChromeFrame (DOM position after main), so marketing pages stay statically renderable (no cookies() in the marketing layout). It learns admin status from NEW `GET /api/admin/whoami` (`app/api/admin/whoami/route.ts`): uses getAdminSession(); `{admin:true,email}` with 200, or `{admin:false}` with 401; `Cache-Control: no-store`; no token contents. Negative result cached in sessionStorage for 10 minutes to avoid a request per page. No firebase-admin in any client module. Hidden when pathname starts with `/admin`. Sign-out reuses the existing DELETE /api/admin/session flow from AdminNav.
8. Studio deep-link map (`lib/studio-links.ts`, exact-path only, others hidden), link form `/studio/intent/edit/id=<type>;type=<type>`:
   `/`→homePage, `/about`→aboutPage, `/contact`→contactPage, `/judging`→judgingPage, `/members`→membersPage, `/tickets`→ticketsPage, `/national-show`→nationalShow. (IDs equal type names per sanity/structure.ts.) Anything else, including /national-show/* subpages, gets no "Edit this page".

## Nav (codi-ruling a)

| group | item | href | notes |
|---|---|---|---|
| SHOW | Dashboard | /admin | exact-match active |
| SHOW | Tickets | /admin/tickets | |
| SHOW | Door scanner | /admin/door | |
| VENDORS | Applications | /admin/vendors/applications | pending-count badge; shown only if canReviewVendors |
| VENDORS | Vendors | /admin/vendors | shown only if canReviewVendors |
| COMMUNICATIONS | Newsletter | /admin/newsletter | available:false until newsletter branch |
| SYSTEM | Settings | /admin/settings | shown only if canManagePaymentSettings |

Active matching: exact for /admin; `pathname === href` otherwise, EXCEPT /admin/vendors must not light up on /admin/vendors/applications (exact match for both).

## Seven routes (render check)

/admin, /admin/tickets, /admin/door, /admin/vendors, /admin/vendors/applications, /admin/settings, /admin/login.

## Render-check approach (chosen: component-level fixtures, no auth bypass)

A bypass in getAdminSession would be an auth-adjacent change that could ship. Instead: `app/admin-fixtures/[route]/page.tsx`, `notFound()` unless `process.env.ADMIN_FIXTURES === '1'` read at request time (dynamic, force-dynamic). It renders the real `AdminShell` (client, takes optional `pathnameOverride`, used only here) wrapping the real presentational page components with static fixture data (lib/admin-fixtures/*.ts: 40 tickets, 24 applications incl. a long business name, 12 vendors). /admin/login is hit directly (real route; unauthenticated render). Safety asserts: the flag name appears nowhere in apphosting.yaml/.env.local.example; fixture route returns 404 when the flag is unset.
