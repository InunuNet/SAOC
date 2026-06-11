# B2 — About page Sanity wiring

The About page (`app/(marketing)/about/page.tsx`) is an async Server Component that fetches live
content from Sanity CMS. All sections have static fallbacks — the page renders correctly when
Sanity is unreachable or unconfigured.

## What was built

| Section | Data source |
|---|---|
| `PageHero` | Static (hard-coded eyebrow, heading, lede) |
| Pillars ("Our mission") | `aboutPage.pillars` — PortableText |
| Timeline ("Our history") | `aboutPage.timelineNodes` — PortableText |
| Board intro text | `aboutPage.boardIntroText` — plain string |
| Board grid | `boardMember` documents, ordered by `order` field |
| WOSA note | Static — not CMS-driven |

Both Sanity queries run in parallel via `Promise.all` before the component renders.

## Sanity queries

### `aboutPageQuery` — document type `aboutPage`

| Field | Type | Purpose |
|---|---|---|
| `title` | string | Page title (unused in current render, reserved) |
| `pillars` | PortableText blocks | Mission/values content under "Our mission" |
| `timelineNodes` | PortableText blocks | History milestones under "Our history" |
| `boardIntroText` | string | Intro paragraph above the board grid |

Cache tags: `['aboutPage', 'sanity']`

### `boardMembersQuery` — document type `boardMember`

| Field | Type | Purpose |
|---|---|---|
| `_id` | string | React key |
| `name` | string | Member's full name |
| `role` | string \| null | Position title (e.g. "President") |
| `email` | string \| null | Contact email — rendered as `mailto:` link |
| `order` | number \| null | Sort order in the grid |

Cache tags: `['boardMember', 'sanity']`

## Managing content in Studio

**Pillars and timeline** — Open the **About Page** singleton document in Studio (there is only
one). Edit the **Pillars** or **Timeline nodes** rich-text fields using the PortableText editor,
then publish. The page cache is busted automatically by the revalidation webhook.

**Board members** — Each board member is a separate **Board Member** document. Add a new document,
fill in `name`, `role`, `email`, and `order`, then publish. The grid re-orders by the `order` field
ascending — set `order: 1` for the President, `order: 2` for the next role, and so on.

## PortableText

PortableText is Sanity's structured rich-text format. In Studio it renders as a familiar block
editor (bold, italic, headings, lists, links). The site renders it with `@portabletext/react` —
content authors write in the Studio editor and the output appears as styled HTML on the page.
No code changes are needed to add or restructure content within an existing PortableText field.

## Board member fallback

If no `boardMember` documents exist in Sanity (e.g. during local development without credentials),
the page falls back to the static list in `lib/data/board.ts`. Fallback entries are given synthetic
`_id` values (`static-0`, `static-1`, …) and `email: null` so no mailto links appear. As soon as
at least one `boardMember` document is published in Studio, the Sanity data takes over entirely —
the static list is not merged.

## WOSA note

The partnership note at the bottom of the page is intentionally static — it is not driven by a
CMS field. SAOC's scope is orchids in cultivation; wild orchid conservation belongs to the partner
organisation [Wild Orchids of Southern Africa (WOSA)](https://wosa.co.za). Keeping this note
static prevents it from being accidentally removed or altered via Studio.
