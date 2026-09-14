# Golden — the `/national-show` hub, restructured into four groups

`/national-show` is a **subsection landing page, never a home page**. Under the approved
structure it is also the subsection's **entire primary navigation**: the design handoff
specifies a flat six-item header with `National Show` pointing here and **no dropdown**
(`design/design_handoff_saoc/src/chrome.jsx`). If a page is not on this hub and not in
`ShowSectionNav`, nothing on the site links to it.

That raises the hub from "nice overview" to load-bearing, which is why its structure is a
golden rather than a layout preference.

---

## The four sections, in this order

| # | `id` | heading | pages, in this order |
|---|---|---|---|
| 1 | `visit` | **Visit** | About the Show · What to Expect · Plan Your Visit · Questions |
| 2 | `programme` | **Programme** | Programme · Workshops · SAOC Symposium · WOSA Conference · Conference Registration |
| 3 | `exhibit-trade` | **Exhibit & Trade** | South African Exhibitors · International Guests · Exhibitor Entry Guide · Trade Vendors |
| 4 | `the-show` | **The Show** | Tickets · Show Sponsors · Past Shows |

Group ids, labels and member order are exactly `goldens/m4/route-manifest-schema.golden.md`'s
`groups` array and its `listed: true` rows.

### The hub keeps literal `href` entries — corrected 2026-09-10 after merge `42437ed2`

Revision 1 of this golden said the hub should **render from the manifest**, so there is never a
second hand-kept list. That was wrong, and merging `origin/main` showed why.

`specs/site-content-alignment/contract-f3.yaml` is another mission's contract, and it is green:

| its id | what it greps |
|---|---|
| `A11` | `href: '/national-show/about'` in `components/show/ShowSectionNav.tsx` |
| `A12` | `href: '/national-show/about'` in `app/(marketing)/national-show/page.tsx` |

`A12`'s own description names the reason: *"the hub page's existing `VISITOR_CARDS` array uses
the same `href: '/path'` object-literal convention… the array literal, not a JSX attribute
string, is where the real link data lives."* Generating those lists at runtime deletes both
literals and turns another mission's passing gate red.

**So the literals stay, and the anti-drift property moves from runtime to gate time.** `D53`
parses both arrays and asserts their `href` sets equal the manifest's `listed: true` slugs
**exactly, in both directions**. The guarantee is the same — the hub, the nav and the manifest
cannot disagree — and nothing else breaks to get it.

The general lesson is worth keeping: *"derive it, don't hand-maintain it"* is a good instinct
that becomes a defect the moment another team is asserting against the hand-written form. Check
who else greps a file before generating it.

## Structural requirements

1. **Every one of the 16 child pages appears in exactly one group**, as a link, with its
   manifest `label` as the link text. 16 links, no page in two groups, no group empty. (`H1`)
2. **Each group is a real landmark** — a `<section>` with an accessible name matching its
   heading, and a heading element in document order ahead of its links. A group that is only
   a styled `<div>` is invisible to a screen-reader user navigating by heading, and the hub is
   the whole navigation. (`H2`)
3. **The hub links out to `/societies`** (spec entry 14 gets a link and no page) and it is
   visibly *not* one of the four groups' members — it is a link out of the subsection, not a
   show page. (`R4`)
4. **The four group grids obey R13** — column count derived from the rendered member count,
   never a hardcoded class. See `goldens/m4/grid-orphan-rule.golden.md`. With 4, 5, 4 and 3
   members the derived counts are **4, 3, 4, 3**. The `programme` group is the one that
   proves the rule is live: a hardcoded `lg:grid-cols-4` would leave one orphan and pass
   every other check here. (`G3b`)
5. **No NOS-specific header, and no second nav** (R12). NOS identity begins **below** the
   SAOC chrome. The hub renders zero `<header>` elements and zero `role="banner"`; the only
   navigation landmark inside the NOS content region is `ShowSectionNav`, whose accessible
   name is `National Show section`. (`N15`)
6. **The hub keeps its existing show content** — countdown, dates, venue, the show's own
   words. The four groups are *added structure*, not a replacement. A hub that becomes a bare
   link index has thrown away the copy this mission spent M3 sourcing. (`H3`, diffed against
   the pre-M4 rendered text: every text run present before is still present.)

## Ordering rationale, stated so it is not re-litigated at the keyboard

`Visit` first because most arrivals are visitors. `Programme` second because it is what a
visitor asks next. `Exhibit & Trade` third — a smaller, self-selecting audience who will
navigate deliberately. `The Show` last because `Tickets` and `Past Shows` are already reachable
from the hero and the archive respectively, so their position here is redundancy rather than
the primary path.

This is the order Brad's approved tree lists, and it is not an architect's re-derivation.

## What this golden does not settle

- **Visual treatment of the groups** — cards, rules, spacing, whether headings are eyebrows or
  serif. Codi's, and downstream of the structure existing.
- **Whether a member should also carry a one-line hint** like `ShowSectionNav`'s. Left to the
  design lane; `H1` counts links and does not forbid a hint.
