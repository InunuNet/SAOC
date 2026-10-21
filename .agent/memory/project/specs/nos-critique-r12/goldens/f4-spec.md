# nos-critique-r12 F4 — unique meta descriptions (F24 machinery only)

Source: lead task 2026-10-18 (sweep-26f: nine routes share the site default "The South African Orchid Council (SAOC) — coordinating orchid societies across South Africa since 1968."). BASE main 26fde668.

Rules (lib/seo.ts fitDescription, launch-weekend F24 _rules.mjs D1-D4): 70-160 chars as written, or else a sentence-cut of the page's own lede at ≤155, never mid-word. No new copy: every description is text the page already renders.

## Per-route sources

| route | file | description (chars) | source |
|---|---|---|---|
| /about | app/(marketing)/about/page.tsx | "The South African Orchid Council (SAOC) is the national coordinating body for orchid societies and orchid enthusiasts in South Africa." (134) | First sentence of Lee-Ann's About copy, rendered verbatim on the page (about/page.tsx:103-109; Drive "2. About/About page - South African Orchid Council" v1.0). Its sentence-cut at ≤155. PageHero has no lede here. |
| /judging | judging/page.tsx | "Accreditation, awards, and how plants are scored across South Africa." (69) | The PageHero lede (:166), whole. Under 70, but it is the full lede, so it passes D2 as a sentence-cut. |
| /events | events/page.tsx | "Shows, workshops, and council meetings across South Africa's affiliated orchid societies." (89) | The PageHero lede (:64). |
| /contact | contact/page.tsx | "Questions about societies, shows, judging, or membership? Reach the right person, or send us a message." (103) | The PageHero lede (:74). |
| /sponsors | sponsors/page.tsx | "Organisations and businesses that support orchid growing, showing, and judging across South Africa." (99) | The PageHero lede (:59). |
| /societies | societies/page.tsx | **left at default (no source)** | Its only lede is UNSOURCED_LEDE (:25, "21 societies across South Africa…"). It is withheld on the public build because the society count is not in Lee-Ann's Drive (F24 vote 1C). The hero has no lede and Drive has no societies copy locally. Left at the site default, which no other swept route shares after F3/F4, so uniqueness holds. |
| /tickets/<every slug> | tickets/[slug]/page.tsx | the ticket type's Sanity `description` | It renders as the NosHero standfirst (.nos-hero p). The description is the standfirst whole, or its sentence-cut at ≤155. Under 70 chars passes D2 because it is the full lede. |

**Ticket slugs (exhaustive):** f4-rendered takes the union of three lists: _f4.mjs TICKET_SLUGS, every active Sanity ticketType with a slug (checks/_ticket-slugs.mjs, live query, useCdn false), and every /tickets/<slug> the hub links to. At 26fde668 that is 11 slugs: day-visitor, early-bird, fictional-test-show-general-admission, field-trip, qa-fixture-ticket, saoc-symposium, sunset-cocktails-single, vip, weekend-pass, weekend-pass-early-bird, wosa-conference. Their BASE titles, h1s and heroes are in goldens/f4-baseline.json.

- /tickets/day-visitor gets "Single-day general admission to the National Show — choose your day." (its standfirst).
- /tickets/weekend-pass gets "Full-weekend admission to the National Show."
- /tickets/field-trip gets "Transport and entry for one guided field trip outing."

The ticket rows are the 26fde668 CMS values. The code passes `ticketType.description` through, so the CMS stays the source, and f4-rendered checks whatever the build serves.

## Decision (F4 footprint: goldens/f4-footprint.json)

**The five SAOC pages:**
- Add `import { buildPageMetadata } from '@/lib/seo';`.
- `export const metadata: Metadata = buildPageMetadata({ title: '<unchanged>', description: LEDE, lede: LEDE, path: '<route>' });`.
- The hero lede moves into `const LEDE = '…'` and PageHero takes `lede={LEDE}`. The rendered text is unchanged.
- /about passes the first sentence as `description` and no `lede`, because its copy is JSX with <strong> spans. Leave the About copy itself untouched.

