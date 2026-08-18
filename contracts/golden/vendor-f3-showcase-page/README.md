# F3 — public showcase page `/national-show/vendors`: decision record

Mission `vendor-registration` (`.agent/memory/project/missions/2026-08-17-vendor-registration.md`),
feature F3 only. F1/F2 (naming decision, `vendorNursery` schema) already shipped —
`contracts/contract-vendor-f1f2-naming-and-nursery-schema.yaml` and its own golden README are the
source of truth for the schema this contract builds against; nothing here re-derives or
re-litigates that schema. F4-F11 (Firestore submission pipeline, review workflow, payment path,
permits, human proof, POPIA flag) are **not** in this contract's scope.

**DO NOT IMPLEMENT.** This contract is architecture only. @dev implements against the golden
files and assertions below; nothing under `sanity/`, `components/`, `app/` was touched while
writing this contract, beyond reading it and hashing two files for A6's baseline (see below).

---

## Source, re-read independently

Same source as F1/F2: Lee-Ann's "South African Exhibitors" brief, Google Drive file
`1UKUdzZ9NAJHsqWHSV0mN9tnTrp6NE8I4`, fetched via `gws drive files get` and extracted from
`word/document.xml`. Re-read for this contract on 2026-08-18, specifically the four-paragraph
intro prose block (document lines 1-7) — see "Judgement call 1" below for a real discrepancy
found against the mission brief's framing.

---

## Judgement call 1 — four intro paragraphs, not three

The F3 dispatch brief and the mission brief both say "Lee-Ann's three intro paragraphs." Re-reading
the source `.docx` directly finds **one heading line plus four body paragraphs**, not three:

1. *(heading, not a paragraph)* "Showcasing the Finest in South African Orchid Growing"
2. "The 2027 South African National Orchid Show will proudly showcase..."
3. "Visitors will have the opportunity to meet..."
4. "Exhibitors will present stunning displays of species and hybrid orchids..."
5. "Whether you are building your first orchid collection..."

Rather than guess which one paragraph "three" was meant to exclude — and risk silently dropping
part of Lee-Ann's copy, which the brief itself says is "not to be rewritten, paraphrased, or
'improved'" — this contract renders and gates **all four** body paragraphs plus the heading.
`fixtures/intro-prose.golden.json` holds the exact text, independently re-extracted from the
source for this contract. If the committee later wants one paragraph cut, that is a copy-edit
decision for Lee-Ann to make explicitly, not an inference this contract should make on her behalf.

---

## Component structure

Closest analogue per the dispatch brief: `app/(marketing)/sponsors/page.tsx` +
`components/sponsors/SponsorGrid.tsx` — a Server Component page that `sanityFetch()`s a list,
passes it to a presentational grid component, and renders an inline empty-state block when the
list is empty. `app/(marketing)/national-show/exhibitors/page.tsx` is the structural analogue for
route placement and `loading.tsx` conventions only — its content (Sanity singleton +
GROQ-ordered steps) does not carry over; F3 renders a document-type list, matching sponsors more
closely than exhibitors.

**Why the page is split into three presentational components instead of inline JSX (sponsors'
pattern keeps its empty-state inline in `page.tsx`):** `sanityFetch()` calls `next/headers`'s
`draftMode()` and, when a Sanity client is configured, makes a real network fetch. That means
`page.tsx` itself **cannot be executed in this contract's offline, credential-free checks** — the
"no live Sanity" design constraint rules it out (see "What this contract does NOT prove"). Every
piece of *behavior* this contract needs to prove — the intro prose rendering verbatim, the grid
rendering nursery data correctly, the empty state rendering sane copy — is pulled out into
standalone presentational components with no Sanity dependency, so each one can be imported and
rendered directly with `react-dom/server`'s `renderToStaticMarkup()` against fixture props. Only
the *wiring* between them and `sanityFetch` is checked statically, against source text (A4). This
was verified as workable before committing to it: `next/image` and `sanity/lib/image.ts`'s
`urlFor()` were both confirmed, live, to render/build correctly offline under `node --import
tsx/esm` + `renderToStaticMarkup` (`urlFor()` is a pure URL builder — `createImageUrlBuilder`
never makes a network call) — this is not a hopeful assumption, it was run.

