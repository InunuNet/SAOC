# Page map, reachability and cross-links

## The route

One route only: **`/national-show/exhibitors`** — rebuilt in place, not moved.

`app/(marketing)/national-show/exhibitors/page.tsx` — Server Component, `revalidate = 60`
`app/(marketing)/national-show/exhibitors/loading.tsx` — route-level loading state

No new routes. The mission's F3 explicitly does **not** create an entry-submission route: the
entry form is a committee-supplied PDF served from Sanity, not a form we build.

## Page order — the exhibitor's own sequence, not our schema's

An exhibitor arriving here is checking a deadline, not reading an essay. Order accordingly:

1. **Hero** — title, intro, back-link to `/national-show`
2. **Key dates** — first, above everything, because it is what most visits are for. With
   `keyDatesNote` making the unset state unmissable *before* the table, not after it.
3. **Entry form** — download, or the honest pending state
4. **The journey** — the seven `showExhibitorStep` documents in `order` ascending
5. **Reference sections** — entryProcess, fees, classes, judging, eligibility, display, sales,
   practicalities, permits
6. **Questions for the show committee** — the `openQuestions` list
7. **Contact CTA** — `/contact`, plus the two cross-links

## Components — all new, all under `components/show/`

| Component | Client? | Notes |
|---|---|---|
| `ExhibitorStatusBadge.tsx` | server | Four-way switch. No literal label strings — all three arrive as props. Unknown/missing status → `pendingLabel`. |
| `ExhibitorKeyDates.tsx` | server | The dates table. Semantic `<table>` with a real `<caption>`; a dates table read by a screen reader as a pile of divs is not accessible. |
| `ExhibitorSteps.tsx` | server | Ordered list of journey steps. Uses `<ol>` — the order is meaning, not styling. |
| `ExhibitorSection.tsx` | server | heading + PortableText body + badge. |
| `ExhibitorQuestions.tsx` | server | The open-questions list. |
| `EntryFormLink.tsx` | server | **The dead-link guard.** See below. |

All six under 150 lines. No `'use client'` anywhere on this page — nothing here needs browser
state. No new CSS custom properties, no hex literals.

### `EntryFormLink` — the honest empty state

```
file present   → <a download> to the Sanity asset URL
url present    → <a> to the URL
neither        → renders entryFormPendingNote as TEXT. No <a>. No href. No button.
```

The failure this guards against is a link element that renders with an empty, `#`, or
`undefined` href — which looks clickable, is clickable, and goes nowhere. The contract asserts at
the rendered level that when no form exists the pending note is present **and** no anchor exists
in that block, and it asserts structurally that the component never emits `href="#"`.

## Reachability

**`/national-show/exhibitors` is already linked** from `components/home/ShowBand.tsx:105`, on the
home page. That inbound edge exists today and this mission must not break it — a rebuild that
silently orphans a page that was reachable before is a regression, not a rewrite. It is asserted
as an edge, not assumed.

Edges the contract proves over real HTTP:

| From | To | Status |
|---|---|---|
| `/` | `/national-show/exhibitors` | **existing** (ShowBand) — must survive the rebuild |
| `/national-show/exhibitors` | `/national-show` | new (back-link, already in the current page) |
| `/national-show/exhibitors` | `/judging` | new — required cross-link |
| `/national-show/exhibitors` | `/contact` | new |
| SearchOverlay | `/national-show/exhibitors` | new — site-wide search entry |

`components/chrome/SearchOverlay.tsx` gains one `SUGGESTIONS` entry:
`{ label: 'Exhibit at the National Show', href: '/national-show/exhibitors' }`.
That file is not reserved by another stream and the change is one line.

### The edge that is NOT in this contract, and why

The natural inbound edge — a link from the `/national-show` landing page — is **not contracted
here.** `app/(marketing)/national-show/page.tsx` is reserved by the visitor stream, which is
editing it right now for its own landing-card work. Contracting a competing edit to the same file
would produce a merge conflict at best and a silent overwrite at worst.

It is booked as gated follow-up **FU-1** in `exhibitorStages-reconciliation.golden.md`. This is a
real gap in the mission's F4 and is reported as one rather than quietly dropped. It is not a
reachability hole today only because the ShowBand edge from the home page already exists.

### The primary header nav is deliberately not expanded

Same decision the sibling made: a six-item bar stays a six-item bar. Reachability comes from the
home-page band, the search overlay, and the show section. Asserted negatively so a later change
has to be deliberate.

## What must NOT be duplicated

| Content | Lives at | This page may |
|---|---|---|
| Show classes | `showClass` documents, rendered on `/national-show` | link, and describe how classes work in general — **never list a class or a class code** |
| Judging standards | `/judging` | link, and describe general judging convention — **never restate a criterion or points scale** |
| Public show dates | `nationalShow.showDate`, rendered on `/national-show` | link — **never restate the dates** |
| Venue | `nationalShow.venue` (visitor stream) | not mentioned at all on this page |
| Wild orchids | `wildorchids.co.za` | link only |

Each of these is asserted, most at the rendered level. The show-classes rule is asserted by
fetching the class codes live from Sanity and requiring that **none** of them appear in the
exhibitors page HTML — a needle read from the dataset, not a pattern guessed in the check.
