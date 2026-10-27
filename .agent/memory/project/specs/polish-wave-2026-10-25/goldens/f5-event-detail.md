# F5 — event detail (SV-1, SV-2)

Target: app/(marketing)/events/[slug]/page.tsx only. ShowBand/EV-2 is already on main (PR #89, components/home/ShowBand.tsx);
there is no dependency to wait for. Do not edit ShowBand.

## Specification
1. SV-1. For a National Show event render the existing `<ShowBand show={show} />` directly under the meta `<dl>` (before the description).
   Gate: `isNationalShowEvent(event)` from lib/events-list.ts (the same title test the /events page uses). Fetch the show identity with
   `sanityFetch<ShowIdentity>({ query: nationalShowQuery, tags: ['nationalShow', 'sanity'] })`, as app/(marketing)/events/page.tsx:45 does.
   Do NOT pass `detailsHref`: on its own event page the band's secondary CTA must stay the NOS root, which is the ruling's "National Show" link.
2. CTA labels. The ruling names "Tickets" and "National Show". The existing band's labels are "Book tickets" (nosUrl('/tickets')) and "Show details"
   (nosUrl('/')), plus "Exhibitor info". The lead's instruction is existing labels only, so the band is used exactly as it is: "Book tickets" is
   the Tickets CTA, "Show details" the National Show CTA. Renaming them to the ruling's shorter words would be new copy on a shared component and
   would change the home and /events bands too. Raised to the lead as an open decision; the checks pin hrefs, not labels.
   Hrefs come from nosUrl(), i.e. NEXT_PUBLIC_NOS_SITE_URL, never a literal nos.saoc.co.za.
3. SV-2. The kind chip (currently `<p class="mt-6 inline-block rounded px-2 py-0.5 ...">`, page.tsx:90-97) keeps its styling and gains
   `data-event-kind`; it sits on its own line above the h1: block-level, nothing beside it, and exactly 16px from the chip's bottom edge to the
   h1's top edge (drop the h1's `mt-3` and use `mt-4` on the h1, or equivalent; the check measures 16px +-1). The chip stays visually the same.
4. The "← All events" back link (page.tsx:76-82) becomes `inline-flex min-h-11` (44px); no change to its text, size or colour. Keep the 24px
   row above it from collapsing: the chip's top margin is adjusted only as far as needed to keep the visible spacing the same.
5. Docs: docs/polish-wave-f5-event-detail.md, including the open label question.

## Checks
f5-event-static.mjs (import, gate, order, no detailsHref, chip attr, min-h-11, ShowBand untouched), f5-event-detail-rendered.mjs (show event at 4 viewports:
one band below the dl, CTA hrefs on the configured NOS origin, chip gap 16px +-1 and own line, back link >=44px). The live dataset holds one event
(the National Show), so the "ordinary event has no band" half is static-only; the rendered check also covers it when a second event exists.
