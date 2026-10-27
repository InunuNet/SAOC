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
