# Code edits (exact before -> after)

Constants used below:
- NAME = `National Orchid Show - Western Cape 2027` (hyphen with spaces, exactly as Lee-Ann typed it)
- VENUE = `Hangar 25, Orca Aero Solutions, Stellenbosch Airfield`

## F1 contact
`app/(nos)/national-show/contact/page.tsx:31` `'Caral-Anne van der Merwe'` -> `'Caral-Anne van der Westhuizen'`. Role string unchanged.
`lib/admin-fixtures/data.ts:31` is an unrelated surname fixture: leave.

## F2 NAME
| file | before | after |
|---|---|---|
| components/nos-chrome/nos-nav.ts:35 leadLabel | `19th National Orchid Show` | `National Orchid Show - Western Cape 2027` |
| lib/data/nos-home-landing.ts:195 openingSentence | `The 19th National Orchid Show opens on 23rd September 2027 in Stellenbosch.` | `The National Orchid Show - Western Cape 2027 opens on 23rd September 2027 in Stellenbosch.` |
| e2e/nos-header-brand-and-cta.spec.ts:129 | `'19th National Orchid Show'` | `'National Orchid Show - Western Cape 2027'` |
| public/llms-full.txt:42 | `- 2027-09-23: 19th National Orchid Show — The Hangar, Stellenbosch Flying Club` | `- 2027-09-23: National Orchid Show - Western Cape 2027 — Hangar 25, Orca Aero Solutions, Stellenbosch Airfield` |
| public/llms-full.txt:46 | `...2027-09-23, The Hangar, Stellenbosch Flying Club` | `...2027-09-23, Hangar 25, Orca Aero Solutions, Stellenbosch Airfield` |
| scripts/seed-show-exhibitor-info.ts:341 | `The entry form for the 19th National Show has not been published yet.` | `The entry form for the National Orchid Show - Western Cape 2027 has not been published yet.` |
| :363 | `SAOC's own entry process for the 19th National Show has not been published yet.` | `SAOC's own entry process for the National Orchid Show - Western Cape 2027 has not been published yet.` |
| :368 | `Entry fees for the 19th National Show have not been set.` | `Entry fees for the National Orchid Show - Western Cape 2027 have not been set.` |
| :320 intro | `...entering plants in the 19th South African National Orchid Show...` | `...entering plants in the National Orchid Show - Western Cape 2027...` |
| :587 | `SAOC has not set one for the 19th National Show.` | `SAOC has not set one for the National Orchid Show - Western Cape 2027.` |

Keep the seed `contracts/golden/show-exhibitor-info/seed-show-exhibitor-info.golden.json` untouched (closed contract); note the drift in the dev result.
Slugs, `_id`s and URLs are unchanged everywhere (`societyEvent-15-19th-south-african-national-orchid-show` stays).

### Ruling: ticket numeral XIX (lib/data/ticket-presentation.ts:136,153) -> LEAVE, with caption `19th Show`
Reasons: (1) it is the large decorative glyph of the keepsake ticket stub, rendered by TicketCard/parts.tsx and printed on the PDF ticket (lib/ticket-pdf.ts); a 40-character phrase cannot occupy a numeral slot, so any replacement is a visual design decision, which the no-invention rule reserves to the design handoff / NOS Design; (2) the handoff itself uses "XIX" as an edition mark (design_handoff_saoc/README.md:172). Listed as a question for Lee-Ann / NOS Design.

### Descoped: lib/show-identity.ts
`toOrdinal`/`showLabelWithEdition`/`showTitleWithEdition` render "19th" from the Sanity `nationalShow.edition` value (19) on the home hero CTA, show band and countdown aria-labels. Changing them alters edition-driven behaviour covered by closed contracts (show-visitor-info, f6-home-fidelity, cms-loop-f3). Not listed by Lee-Ann; needs Brad's call. Leave the file untouched.

