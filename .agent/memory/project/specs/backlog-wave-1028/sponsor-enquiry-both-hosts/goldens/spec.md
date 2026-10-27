# sponsor-enquiry-both-hosts (M2-F2) - spec for @dev

Brad, verbatim: "SSOC andNnOS need a sponsorship contact form no user email workload." Read as: on SAOC and on NOS a sponsor enquires through an on-site form; the visitor never has to open their own email client; no mailto is a primary path.

## What main already does (verified, 2026-10-28)
- SAOC `/sponsors` renders `<SponsorEnquirySection site="saoc" inDocument />`, posting to `POST /api/sponsors/enquire`.
- The doc already stores `source: 'saoc'|'nos'`, derived server-side from the Host by `siteForHost` (`app/api/sponsors/enquire/route.ts`), never from the body. The admin notice body already has a "Site:" row.
- `SponsorEnquirySection`/`SponsorEnquiryForm` already accept `site="nos"` (NOS success body is deliberately the heading alone, gap G6). `/privacy` is a shared path, so the form's privacy link works on NOS.
- So NOS needs the component placed on its page, not a new form, and the API needs no change.

## Changes (dev implements; checks A1-A3 pin them)
1. `app/(nos)/national-show/sponsors/page.tsx`: render exactly one `<SponsorEnquirySection site="nos" />` (same import path as SAOC, no fork). The hero CTA, aside-card CTA and empty-state CTA (`<Button as="a">`) change `href` from `SPONSORSHIP_MAILTO` to `#enquire`. Inline mailto links inside Lee-Ann's FAQ answers (Q80/Q81 text) are her sourced copy: leave them unless NOS Design rules otherwise (Question 1).
2. `lib/sponsor-enquiry.ts` `buildSponsorEnquiryDoc`: `source` is `'saoc'` or `'nos'`, anything else is stored as `null` (own property, never undefined; docs/firestore-undefined-write-safety.md). Widen `SponsorEnquiryDoc.source` to `SponsorEnquirySite | null`. `lib/sponsor-enquiry-admin-notice.ts` must not crash on null.
3. `lib/sponsor-enquiry-admin-notice.ts`: the subject names the site, composed from the existing `SITE_LABELS` and the existing subject stem: `New sponsorship enquiry — SAOC` / `New sponsorship enquiry — National Orchid Show` (null: a neutral word, see Gaps). Recipients stay exclusively `ADMIN_EMAIL_ALLOWLIST`. The `preview` text in `emails/SponsorEnquiryAdminNotice.tsx` is hard-coded "— SAOC" too: take the site label there as well.
4. Do not touch: `components/sponsors/SponsorEnquiryForm.tsx`, `app/api/sponsors/enquire/route.ts`, `lib/sponsor-enquiry-confirmation.ts`, `emails/SponsorEnquiryConfirmation.tsx`. Add no `export const` to `lib/sponsor-enquiry-copy.ts`. No new visitor email. (A4 enforces.)

## Copy sourced vs gaps (docs/rules/no-invention.md)
All form labels, the heading "Sponsorship enquiry", consent label, success strings, ack and admin email text exist today in `lib/sponsor-enquiry-copy.ts`; the SAOC ones are already flagged PENDING-COMMITTEE-COPY (G1-G6) and unchanged. The CTA label "Talk to us about sponsorship" is the existing site label (SAOC `/sponsors`). Lee-Ann's Drive (content/drive-source/National Show/17. Frequently Asked Questions v1.0/v1.1 Q80/Q81, 2.1 About) has no enquiry-form wording. Gaps to list, not write:
- G-N1 NOS success body (existing G6, still open).
- G-N2 NOS consent label says "SAOC using these details"; is that right on the NOS site (existing G3)?
- G-N3 admin notice subject for `source: null` (no site label exists for it). Dev uses a non-prose fallback only; wording is the Council's.
- G-N4 the NOS aside card sentence `CARD_SENTENCE` ("...can be sent via email") describes email as the route; with a form it is stale. It is Lee-Ann-sourced, so leave and ask (Question 2).

## NOS Design questions (flag, do not decide; NOS layout is frozen pending Brad NR-2)
1. Does a secondary visible mailto line (`2027national@gmail.com`, Lee-Ann's FAQ address) stay beside the form, or go? Brad's brief says no mailto as the primary path; secondary is Design's call.
2. Placement and card: archetype E (static warm card, fields <=640) in the document column after "Become a sponsor", versus the aside card hosting only the CTA that scrolls to it. The shared section's non-`inDocument` mode is the SAOC bone/rule card; `inDocument` is the doc-section column. Which NOS tokens (warm card background, rule colour, radius, label type) apply? The form's inputs use SAOC tokens (`bg-ivory`, `border-muted`, `text-primary` focus ring, `bg-accent` submit); do NOS /contact and /vendors/apply tokens override them on this page?
3. Anchor `#enquire` with `scroll-mt-36`: correct under the NOS sticky header height?
4. NOS success state with a heading and no body (G6): acceptable, or hold the section back until copy lands?
5. The heading "Sponsorship enquiry" inside a page whose h2s are the NOS `doc-h2`: any hero-CTA label change since the target is now the form not an email?

## Defects / observations on the existing form (main, not fixed here unless listed above)
- D1 (fixed by item 3): admin notice subject and preview are hard-coded "— SAOC" on both hosts, so the notice cannot be told apart at a glance. Body has the Site row.
- D2 (item 4 forbids changing; report): the visitor acknowledgement is sent `from: NOS_FORMS_FROM_ADDRESS, site: 'nos'` for every submission including SAOC-host ones, with subject "... — SAOC". An SAOC visitor gets the NOS sender. Needs Brad/Lee-Ann call; left as is per brief item 4.
- D3: `afterCommit` runs both emails inside `deliverConfirmationEmailAfterCommit`, so a mailer failure is isolated and logged (verified green by A1). But the outcome is never stored: if the admin notice fails or `ADMIN_EMAIL_ALLOWLIST` is empty (console.warn only) the enquiry sits in Firestore unseen, and no admin page lists `sponsorEnquiries` (read in the Firebase console only). lib/contact-delivery.ts on feat/contact-notify (PR #135) records a delivery status; the same pattern is a recommended follow-up, not in this feature.
- D4: rate limiting is an in-memory per-instance store (`createAttemptStore`); with several App Hosting instances the 5/hour cap is per instance. Honeypot and validation verified green.
- No defect found in validation, doc write shape, or the host-derived source: A1 pins them green on main.

## E2E (A9, post-deploy, required:false)
Run from the project root after deploy. Touches only Firestore collection `sponsorEnquiries`, docs with `contactName` exactly `E2E-TEST sponsor-enquiry-both-hosts <nonce> saoc|nos` (two docs, deleted by the script; it refuses to delete unless exactly one matches). It also triggers 2 admin notices per allowlist recipient and 2 visitor acknowledgements to `e2e-test@example.com` (reserved, undeliverable); mail cannot be unsent. Beta Basic Auth and `FIREBASE_ADMIN_*` are read in-script, never printed. Assumes `nos.saoc.co.za` is the live NOS host (apphosting.yaml) and shares the Firestore project in `.env.local`.
