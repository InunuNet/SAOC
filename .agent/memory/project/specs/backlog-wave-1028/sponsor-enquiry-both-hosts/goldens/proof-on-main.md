# Proof on main (origin/main 48d74378), 2026-10-28

Every RED line below fails on main; PIN lines pass on main by design (they stop the fix regressing the existing form). Checks were also run against a throwaway trial fix (NOS page uses SponsorEnquirySection site="nos" with #enquire CTAs; buildSponsorEnquiryDoc allowlists saoc|nos else null; admin subject names the site): A1-A5 all exit 0, tsc clean. Trial fix reverted; no product code is in this branch.

## check-handler.mts (exit 1 on main)
```
FAIL (2):
- RED unknown site stores source null (allowlist saoc|nos)
- RED buildSponsorEnquiryDoc coerces an unknown site to null
```

## check-admin-notice.mts (exit 1 on main)
```
FAIL (2):
- RED saoc and nos admin-notice subjects differ
- RED nos subject names the National Orchid Show and not SAOC
```

## check-nos-page.mts (exit 1 on main)
```
NOTE (NOS Design call, not asserted): 6 mailto href(s) remain in the page source.
FAIL (5):
- RED page imports SponsorEnquirySection from @/components/sponsors/SponsorEnquirySection
- RED page renders exactly one <SponsorEnquirySection site="nos" />
- RED no <Button> links to mailto
- RED at least three <Button> CTAs (hero, card, empty state) link to #enquire
- RED the hero CTA (data-sponsors-hero-cta) links to #enquire
```

## check-scope.mjs (A4, exit 0 on main, a pin)
```
PASS: form/API/confirmation untouched, two sends, no fork, no new copy export
```

## A5 tsc --noEmit: exit 0 on main (a pin)

## A9 with no env: `INCONCLUSIVE ... exit 77` (skip), by design off the project root/env

# Amendment 2026-10-28 (NOS Design rulings, D2, A9 gate), proof on main

Base: origin/main at spec time. Checks A10 and A11 fail on main; A4 (rewritten) passes on main as a pin. On the dev's commit 66f5d66e, A1-A3 pass (exit 0) and A10, A11 fail (exit 1), as expected before the new work. A throwaway trial (D2 fix in lib/sponsor-enquiry-confirmation.ts, emails/SponsorEnquiryConfirmation.tsx, the route call; the NOS CSS block) made A10, A11 and A4 pass with tsc clean, then was discarded.

## check-confirmation-site.mts (exit 1 on main)
```
FAIL (7):
- RED saoc submission is sent from FORMS_FROM_ADDRESS (the SAOC sender)
- RED saoc submission passes site 'saoc' (reply-to follows the site)
- RED nos subject names the National Orchid Show and not SAOC
- RED nos email preview does not say "— SAOC"
- RED a missing site defaults to the SAOC sender and site 'saoc'
- RED a null site (stored source null) uses the SAOC sender and site 'saoc'
- RED route passes site: doc.source to the acknowledgement
```

## check-nos-style.mts (exit 1 on main)
```
FAIL (38):
- RED the NOS stylesheets declare rules scoped to [data-sponsor-enquiry="nos"]
- RED card background is #F3F2D6 at 390px (got undefined)
- RED card radius is 16 at 390px (got undefined)
- RED card shadow is var(--shadow-sm) at 390px (got undefined)
- RED card background is #F3F2D6 at 768px (got undefined)
- RED card radius is 16 at 768px (got undefined)
- RED card shadow is var(--shadow-sm) at 768px (got undefined)
- RED card background is #F3F2D6 at 1440px (got undefined)
- RED card radius is 16 at 1440px (got undefined)
- RED card shadow is var(--shadow-sm) at 1440px (got undefined)
- RED card padding is 24px on every side at 390px (got undefined/undefined)
- RED card padding is 24px on every side at 767px (got undefined/undefined)
- RED card padding is 32px on every side at 768px (got undefined/undefined)
- RED card padding is 32px on every side at 1440px (got undefined/undefined)
- RED a scoped fields rule sets max-width 640px
- RED inputs have a 1px --rule border at 390px (got undefined undefined)
- RED inputs radius 8 at 390px (got undefined)
- RED inputs min-height 48 at 390px (got undefined)
- RED labels are Karla 500 14px at 390px (got undefined undefined undefined)
- RED labels: no tracking, no caps, ink colour at 390px
- RED the focus ring is 2px violet at 390px (got undefined)
- RED submit is the NOS primary button colours at 390px (got undefined on undefined)
- RED submit type is Karla 700 14px uppercase at 390px
- RED submit min-height 50 and --radius-button at 390px
- RED inputs have a 1px --rule border at 1440px (got undefined undefined)
- RED inputs radius 8 at 1440px (got undefined)
- RED inputs min-height 48 at 1440px (got undefined)
- RED labels are Karla 500 14px at 1440px (got undefined undefined undefined)
- RED labels: no tracking, no caps, ink colour at 1440px
- RED the focus ring is 2px violet at 1440px (got undefined)
- RED submit is the NOS primary button colours at 1440px (got undefined on undefined)
- RED submit type is Karla 700 14px uppercase at 1440px
- RED submit min-height 50 and --radius-button at 1440px
- RED #enquire scroll-margin-top is 68px at 390px (got undefined)
- RED #enquire scroll-margin-top is 68px at 699px (got undefined)
- RED #enquire scroll-margin-top is 121px at 700px (got undefined)
- RED #enquire scroll-margin-top is 121px at 1440px (got undefined)
- RED the NOS page renders <SponsorEnquirySection site="nos" inDocument />
```

## A4 check-scope.mjs: exit 0 on main (pin)
## A9 / A12 with no env: exit 77 (skip). A9 also exits 77 when SPONSOR_E2E_ADMIN_RECIPIENTS is unset, or when .env.local ADMIN_EMAIL_ALLOWLIST differs from it (both verified with fake creds, before any network call).

## Amendment 2 (NR-7): check-nos-page.mts gains "h2 Talk to us about sponsorship has class nos-card-title"
Red on main (`nos-sp-card-title` only) and red on the dev's 66f5d66e (same h2 unchanged); green once the class is added (verified by a one-line trial, discarded).

## Amendment 3 (NOS Design, success box NR-4 and consent label): check-nos-style.mts (A11) and check-deployed-render.mjs (A12)
A11 adds: no bare `label` rule (the field-label rule must exclude the consent label via :not([for='se-consent']) or a checkbox :has/:not), a consent rule (Karla 450 16px / 1.5), and a `[role='status']` rule under the nos scope (no border, zero padding, transparent). Red on main (46 failing lines now) and on 66f5d66e; a throwaway CSS trial with those rules made it pass, then was discarded. A12 adds consent computed style plus first-line checkbox alignment, and a mocked-API success state (page.route fulfils 201; nothing reaches the server): 0 borders and 0 padding inside the success state, transparent, focus on #enquire-success-heading, card x and width unchanged. A12 syntax-checked and exits 77 without credentials; it cannot run until deploy.
