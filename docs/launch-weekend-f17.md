# Launch weekend F17: naming, polish, ticket rows, Members link, Explore index

- **Naming (R73).** Builder copy says "National Orchid Show", never "SAOC National Show" (24 files: pages, eight emails, three email subjects, previews, the PayFast item name). Lee-Ann's seven vendor legal sentences and the mega lead title "19th SAOC National Orchid Show" are deliberately unchanged. The CMS `ticketsPage` document still holds the old name; it is edited in Studio, never by code.
- **Nav labels.** Sentence case across the National Show mega and drawer; the label "Exhibitors and Vendors" keeps Brad's casing; "Symposium" drops "SAOC"; the Show sponsors descriptor is "The sponsors behind the National Show." (also in the manifest, its generator and the sponsors page fallback).
- **Members link.** Removed from `nav-config.ts` and `footer-data.ts`. The `/members` route stays.
- **Hub.** Sections that follow a same-ground section carry `nos-section-joined` (padding-top 0) so a pair shares one rhythm unit.
- **Footer.** A no-break space joins "Africa" and the arrow in the WOSA link.
- **Sponsors empty state.** No `.nos-surface` wrapper; marker and card sit on the axis.
- **Symposium.** `ShowContentState` takes `hideContentGap`; the symposium page hides the R11 gap block in public mode only.
- **Ticket rows.** Each price has a visible caption (its CMS SKU name) and its own ghost action to its own SKU. Label comes from the `ticketsPage` singleton `buyButtonLabel`. A sold-out SKU shows `soldOutMessage` on a non-link `aria-disabled` action while its sibling stays live (`lib/data/admission-availability.ts`, a display hint; checkout re-checks capacity). One SKU with two prices has one action. The provisional note sits under the group lede.
- **Explore index.** `NosShowIndex` renders at the foot of the 16 inner National Show routes, current item marked `aria-current="page"`. On tickets, workshops and conferences the marker is ink with an underline (`currentTone="ink"`), because F3-T keeps violet off ticket surfaces.
- **Key dates.** The exhibitors key-dates caption is a full-width block (the table is `display: block` for the row cards).

Spec and checks: `.agent/memory/project/specs/launch-weekend/contract-f17.yaml`, `contracts/checks/launch-weekend/f17/`.
