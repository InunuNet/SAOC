# Naming rule: follow-up sweep list (nos-landing-v1 does NOT change any of these)

Her rule (L11-13): the name of the site and the event across all pages and copy reads "National Orchid Show", and where appropriate "- Western Cape 2027". Measured on origin/main @ 98aa1da1 by grep over app/(nos), components/nos, components/nos-chrome, components/show, lib/data, lib/site-metadata.ts, emails. Prior work: specs/official-title-sweep (primary checkout, untracked) standardised on "The National Orchid Show" (leading "The", ASCII hyphen) via lib/show-title.ts. Her rule has no leading "The" and her own headings mix en dash (L5) and hyphen (L13). That conflict is D1/the sweep's ruling, not decided here.

## A. Short form "National Show" where the event name is meant
- components/nos-chrome/nos-nav.ts:31 label 'National Show'; :34 eyebrow 'The National Show'
- components/nos/NosHero.tsx:228 breadcrumb "National Show" (and the :151 comment)
- components/nos-chrome/NosHeader.tsx:250 aria-label `${LOCKUP_ALT}, National Show home`
- components/show/ShowSectionNav.tsx:42 label 'National Show'; :114 aria-label "National Show section"
- app/(nos)/tickets/[slug]/page.tsx:44 breadcrumb 'National Show'
- app/(nos)/national-show/archive/page.tsx:75 sr-only h2 "National Show editions"
- app/(nos)/national-show/award-entries/page.tsx:37 heading 'National Show Awards'
- app/(nos)/national-show/media-kit/page.tsx:46 heading "National Show 2027"; :27 comment
- app/(nos)/national-show/programme/page.tsx:30 description "...of the National Show."
- app/(nos)/national-show/tickets/page.tsx:60 body "...exhibiting at the National Show."
- OG image titles "... — National Show": workshops/page.tsx:47, vendors/page.tsx:53, vendors/apply/page.tsx:13, vendors/register/page.tsx:43, vendors/payment/page.tsx:37, vendors/payment/status/page.tsx:21, vendors/photos/page.tsx:23, tickets/page.tsx:46, conferences/page.tsx:35
- app/(nos)/national-show/wosa-conference/page.tsx:67 "held alongside the National Show"
- lib/data/builder-brief-summaries.ts:9,10 ("National Show"), :6,:11,:12,:13 ("2027 National Show")
- emails/VendorPaymentConfirmation.tsx:45 button "View the National Show"

## B. Word order "2027 National Orchid Show" (her form is "National Orchid Show - Western Cape 2027")
- app/(nos)/national-show/vendors/apply/page.tsx:15,30; vendors/register/page.tsx:44,76; vendors/payment/page.tsx:38,77; vendors/payment/status/page.tsx:22,66; vendors/photos/page.tsx:24,65; tickets/page.tsx:48
- app/(nos)/national-show/media-kit/page.tsx:20,41 "National Orchid Show 2027"
- lib/data/builder-brief-summaries.ts:5

## C. Leading "The" (the title sweep's form; her rule has none)
- lib/show-title.ts:2 SHOW_TITLE, :4 SHOW_TITLE_EXPANDED (the sweep's constants; every importer follows)
- app/(nos)/national-show/sponsors/page.tsx:36 "...of The National Orchid Show."
- app/(nos)/national-show/archive/[year]/page.tsx:71,72,118,158 "The ${...} National Orchid Show"
- app/(nos)/national-show/page.tsx:87 (hub LEDE, replaced by this feature), :89 (ABOUT_BODY, removed by this feature)

## D. Retired long form still in our own strings
- app/(nos)/national-show/page.tsx:106 ABOUT_HEADING '2027 South African National Orchid Show' (removed by this feature, D5)
- app/(nos)/national-show/what-to-expect/page.tsx:33 metadata description ends "African National Orchid Show." (confirm against the page)

## E. Lee-Ann's verbatim copy that carries "National Show" or "2027 National Show": DO NOT TOUCH in a sweep
Her Drive text, protected by the title sweep's allow-list and docs/rules/no-invention.md: about/page.tsx:39 ("the National Show explores"), symposium/page.tsx:36, sponsors/page.tsx:38 ("The 2027 National Show is made possible..."), sponsors/page.tsx:51, what-to-expect/page.tsx:43,45. If the naming rule is meant to reach her own prose, the owner asks her; the sweep does not edit it.

## F. Not measurable from code
Sanity-driven strings (nationalShow title, showPage documents) and the supplied lockup images' alt text beyond LOCKUP_ALT. Route to SAOC.
