---
schema: athanor.mission/v1
slug: show-visitor-info
goal: Expand the National Show from a single teaser landing page into a visitor-information
  section — Plan Your Visit, What to Expect, FAQ and venue/directions — structurally
  complete and fully Sanity-editable, seeded with honestly-labelled placeholder content
  pending committee confirmation
created_at: '2026-08-11T19:33:26.786187+00:00'
started_at: null
last_active_at: null
status: pending
cost_estimate:
  features: 5
  milestones: 3
  total_calls: 0
last_checkpoint:
  milestone: null
  feature: null
  ts: null
features:
- id: F1
  title: Sanity schema + seed for show visitor information
  inline_brief: 'New `showVisitorInfo` singleton (or extend `nationalShow`) carrying
    structured venue address, opening hours, admission notes, parking, accessibility,
    photography policy, cloakroom, travel-from-airport, accommodation and attractions.
    New `showFaq` document type with category + question + answer + order. Seed
    create-if-absent ONLY (never createOrReplace — see seed-page-singletons.ts bug).
    Every placeholder value must carry a visible "To be confirmed by the show
    committee" marker, exactly as ticket prices carry their provisional label.'
  status: pending
  milestone: M1
- id: F2
  title: /national-show/plan-your-visit
  inline_brief: 'Spec §4.16. Getting there (incl. from Cape Town International and
    other national airports), parking, public transport, accommodation grouped by
    distance from venue, local attractions, emergency contacts. Map: static embedded
    map or a linked map — do NOT add a paid maps SDK or any external key. All copy
    from Sanity.'
  status: pending
  milestone: M2
- id: F3
  title: /national-show/what-to-expect
  inline_brief: 'Spec §4.3 + §4.9 visitor-info half. Opening dates and hours,
    admission and concession pricing (cross-link to /tickets, do not duplicate
    prices — Sanity ticketType is the single source), food and refreshments,
    photography policy, cloakroom / plant-holding area, wheelchair accessibility.'
  status: pending
  milestone: M2
- id: F4
  title: /national-show/faq
  inline_brief: 'Spec §4.17. Categorised Q&A (Accessibility, Tickets, Plant Sales,
    Getting There) driven by the `showFaq` document type, grouped by category and
    ordered. Accessible disclosure pattern — keyboard-operable, no JS-only reveal.
    Cross-link to Plan Your Visit and Contact.'
  status: pending
  milestone: M2
- id: F5
  title: Wire the section together — nav, landing-page links, venue block on Contact
  inline_brief: 'The three new pages must be reachable by clicking, not just by URL
    — this is the exact defect already logged against /national-show/archive.
    Add them to the show landing page and site nav, put the venue address and
    directions block on /contact (spec §4.18), and fix the dead
    /national-show/upcoming redirect stub while in the area if cheap.'
  status: pending
  milestone: M3
milestones:
- id: M1
  title: The content model exists and is seeded with honest placeholders
  features:
  - F1
  status: pending
- id: M2
  title: The three visitor-information pages exist and are fully editable
  features:
  - F2
  - F3
  - F4
  status: pending
- id: M3
  title: The section is reachable and coherent, not orphaned URLs
  features:
  - F5
  status: pending
---

# Mission: National Show visitor information

## Context

**Brad's directive, 2026-08-11 (after ticketing M1+M2 shipped).** The National Show is currently a
single teaser landing page. Ticketing now sells entry to a show the site barely describes. Brad:
"We need things like maps, things so we can get from all the national airports to the show, that
kind of stuff. I mean, we don't need to go overboard." Small mission, placeholder pages that cover
the bigger scope — not a full build-out.

### COMMERCIAL FLAG — read before building

There is a real gap between what the client specified and what was priced, and it should be raised
with Brad before or alongside this work, not silently absorbed:

- **`Website Development SpecificationV1.docx` §4** describes an **18-page** National Show section.
- **The accepted `SAOC_Website_Proposal_28-05-2026.docx` prices ONE line:** "2027 Show hub —
  dedicated landing page (venue, dates, programme, FAQs), editable as details are confirmed."

