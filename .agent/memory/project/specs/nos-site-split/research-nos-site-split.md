# Research: nos-site-split

## Survey findings
- proxy.ts is host-agnostic Basic Auth wall; applies identically to every host; exempt webhook set is 6 exact paths. Extend, do not replace; keep `decideBasicAuth` signature (e2e/beta-password-wall-decision.spec.ts).
- Chrome today is chosen by route SEGMENT in components/nos-chrome/ChromeFrame.tsx (national-show, tickets => NOS) from one app/(marketing)/layout.tsx. NOS header/footer/theme already exist. Route groups therefore replace the segment switch with zero URL change.
- SITE_URL (apphosting.yaml = https://beta.saoc.co.za) is read ad hoc in ~10 files with a `https://saoc.co.za` fallback (checkout route, vendor stand-payment initiate, confirmation emails, vendor links, supporter handler, admin vendor review routes). app/layout.tsx, lib/seo.ts, app/sitemap.ts, app/robots.ts hard-code https://saoc.co.za.
- Show routes: app/(marketing)/national-show (40 tracked files), /tickets (legacy order routes + a redirect), /vsp. Shared legal: privacy, terms, refunds, contact, newsletter/unsubscribe.
- Sponsors already split in Sanity (`sponsor` vs `showSponsor`). Media kit is single /media-kit and another mission (MediaKitComplete) is active on it.
- Member auth: none. /members page says login is not built. Only Firebase Auth for /admin (lib/admin-auth.ts).
- Newsletter: `source` enum only; topics field is new and additive.
- e2e assertions on show paths: nav-links-200, nav-property1-http-gate, nav-rendered-reachability, nav-keyboard-operable, mega-menu-f8/layout4, mobile-nav-reaches-every-section, no-fabricated-content, sold-out-and-empty-states, fixtures/tickets-fixtures. Playwright runs `next dev`, so Host-based specs use nos.localhost:<port>.
- Floor block hit: this architect could not read `app/api/admin/vendors/*/resend-*/route.ts` or `app/(marketing)/national-show/vendors/*` via glob (globs over protected paths denied; vendor-registration paths are floor-protected). F2/F1 devs must read these directly; if the floor denies writes, use contract `enforcement_edits` (Route 1) naming exact paths. app/api/admin/settings/* not read.

## Decisions
1. Route groups (nos)/(marketing)/(shared), URL-preserving git mv; host rewrite only for `/` on NOS.
2. NOS public URLs keep `/national-show/...` prefix (DECISION-1, deferrable).
3. NOS host redirects SAOC-only paths to SAOC (308); SAOC host redirects show tree to NOS (308).
4. Wall first on both hosts, same credentials, same exempt set.
5. Origins from NEXT_PUBLIC_SAOC_SITE_URL / NEXT_PUBLIC_NOS_SITE_URL (build+runtime), one module lib/site-hosts.ts.
6. Root layout loses hard-coded metadataBase/JSON-LD to keep static rendering; group layouts own metadata.
7. Media kit gate = admin session via lib/admin-auth.ts behind one helper (DECISION NEEDED: no member system).
8. Newsletter: additive `topics`, merge on resubscribe, whole-address unsubscribe.
9. Admin cookies are per-host; admin sign-in works on each host once the Firebase authorized domain exists.

## Ops steps (not code)
- O1 Firebase Console: Authentication > Settings > Authorized domains: add nos.saoc.co.za (and beta.saoc.co.za if absent, later saoc.co.za). Google sign-in popup fails on nos until done.
- O2 App Hosting: confirm env NEXT_PUBLIC_SAOC_SITE_URL, NEXT_PUBLIC_NOS_SITE_URL (BUILD+RUNTIME), SITE_URL; BETA_BASIC_AUTH_* secrets apply to the single backend so nos is walled automatically; DNS/cert for nos.saoc.co.za must reach ACTIVE.
- O3 Ozow: confirm sandbox return/notify/cancel URLs on https://nos.saoc.co.za are accepted for the sandbox site code (Ozow may whitelist per site code); sandbox only, no live mode, no PayFast.
- O4 Resend: nothing to change tonight (senders unchanged); later verify saoc.co.za domain before nos-tickets@/nos-forms@/nos-subscribe@.
- O5 Sanity: CORS origin + webhook/draft-mode (api/draft, api/revalidate) allowed origin for https://nos.saoc.co.za; studio stays on beta host.
- O6 Cloud Scheduler reconcile-orders keeps calling the beta origin (exempt path, host-neutral).