**tickets/[slug]/page.tsx:**
- generateMetadata keeps F3's `if (!ticketType) notFound();`, then returns:
  `return { ...buildPageMetadata({ title: ticketType.name, description: ticketType.description, lede: ticketType.description, path: `/tickets/${slug}` }), title: { absolute: `${ticketType.name}${NOS_TITLE_SUFFIX}` } };`
- Add the same import, and the module constant `const NOS_TITLE_SUFFIX = ' — National Orchid Show | SAOC';` (the F24 NOS template, national-show/layout.tsx).
- The NOS title template comes from the lead's 2026-10-18 ruling that /tickets/* is NOS (F3). The tickets route sits outside national-show/, so the layout template cannot reach it, and an absolute title is the only way. og/twitter titles stay the bare ticket name, as buildPageMetadata sets them, like every NOS page.
- Every ticket title becomes "<name> — National Orchid Show | SAOC", and the name already equals the page's h1, so R64 holds.

**Side effects:**
- buildPageMetadata adds the page's own canonical, which is the same URL './' produced before (f4-rendered checks it against 26fde668), plus openGraph and twitter.
- Like every NOS page since F18, the page-level openGraph replaces the root's, so these pages drop og:site_name and og:locale. That is F24's existing behaviour, not a new one.

Edits (@dev): those six files, plus docs/nos-critique-r12.md (an F4 section with this source table).

**Proof:**
- f4-static S1-S4:
  - buildPageMetadata with the BASE title and the route's path;
  - every 20+ char string literal already exists as text or source in the BASE file (NO INVENTION);
  - at most 16 changed lines per page;
  - /societies byte-identical;
  - the ticket generateMetadata shape;
  - docs.
- f4-rendered (public mode), reusing contracts/checks/launch-weekend/f24/_meta.mjs (sweepRoutes, readMeta) and _rules.mjs (descProblems), over F24's routes plus every /tickets/<slug>:
  - D1-D4 on every route;
  - no two routes share a description;
  - every target's description is not the default and is a substring of its own rendered <main> text;
  - each target's title, canonical and hero text equal goldens/f4-baseline.json;
  - /societies keeps the default.
- Negative test at 26fde668: FAIL (12 routes share the default; all 11 targets on the default).
- Positive test on the prototype: PASS (37 routes).

## Addendum (lead 2026-10-18): Codi R64 audit (title follows the h1), Symposium, titles.json, F24-A3 exception

Audit, 26fde668, public mode: every NOS inner route's title head (before " — National Orchid Show | SAOC") against its rendered h1, and the SAOC routes F4 touches.

