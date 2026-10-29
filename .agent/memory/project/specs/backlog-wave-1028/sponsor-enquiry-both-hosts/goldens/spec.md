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

---
# Amendment 2026-10-28: NOS Design rulings, D2 in scope, A9 gate

## NOS Design rulings (final; they answer Questions 1-5 above)
- No new mailto line. The existing inline mailto links in Lee-Ann's FAQ answers are her sourced copy and stay.
- The form sits in the document column after "Become a sponsor": `<SponsorEnquirySection site="nos" inDocument />` (A3, A11), so the heading is the NOS `doc-h2` role.
- Static warm card, declared in the NOS stylesheets (`app/(nos)/national-show/nos-structure.css`) as flat, unlayered rules scoped to `[data-sponsor-enquiry='nos']` so SAOC and the shared form are untouched. The mechanism is fixed by the shared form being SAOC-pinned (A4): styling is CSS, not a class change in the form. Unlayered is required: the form's Tailwind utilities are layered and an unlayered rule beats them (same reason as the r55 note in nos-theme.css). Values (A11): card background #F3F2D6, radius 16, `--shadow-sm`, padding 32 (24 below 768); fields column max-width 640; labels Karla 500 14px ink, no tracking, no caps; inputs 1px `--rule` border, radius 8, min-height 48 (16px text is already global); focus ring 2px violet (`--accent` #7E3F97); submit takes the NOS primary Button look (bg `--primary`, text `--ivory`, Karla 700 14px uppercase, min-height 50, `--radius-button`); anchor `scroll-margin-top` 121px at >=768 and 24px at <=767 (the NOS header is not pinned at 767 and from 768 up is pinned at top 0, bottom 97px - measured live on nos.saoc.co.za/sponsors scrolled to 1500, 2026-10-28; the 780 first relayed to NOS Design was a factual error, and their principle 16..40px below whatever is pinned gives 768) (this overrides the section's Tailwind `scroll-mt-36`), with the NOS host zeroing the root `--scroll-padding-top` at every width through the variable (e.g. `html:has(#nh) { --scroll-padding-top: 0px }`, so every NOS scroll-margin assumes zero; NOS Design anchor ruling 2026-10-28, final). No header-height token exists in the repo, so 121 is the declared literal. The SAOC root scroll-padding (globals.css, 6.5rem) stays untouched.
- Success state is the heading only, focused, inside `role="status"`, replacing the form in place. That is what the shared form already does for `site="nos"` (the body renders for saoc only), so no form change is needed; A4 allows edits inside the success block only and pins SAOC's heading plus body.
- The CTA label stays "Talk to us about sponsorship".
- Anchor gate (NOS Design): after the CTA click the card top lands 16..40px below whatever is pinned to the top of the viewport, or below the viewport top when nothing is pinned, at 390, 767, 768, 1024, 1440 and 2056 (767 and 768 test both sides of the header-pinned edge). Cannot be static; A12 measures it with Chromium on the deployed page (post-deploy, non-required). A11 pins the declared 121 (>=768) / 24 (<=767) values and the zeroed NOS root scroll-padding the gate depends on. A13 is a report-only survey (never fails) listing the same landing for every other NOS hash target (faq, plan-your-visit, legal, presenters at presenters.css:57 and whatever else is linked); the contract fixes only the sponsors card.

## D2 is now in scope (NOS Design P1, lead agrees): the acknowledgement follows the submission host
`sendSponsorEnquiryConfirmationEmail({ contactName, email, site })`: `site` is `'saoc' | 'nos' | null | undefined`; anything but `'nos'` means the SAOC identity. SAOC: sender `FORMS_FROM_ADDRESS`, `site: 'saoc'` on the mailer call (reply-to follows), subject `We received your sponsorship enquiry — SAOC`. NOS: sender `NOS_FORMS_FROM_ADDRESS`, `site: 'nos'`, subject names the National Orchid Show (composed from the existing label, same as the admin notice). The email preview takes the same label. The route passes `site: doc.source`. Body copy, recipient and the single send do not change. This is a bug fix on the existing email, not a new email (A10, A4). The admin notice sender stays `FORMS_FROM_ADDRESS` for both hosts (internal; not ruled; flag only if Design wants otherwise).

## A9 can no longer email real admins by accident
`SPONSOR_E2E_ADMIN_RECIPIENTS` (comma-separated) must be set or A9 exits 77. It is the operator's statement of who receives the admin notices, i.e. that the deployed `ADMIN_EMAIL_ALLOWLIST` secret (not readable by the script) equals it, which in practice means pointing the secret at a test inbox for the run. As a tripwire A9 also exits 77 when `.env.local` has a different `ADMIN_EMAIL_ALLOWLIST`. Not set by default anywhere, so it skips in every gate.

## New open items for NOS Design (small)
- The shared success box is `border border-rule bg-parchment p-8`; inside the warm card that is a box in a box. Leave, or neutralise it (background transparent, no border, no padding) under the nos scope? Not ruled, not asserted.
- The label rule restyles every `label` in the card, including the consent label (SAOC 15px sans); intended?