## F3 VENUE
| file | before | after |
|---|---|---|
| scripts/seed-page-singletons.ts:214 location | `The Hangar, Stellenbosch Flying Club` | VENUE |
| scripts/seed-show-visitor-info.ts:111 VENUE.name | `The Hangar, Stellenbosch Flying Club` | `Hangar 25, Orca Aero Solutions` (matches live Sanity nationalShow.venue.name) |
| :247 gettingThereIntro | `...guidance for the Stellenbosch Flying Club has not been worked out yet...` | `...guidance for Hangar 25, Orca Aero Solutions has not been worked out yet...` |
| :319 | `The show is at Stellenbosch Flying Club, on the R44 at Stellenbosch Airfield in the Cape Winelands.` | `The show is at Hangar 25, Orca Aero Solutions, on the R44 at Stellenbosch Airfield in the Cape Winelands.` |
| :340 | `At the hangar at Stellenbosch Flying Club, Stellenbosch Airfield, on the R44 in the Cape Winelands.` | `At Hangar 25, Orca Aero Solutions, Stellenbosch Airfield, on the R44 in the Cape Winelands.` |
| content/show-pages/01-national-show-landing.json:95 | `...is confirmed: Stellenbosch Flying Club, R44 northbound to Stellenbosch.` | `...is confirmed: Hangar 25, Orca Aero Solutions, Stellenbosch Airfield, R44 northbound to Stellenbosch.` |
| content/show-pages/16-plan-your-visit.json:59 | `...2027 National Show is Stellenbosch Flying Club, R44 northbound to Stellenbosch.` | `...2027 National Show is Hangar 25, Orca Aero Solutions, Stellenbosch Airfield, R44 northbound to Stellenbosch.` |
| content/show-pages/17-faq.json:74 | `The Show will be held at the Stellenbosch Flying Club, R44 northbound to Stellenbosch.` | `The Show will be held at Hangar 25, Orca Aero Solutions, Stellenbosch Airfield, R44 northbound to Stellenbosch.` |
| app/(nos)/national-show/plan-your-visit/page.tsx:53 VENUE_ADDRESS[0] | `The Hangar, Stellenbosch Flying Club` | `Hangar 25, Orca Aero Solutions` |
| scripts/checks/verify-show-page-m1.ts:866, verify-show-page-m3.ts:416 VENUE_SENTENCE | `Stellenbosch Flying Club, R44 northbound to Stellenbosch.` | `Hangar 25, Orca Aero Solutions, Stellenbosch Airfield, R44 northbound to Stellenbosch.` |

(The "R44 northbound to Stellenbosch" fragment is her wording and is kept; flagged as a question below.)

### Documented exceptions (left as is, listed as questions for Lee-Ann)
Her Drive file PLAN YOUR VISIT.docx (id 1QwqjMxhC1WVFGUNouB17OKNDj_XmKicu, modifiedTime 2026-10-24T10:00:15Z, unchanged) still says Flying Club. Therefore verbatim-copy lines stay:
- `app/(nos)/national-show/plan-your-visit/page.tsx:47` DESIGNATED_PARKING ("...provided at the Stellenbosch flying club...") and `:51` VENUE_SENTENCE ("...hangar at Stellenbosch Flying Club, on the R44...").
- Sanity `showVisitorInfo.gettingThereIntro` (same parking sentence).
- `content/show-pages/_name-allowlist.json` entry (still needed while those lines exist).
- `scripts/fix-venue-never-changed-copy.ts` (historical one-shot) and `scripts/checks/**` provenance verifiers.
Drive-source / drive-recovered copies are provenance snapshots: never edited.
Per the Drive-mirror rule, her source Drive doc for the landing/FAQ/plan pages is NOT edited by this contract.

## F4 NAV
components/nos-chrome/nos-nav.ts:
- Programme group (id `programme`): append a link, label `Plant Entry`, href `showPath('/award-entries')` (URL unchanged). Remove the old `exhibitors` / `Award Entries` link from the exhibit group.
- Exhibit group: id stays `exhibit-trade`; heading `Exhibit & trade` -> `Vendors`; keep only the vendors link with label `Exhibitors and vendors` -> `Vendors`, href unchanged. Remove the `international-guests` link entirely.
- Update every reader of the removed/renamed link ids so nothing throws on a missing id: `app/(nos)/national-show/page.tsx:126` EXHIBIT_IDS, `app/(nos)/national-show/award-entries/page.tsx:27` GATEWAY_IDS (drop `international-guests`), and the programme id list in national-show/page.tsx (add the plant-entry link).
- `components/show/ShowSectionNav.tsx`: remove the International Guests item (lines ~82-86); `Award Entries` -> `Plant Entry`; `Exhibitors and Vendors` -> `Vendors`.
- `components/home/ShowBand.tsx:206` link text `Award Entries` -> `Plant Entry`.
- `app/(nos)/national-show/vendors/page.tsx:27` PAGE_TITLE and `:53` og text `Exhibitors and vendors` -> `Vendors` (og: `Vendors — National Show`).
- `app/(nos)/national-show/award-entries/page.tsx:24` PAGE_TITLE `Award Entries` -> `Plant Entry`; `:26` GATEWAY_LABEL `More on Award Entries` -> `More on Plant Entry`. Body copy unchanged ("keep all the same copy").
- `app/(nos)/national-show/sponsors/page.tsx:60` card title `Exhibitors and vendors` -> `Vendors`.
- Comments and e2e specs that name the group (`Exhibit & trade`) updated: NosHeader.tsx:7, national-show/page.tsx:120, e2e/nos-header-brand-and-cta.spec.ts:125 (group names become Visit / Programme / Vendors), e2e/nav-keyboard-operable.spec.ts:7, e2e/utils/nos-nav-hrefs.ts:5, and any e2e expectation counting links.
- Do NOT delete app/(nos)/national-show/international-guests/ or its content/Sanity doc (showPage-05).

### Redirect (next.config.ts redirects())
Add `{ source: '/national-show/international-guests', destination: '/national-show/vendors', permanent: true }`. Verify with curl -I on the local dev server for both the plain path and the NOS-host rewrite path in proxy.ts (expect 308 to the vendors page). If proxy.ts rewrites the NOS host before redirects run, add the equivalent source for it.
