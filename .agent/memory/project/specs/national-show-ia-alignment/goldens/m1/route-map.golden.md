# Golden — the /national-show route map (M1 decision, M4 build)

## The hierarchy this map obeys

```
saoc.co.za                     THE home. The Council's site. The only home page.
  └── /national-show           the National Orchid Show. A SUBSECTION.
        └── its marketing pages
```

Binding: `.agent/memory/project/rules.md` — "Site hierarchy — NOS is a SUBSECTION of
saoc.co.za. Never re-litigate this." The show is branded as if it were a different company;
that is **presentation only** and never earns it a home page. Every route below is a child
of `/national-show`. Nothing in this mission touches the SAOC parent site or a sibling
section.

## The arithmetic — 18 spec entries, 17 documents, 16 pages to build

Stating this explicitly because three different subtractions all land near 17 and the
difference matters when someone reads an assertion.

| | count | why |
|---|---|---|
| Entries in the spec's Section 1B sitemap | 18 | content.md:14-33 |
| minus entry 14, Orchid Societies | −1 | Lee-Ann: *"it should remain at the SAOC section… not relevant to the actual reason for the show."* It is a link, not a page, and gets **no `showPage` document at all** |
| **`showPage` documents** | **17** | specNumbers 1–13 and 15–18 |
| of which entry 1 is the **existing** `/national-show` landing page | −1 | reconciled, never created |
| **new pages to build in M4** | **16** | |

Existing routes that already serve a spec entry (3, 12, 13, 16, 17) are **reconciled, not
rebuilt** — they get a `showPage` document and are wired to it; their routes do not move.

## Spec entry 1 is the landing page, and it is not a home page

Entry 1 maps onto `app/(marketing)/national-show/page.tsx`, which already exists.

Its `showPage` document is keyed **`01-national-show-landing`**, titled "The 2027 National
Show". It is deliberately NOT keyed `01-home` and the word "home" appears nowhere in the
model — a key is read by every future developer and `01-home` would reintroduce the exact
misreading `rules.md` was written to stop.

It still gets a document, because spec §4.1 puts editable content on it — hero title,
subtitle, supporting text, news and announcements — and §2.1 and §2.8 require an authorised
non-technical SAOC user to edit that without a developer. A landing page whose copy is
hardcoded in `page.tsx` fails both. The document makes the copy editable; it does not make
the subsection a site.

## The map

Legend: **KEEP** route and content unchanged, wire to its document · **RECONCILE** route
stays, content wired to its document · **CREATE** new route · **LINK** no page ·
**UNTOUCHABLE** out of scope entirely.

| spec | pageKey | route | action |
|---|---|---|---|
| 1 | `01-national-show-landing` | `/national-show` | RECONCILE — exists |
| 2 | `02-about-the-national-show` | `/national-show/about` | CREATE |
| 3 | `03-what-to-expect` | `/national-show/what-to-expect` | RECONCILE — exists |
| 4 | `04-south-african-exhibitors` | `/national-show/sa-exhibitors` | CREATE — see conflict A |
| 5 | `05-international-guests-and-exhibitors` | `/national-show/international-guests` | CREATE |
| 6 | `06-saoc-symposium` | `/national-show/symposium` | CREATE — see conflict B |
| 7 | `07-wosa-conference` | `/national-show/wosa` | CREATE — see conflict B |
| 8 | `08-judging-and-awards` | `/national-show/judging-and-awards` | CREATE |
| 9 | `09-plant-exhibition-and-sales` | `/national-show/plant-exhibition` | CREATE |
| 10 | `10-plant-sales` | `/national-show/plant-sales` | CREATE |
| 11 | `11-programme` | `/national-show/programme` | CREATE |
| 12 | `12-workshops` | `/national-show/workshops` | RECONCILE — exists |
| 13 | `13-booking-tickets` | `/national-show/tickets` | UNTOUCHABLE — document seeded, route and flow not modified |
| 14 | — | none | LINK to `/societies` |
| 15 | `15-sponsors` | `/national-show/sponsors` | CREATE |
| 16 | `16-plan-your-visit` | `/national-show/plan-your-visit` | RECONCILE — exists |
| 17 | `17-faq` | `/national-show/faq` | RECONCILE — exists |
| 18 | `18-contact-us` | `/national-show/contact` | CREATE |

Existing routes with no spec entry, all preserved unchanged: `/national-show/archive`,
`/national-show/archive/[year]`, `/national-show/upcoming`, `/national-show/exhibitors`,
`/national-show/conferences`, `/national-show/vendors/*`.

## Conflict A — `/national-show/exhibitors` is the plant-entry guide, not the directory

`app/(marketing)/national-show/exhibitors/page.tsx:44-53` is the guide for **growers
entering plants for judging** (entry process, fees, classes, judging, eligibility, display,
sales, practicalities, permits). Spec entry 4 is a **visitor-facing directory of nurseries
and growers showing at the event**. Same word, two different pages, two different
audiences.