| File | Role | Proven by |
|---|---|---|
| `components/vendors/VendorIntro.tsx` | Static, no props. Lee-Ann's heading + 4 paragraphs, verbatim. | A5 |
| `components/vendors/VendorGrid.tsx` | `{ nurseries: SanityVendorNursery[] }` → responsive card grid. Returns `null` on `[]` (mirrors `SponsorGrid`'s own `if (sponsors.length === 0) return null;`). | A2, A7 |
| `components/vendors/VendorEmptyState.tsx` | Static, no props. "No nurseries yet" message. | A3 |
| `components/vendors/index.ts` | Barrel: `export { VendorIntro } from './VendorIntro'; export { VendorGrid, type SanityVendorNursery } from './VendorGrid'; export { VendorEmptyState } from './VendorEmptyState';` | A8 (lint only) |
| `sanity/queries.ts` — `vendorNurseriesQuery` | `*[_type == "vendorNursery"] \| order(name asc){ _id, name, logo, country, owner, history, specialisation, plantsBrought, website, socialMedia[]{ _key, platform, url }, availableAtShow }` | A1 |
| `app/(marketing)/national-show/vendors/page.tsx` | Server Component. `revalidate = 60` (matches every other CMS-backed route). `sanityFetch(vendorNurseriesQuery)` → `PageHero` + `VendorIntro` + `(nurseries.length ? <VendorGrid nurseries={nurseries} /> : <VendorEmptyState />)`. | A4 (structural only — see below) |
| `app/(marketing)/national-show/vendors/loading.tsx` | Route-level Suspense fallback, same pattern as `exhibitors/loading.tsx`. | A4 (existence only) |

`VendorGrid`'s exported `SanityVendorNursery` type mirrors `SponsorGrid`'s own local
`SanitySponsor` type (defined in the component file, not `types/index.ts` — following the
existing convention exactly, not inventing a new "shared types" location):

```ts
export interface SanityVendorSocialLink {
  platform: string | null;
  url: string | null;
}

export interface SanityVendorNursery {
  _id: string;
  name: string;
  logo: SanityImageSource | null;
  country: string | null;
  owner: string | null;
  history: string | null;
  specialisation: string | null;
  plantsBrought: string | null;
  website: string | null;
  socialMedia: SanityVendorSocialLink[] | null;
  availableAtShow: string[] | null;
}
```

Card markup follows `SponsorGrid`'s existing conventions directly: `border border-rule
bg-parchment p-6 flex flex-col`, `font-serif`/`font-sans`/`font-mono` type scale, `text-ink`/
`text-ink/70`/`text-muted` colour tokens, external links styled `text-ink underline
underline-offset-2` with `target="_blank" rel="noopener noreferrer"`. **No new colour, font, or
spacing token is introduced** — every class used must already exist in `app/globals.css`'s
`@theme` block or already appear in `SponsorGrid.tsx`/`sponsors/page.tsx`, per the project's "No
invented brand assets" rule. This is a judgement call this contract does not mechanically gate
(no check greps for "only tokens already in use") — A8's `eslint` pass and A7's responsive-class
check are the only automated backstops; a genuinely novel arbitrary-value class (e.g.
`bg-[#1a2b3c]`) slipping through is a real gap, named explicitly below.

`VendorEmptyState`'s message is @dev's wording (not itemised anywhere in the source document,
which never describes a zero-nurseries state) — A3 only requires it be real, on-topic copy, not a
specific string. A plausible model, not gated: `sponsors/page.tsx`'s own inline empty-state block
("Become our first sponsor" + a `/contact` link) — reusable almost verbatim, swapping "sponsor"
for "nursery" and, if there is a vendor registration entry point live by then, linking there
instead of `/contact`. Not required by any assertion here since F5's `/api/vendors/register`
route does not exist yet in this mission.

---

## Assertion list, each with its named defeating mutation

| ID | Proves | Defeating mutation |
|---|---|---|
| A1 | `vendorNurseriesQuery` filters `_type == "vendorNursery"`, projects `_id` plus every field the real `vendorNursery` schema declares (derived dynamically from the imported schema, not hardcoded) | Adding a schema field later without a matching query key; a typo'd projection key that silently reads `undefined` |
| A2 | `VendorGrid` renders 0/1/3 fixture nurseries correctly via real `react-dom/server` output: every field, tag, website/social `href`, `target="_blank" rel="noopener noreferrer"` on external links, logo image, no `null`/`undefined` leakage, prop-array order preserved | A field silently dropped from JSX; a missing `rel="noopener noreferrer"` (real tab-nabbing exposure, not cosmetic); re-sorting instead of trusting the query's order |
| A3 | `VendorEmptyState` renders real, on-topic, non-empty copy with no props | Returning `null` (blank page on the normal starting state) or throwing |
| A4 | `page.tsx`/`loading.tsx` exist; `page.tsx` is a Server Component calling `sanityFetch`+`vendorNurseriesQuery`, exports `revalidate = 60`, references all three presentational components, branches on `nurseries.length` | Hardcoding fixture-shaped data instead of calling Sanity; always rendering `VendorGrid` regardless of list length (invisible in the DOM since `VendorGrid` already no-ops on empty, but means the empty-state message never appears) |
| A5 | `VendorIntro` renders the heading and all 4 source paragraphs verbatim, in order, via real render | Paraphrasing; dropping the 4th paragraph to force-fit the brief's "three"; reordering |
| A6 | `app/api/tickets/itn/route.ts` and the existing `.../exhibitors/page.tsx` are byte-identical (SHA-256) to the pre-F3 baseline | Any edit to either file while implementing F3, "helpful" or not |
| A7 | `VendorGrid`'s grid container has an unprefixed `grid-cols-1` base plus `sm:`/`md:` and `lg:` breakpoints | A fixed multi-column grid with no responsive prefixes |
| A8 | `eslint` passes with zero errors on every touched file | An unused import, stray `console.log`, or lint-error-level regression |

---

## `npx tsx` vs `node --import tsx/esm` — checked per file, same trap F1F2 named

`sanity/queries.ts` has no `@/*` alias imports (confirmed: it only imports `next-sanity`'s
`defineQuery` and, at most, sibling files under `sanity/**`) — safe for `node --import tsx/esm`,
used in A1.

`components/vendors/VendorGrid.tsx` **will** import `@/sanity/lib/image` (for `urlFor`) — a real
`@/*` value import. This was tested directly, live, while writing this contract: `node --import
tsx/esm` run from the repo root resolves `@/*` fine here because `tsx`'s loader reads
`tsconfig.json`'s `paths` map, unlike the bare `node --import tsx/esm` in a directory *without* a
reachable `tsconfig.json` (the actual ticketing-f10 trap was a check being run from the wrong
working directory, not `tsx` itself lacking alias support). A2/A5's checks import the real
component files with real `@/*` imports and were run to confirm they resolve — they do, from this
repo's root, which is how the contract gate invokes every check here (relative `command:` paths
in the yaml, no `cd`). No isolated `tsconfig.typecheck.json` is used in this contract (unlike
F1F2's A4) because no check here does a bare `tsc` type-check — every check either runs the real
code (A1-A3, A5) or reads source text (A4, A6, A7).

---

## What this contract does NOT prove

- **No live render of `page.tsx` itself.** `sanityFetch()` has no injectable seam, and calling it
  for real would violate this contract's "no live Sanity" design constraint. A4 checks the wiring
  statically; A2/A3/A5 prove the three components it wires together each behave correctly in
  isolation. The actual composition — does `page.tsx` correctly pass the fetched array into
  `VendorGrid`'s `nurseries` prop, does the ternary really flip at the right length — is real
  code a human or QA must read, not something any check here executes.
- **No visual/browser verification.** Per the dispatch brief, this page renders editorial Sanity
  content — whether it actually looks acceptable, whether the responsive breakpoints genuinely
  read well at 320px (A7 is a class-name proxy, not a viewport render), whether the logo images
  load and crop sensibly, whether the empty-state copy reads well next to `PageHero` — none of
  that is provable by a compiler-driven check. **This is @qa/BrowserAgent's step, done in a real
  browser against a running dev server with seeded and unseeded Sanity data, before the feature is
  called done — not before this contract's gate is green.**
- **No live Sanity round trip, ever.** Every check is fixture-driven or a pure in-process render.
  No `SANITY_API_TOKEN`, no network call, no document created, read, or deleted in the Content
  Lake. `A1` reads the query's source text, not a live query result.
- **No proof that `page.tsx` avoids invented brand classes.** A8's `eslint` and A7's
  responsive-class check are the only automated backstops on styling; a genuinely novel
  arbitrary-value Tailwind class (e.g. a new hex colour) slipping into the page is not caught by
  any assertion here. Left to code review / QA reading the diff against
  `SponsorGrid.tsx`/`sponsors/page.tsx`.
- **No accessibility check** (landmark roles, alt text correctness beyond "an `alt` attribute
  exists," focus order) — not itemised anywhere in this contract's assertions; the project's
  general accessibility coding rule still applies but is not mechanically gated here.
- **No route-collision guard beyond A6's specific two files.** If some other in-flight feature
  also lands a route at `/national-show/vendors` concurrently, this contract cannot detect that —
  it only proves the two named pre-existing files are untouched.
- **No guard on `VendorEmptyState`'s exact wording**, since none is specified by the source
  document — only that it is real, on-topic, non-empty text (A3).