| route | title head at BASE | h1 | r12 |
|---|---|---|---|
| /national-show/what-to-expect | What to Expect | What to expect | **casing fix** (f4-static S5) |
| /national-show/plan-your-visit | Plan Your Visit | Plan your visit | **casing fix** |
| /national-show/sponsors | Show Sponsors | Sponsors | **fix to the h1**. The lead named it; "Show" is redundant under the NOS suffix. |
| /national-show/exhibitors | Exhibitor Information | Exhibitor Information | already matches |
| /national-show/about | About the Show | 2027 South African National Orchid Show | wording: reported, not changed |
| /national-show/symposium | Symposium | National Orchid Show Symposium | wording: reported, not changed |
| /national-show/international-guests | International Guests | International Guests and Exhibitors | wording: reported, not changed |
| /national-show/archive | Archive | National Show archive | wording: reported, not changed |
| /national-show/vendors/payment/status | Vendor Stand Payment Status | Vendor Stand Payment | wording: reported, not changed |
| /tickets/* | the ticket name (SAOC template) | the ticket name | NOS template (above); the head already equals the h1 |
| /about (SAOC) | About SAOC | About the South African Orchid Council | wording: reported, not changed |
| /judging (SAOC) | Judging | Judging at SAOC | wording: reported, not changed |
| /contact (SAOC) | Contact | Contact SAOC | wording: reported, not changed |
| /events, /sponsors (SAOC) | = h1 | | match |
| /societies (SAOC) | Affiliated Societies | Find an orchid society near you | wording: reported, not changed |

**The casing edits.** Each file equals BASE except one adjacent line pair in its buildPageMetadata call:
- `title: '<from>',` → `title: '<to>',`
- `image: nosOgImage('<from> — National Orchid Show'),` → `image: nosOgImage('<to> — National Orchid Show'),`

The three files are added to goldens/f4-footprint.json. f4-rendered fails any other NOS inner route whose title head differs from its h1, unless _f4.mjs lists it in WORDING_MISMATCH_REPORTED. That keeps the wording mismatches above visible without changing them, since recasing a word is R64 but rewording a title is a copy decision.

**Symposium description (ruled by the lead 2026-10-18, Codi R7).** F24 gave /national-show/symposium a meta-talk description: "This page is the programme and registration hub for the SAOC Symposium." The page renders no lede that fits D1-D4:
- the theme line "From Wild Origins to Cultivated Excellence: The Future of Orchids" is 65 chars and has no full stop;
- the sentence "Uniting conservation, science, and horticulture …" is 185 chars, one sentence.

Ruling: the description is that sentence cut at a word boundary, ending in "…". It is sourced text, truncated, with no words added.
- **Deterministic cut.** `ellipsisCut()` in contracts/checks/launch-weekend/f24/_rules.mjs takes the longest prefix ending before a space within 154 chars, trims it, and appends "…". The result is ≤155 chars. On the 26fde668 sentence that gives "Uniting conservation, science, and horticulture to explore how orchids in their natural environments inform responsible growing, breeding, and the…" (147 chars).
- **Code (@dev).** symposium/page.tsx changes only its metadata `description:` line, to that literal (f4-static S6). The sentence lives in Sanity, not in source, and fitDescription would pass a 185-char string through unchanged, so the literal is the only route through buildPageMetadata.
- **Proof.** f4-rendered derives the expected string at test time, as ellipsisCut() of the first rendered lede longer than 154 chars, and requires equality, so nothing in the check is hand-typed. If the CMS sentence changes, the check fails and names the new cut.
- **F24-A3 exception, explicit and single-route.** `ELLIPSIS_EXCEPTIONS = ['/national-show/symposium']` sits in _rules.mjs. descProblems(desc, lede, route) waives D3 for that route only, and only when the description equals ellipsisCut() of one of its own rendered ledes. F24-A3 (check-c) and the F24-A1 self-test pass the route, and three self-test cases pin the behaviour:
  - the exact cut on symposium passes;
  - the same text on /national-show/about fails D3;
  - a different cut on symposium fails D3.

  f4-rendered also fails if the exception list is anything but that one route. The exception is recorded in goldens/supersession.json (amendedByRuling). It is **replaced when Lee-Ann supplies a shorter lede**: the list then goes back to empty.

**titles.json (F24-A2).** `.agent/memory/project/specs/launch-weekend/goldens/f24/titles.json` has no entry for /national-show/what-to-expect, /plan-your-visit, /sponsors or any /tickets/* route, so nothing in it breaks. No supersession edit is needed. It is listed here for the record, citing R64.

**Other findings for the lead:**
- Test-fixture ticket types are publicly resolvable: fictional-test-show-general-admission and qa-fixture-ticket ("QA Fixture Ticket — Do Not Purchase") are active in Sanity and serve 200 pages. This is P2, a CMS or data decision outside r12, routed by the lead. field-trip is a real product (R200, lead 2026-10-18), not a fixture.
- The R64 wording mismatches above go to the lead and Codi as r13 (after r12 lands); r12 only recases.
- The symposium ticket's title repeats the show name: "National Orchid Show Symposium — National Orchid Show | SAOC". It follows the h1 (R64), so it is not changed.