A single landing page carrying venue/dates/programme/FAQ inline was priced. Plan Your Visit, maps,
airport travel and accommodation were **specified but never priced**. This mission deliberately
builds a middle path — 3 pages, not 18 — to cover the visitor-preparation intent cheaply. Anything
beyond it (filterable exhibitor database §4.4, interactive society map §4.14, WOSA Conference §4.7)
is a scope conversation, not a build task.

### Scope discipline

- **WOSA §4.7 is OUT.** Wild-orchid habitat, fieldwork and conservation belong to WOSA's own site.
  Link to `wildorchids.co.za` — never describe that content here. (Note: the site-wide footer link
  currently points at `wosa.org.za`, which does not resolve — see backlog.)
- **Working venue assumption: CTICC (Cape Town International Convention Centre).** Brad's call,
  2026-08-11: "If we guessed wrong, they'll have to correct us and then we'll put the new venue
  in. But we can still scope the work around that." So BUILD against CTICC — real directions,
  real distance from Cape Town International Airport, real public-transport options, real
  accommodation grouped by distance from CTICC. Concrete content beats empty scaffolding, and it
  shows the committee what the page becomes.

  **Two conditions on that.** (1) The venue must remain visibly marked as pending committee
  confirmation wherever it appears — the 2026-08-11 status report still lists confirmed dates and
  venue as outstanding, and `CTICC, Cape Town` / `Sep 17–21 2027` exist only as hardcoded
  fallbacks in `page.tsx`, sourced to no client document. (2) Every venue-derived value must live
  in Sanity, never hardcoded into a component. When the committee names a different venue, the
  fix is editing fields in Studio — not a developer rewriting pages. Treat that as a design
  constraint on F1's schema: if changing the venue would require a code change, the model is wrong.
- **Do not invent facts beyond the venue assumption.** Dates, opening hours, parking specifics,
  admission conditions and FAQ content stay labelled placeholders until the committee supplies
  them. Travel and accommodation guidance researched against CTICC is acceptable and should be
  labelled as our own research, not as committee-confirmed detail.
- **Every unconfirmed value carries a visible marker** — same posture as the ticket prices'
  "Provisional price — pending council confirmation." The lesson from the ticketing mission: ship
  visibly-pending content, never plausible invention, because it goes in front of the council.
- **No new brand assets, colours or fonts.** Sage & Paper tokens in `app/globals.css` only.

### What already exists

`app/(marketing)/national-show/`: `page.tsx` (real, 491 lines — hero, countdown, show classes,
exhibitor stages, cycle timeline); `upcoming/page.tsx` (redirect stub only); `exhibitors/page.tsx`
(generic placeholder, not the §4.4 database); `archive/` + `archive/[year]/` (real, Sanity-backed).

`sanity/schemas/documents/nationalShow.ts` has: title, showDate, location (plain string), hero,
countdownDate, exhibitorStages, salesOpen. **No structured address, no coordinates, no travel or
accommodation fields, no FAQ type.** F1 is therefore a prerequisite for F2–F4.

### Content needed from Lee-Ann / the committee

Confirmed venue address and exact dates; opening hours; parking; accessibility specifics;
photography policy; cloakroom/plant-holding; accommodation list; emergency contacts; FAQ content.
Until supplied, every one of these renders as a labelled placeholder. Add to the call-prep doc.

## Notes

- Source of truth for the page list: analyst extraction of the client docs, 2026-08-11.
  Spec §4.2, §4.3, §4.9, §4.16, §4.17, §4.18 map onto F2–F5.
- Admission pricing must cross-link to `/tickets`, never duplicate the figures — Sanity
  `ticketType` is the single source of truth and those prices are still provisional.
- Reachability is a first-class requirement (F5): `/national-show/archive` is the standing
  cautionary example — built, returns 200, and nothing on the site links to it.