**Decision: do not move the existing route.** Spec entry 4 goes to
`/national-show/sa-exhibitors` and entry 5 to `/national-show/international-guests`.

**Why not rename the existing route and give entry 4 the better URL.** Because
`/national-show/exhibitors` would then serve *different content at the same URL* — a
bookmarked or shared link would silently show the wrong page, which is strictly worse than
a 404 and cannot be fixed by a redirect. This project already has a documented incident
about link reachability (`components/show/ShowSectionNav.tsx:5-8` — `/national-show/archive`
returned 200 for months with nothing linking to it); silently swapping a live page's
content is the same class of defect with a worse failure mode.

**The human-confusion half is already solved.** `components/chrome/nav-config.ts:57` labels
that route **"Exhibitor Entry"**, not "Exhibitors". The route string is the only place the
ambiguity survives, and it is not visitor-facing.

Backlog, not this mission: revisit the route name after launch, when analytics can say
whether anyone reaches it by URL.

## Conflict B — `/national-show/conferences` conflates entries 6 and 7

`conferences/page.tsx:17-18,32` sells SAOC Symposium, WOSA Conference and a joint track
through one `CategoryTicketsPage category="conference"`. Spec §4.7's Recommendation is the
opposite: *"Build WOSA as its own dedicated section rather than a sub-page of the Symposium,
to strengthen its distinct identity."*

**Decision: split content from commerce.** Create `/national-show/symposium` (entry 6) and
`/national-show/wosa` (entry 7) as two dedicated **content** pages, each with its own
programme, speakers and identity. Leave `/national-show/conferences` exactly as it is as the
**shared registration surface**, and have both new pages link into it.

This satisfies §4.7 in both halves at once. Its Recommendation asks for two distinct
sections — the two new pages are that. Its Key functionality asks only that registration be
*integrated with the booking system*, which the existing shared surface already does. The
research confirms the shared booking plumbing is spec-aligned and it is the page structure
that was not.

Nothing in the ticketing flow is modified. `ticketType`, `CategoryTicketsPage`, the cart and
the checkout are untouched.

## WOSA subject-matter boundary — binding on entry 7

CLAUDE.md: *"SAOC is not wild orchid conservation… Wild orchid identification, habitat
protection, and conservation belong to WOSA… Never produce content about wild orchid
conservation — link to WOSA for those topics."*

Spec entry 7 is nonetheless a real page on this site, because the **WOSA Conference is an
event at this show**. The line is:

| in scope for `/national-show/wosa` | out of scope — link to WOSA's own site |
|---|---|
| conference dates, venue, programme, session times | wild orchid identification |
| speaker names, affiliations, talk titles and abstracts | habitat description or protection |
| registration, fees, capacity, how to attend | conservation status, threats, policy |
| what the conference is and who it is for | field guides, distribution, species accounts |

Spec §4.7's "Key content" asks for photo galleries of indigenous orchids, habitats and
fieldwork, and conservation partner acknowledgements. **Those are conference-subject
content and this mission does not author them.** They are either supplied by WOSA with
attribution, or the page links to WOSA. M3 must not generate them as placeholder copy —
inventing conservation claims about wild South African orchids is the specific harm the
CLAUDE.md rule exists to prevent.

## Navigation — a route with no inbound link is a defect here

`ShowSectionNav.tsx` exists because `/national-show/archive` was reachable only by URL for
months. Every route created by this mission must be reachable by clicking, from at least
one of:

- `components/chrome/nav-config.ts` — the header's National Show group (currently a Visit
  group headed `/national-show` and a Book group headed `/national-show/tickets`)
- `components/show/ShowSectionNav.tsx` — `SECTION_LINKS`, currently 5 entries
- the `/national-show` landing page's own quick links, which spec §4.1 requires ("Quick-link
  buttons to About, Book Tickets, Symposium, WOSA Conference, Programme, Workshops,
  Exhibitors, Sponsors, Plan Your Visit and Contact")

Spec entry 14's link to `/societies` lives here too — it is a nav/footer link and nothing
more, exactly as Lee-Ann asked.

M4 asserts inbound reachability for every created route. A page that exists and returns 200
but that nothing links to has not been delivered.

## Visual design is inherited, never invented

Every route under `app/(marketing)/national-show/**` sits inside
`app/(marketing)/national-show/layout.tsx`, which applies `.nos-theme` and loads the two
show fonts. A correctly-placed page inherits the full NOS identity — palette, type,
masthead — for free.

Compose from `components/nos/*` first, `components/show/*` where exhibitor-entry-style
content applies. **No new colours, fonts, logos, radii or shadows** (CLAUDE.md — no invented
brand assets). `nos-theme.css` is not edited by this mission.

Design questions go to the peer session `saoc-nos-design-cc` as a conversation — see
`codi-handover.golden.md`. We own the structure and the build; they are the design
authority on look.
