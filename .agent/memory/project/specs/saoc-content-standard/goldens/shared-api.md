# saoc-content-standard: shared API golden (PageHero facts + DocumentLayout)

Status: approved by NOS Design (DS-1 r2). NOS Site adopts these names and attributes unchanged; the gate keys on the attributes in section 5. The components are token-neutral: they use CSS custom properties only (`var(--...)`), so SAOC and `.nos-theme` each supply their own values. Where a value differs per site it is named in section 6.

## 1. Files (all new or changed paths)

| path | change |
|---|---|
| `lib/hero-facts.ts` | new: `HeroFact` type, `normaliseHeroFacts()`, `HERO_FACTS_MIN`, `HERO_FACTS_MAX` |
| `components/ui/PageHero.tsx` | changed: optional `facts` prop; renders the `dl` under the lede, above `actions` |
| `components/ui/DocumentLayout.tsx` | new, Server Component: the 7fr/5fr body grid |
| `components/ui/DocumentIndex.tsx` | new, `'use client'`: the h2 index (nav + scroll-spy), rendered only by DocumentLayout |
| `app/globals.css` | new classes `.doc-layout`, `.doc-prose`, `.doc-h2`, `.doc-h3`, `.doc-aside`, `.hero-facts` (SAOC values) |

## 2. Hero facts

```ts
// lib/hero-facts.ts
export interface HeroFact {
  /** The label, rendered as <dt>. Sentence case, 15px sans. */
  term: string;
  /** The value, rendered as <dd>. Copied verbatim from the page's source record. */
  value: string;
}
export const HERO_FACTS_MIN = 2;
export const HERO_FACTS_MAX = 4;
/**
 * Drops any fact whose term or value is empty after trim (an absent field drops out; there is no
 * "To be confirmed" filler and no placeholder field). Returns null when fewer than HERO_FACTS_MIN
 * remain (one fact is not a row). More than HERO_FACTS_MAX is a caller bug: throws unless
 * NODE_ENV === 'production', where it keeps the first HERO_FACTS_MAX.
 */
export function normaliseHeroFacts(facts: readonly HeroFact[] | undefined): readonly HeroFact[] | null;
```
No `source` field is part of the type: provenance lives in the route's code comment and in `goldens/standard.json`, which the gate reads. A `TBC` field does not exist.

PageHero:
```ts
interface PageHeroProps {
  // existing: image, eyebrow, heading, lede, actions, minHeight
  facts?: readonly HeroFact[];   // normalised inside PageHero; a null result renders nothing
}
```
Rendered (inside the existing centred copy block, after the lede and before `actions`):
```html
<dl data-hero-facts data-fact-count="3" class="hero-facts">
  <div data-hero-fact><dt>Dates</dt><dd>23-26 September 2027</dd></div>
  ...
</dl>
```
DOM order is dt then dd (semantics). Visual order is dd above dt (`flex-direction: column-reverse`, v4 `.numbers` grammar). dd: serif 300, `clamp(1.5rem, 1.2rem + 1vw, 2rem)`, tabular lining numerals, colour ivory. dt: sans 15px, sentence case (no `text-transform`), ivory at 85%. Grid gap 24px / 40px, centred, no divider, no box, no caps, no blur. `PageHero` `minHeight` must not push facts below the fold: hero height comes from content (`min-height` stays 480 only as the existing floor and the gate measures the facts inside 900 / 844).

## 3. DocumentLayout

```ts
// components/ui/DocumentLayout.tsx  (Server Component)
export interface DocumentIndexEntry { id: string; label: string }   // an h2 id and its text
export interface DocumentLayoutProps {
  /** The prose column (7fr). Wrap long copy in <div className="doc-prose"> (60-68ch). */
  children: ReactNode;
  /** CONTENT aside: the page's own contextual block (venue, contact, sponsor CTA). Mutually exclusive with `index`. */
  aside?: ReactNode;
  /** INDEX aside: the h2 index for long documents. Rendered only when it has >= 2 entries. Mutually exclusive with `aside`. */
  index?: readonly DocumentIndexEntry[];
  /** Hairline-free wrapper id for anchors; optional. */
  id?: string;
}
```
Slots:
- `main` = `children`, always present. `<div data-doc-main>`.
- `aside` (content variant): `<aside data-doc-aside data-doc-aside-kind="content">` holding exactly ONE card, the children inside it are not themselves cards.
- `index` (index variant): `<aside data-doc-aside data-doc-aside-kind="index"><nav data-doc-index aria-label="Sections">` with one `<a data-doc-index-link href="#id">` per entry; no visible heading (R7). Active link: `aria-current="location"` set by scroll-spy; styled royal + green-1 underline, no side border. Rows >= 44px with hairlines between. Karla/sans 15px.
- Neither: no aside element is rendered at all (`data-doc-aside-kind` absent) and the main column keeps its x (it does not widen).
- Passing both `aside` and `index` throws outside production (caller bug); in production `index` is dropped.

Render:
```html
<div data-doc-layout class="doc-layout saoc-container">
  <div data-doc-main>...children...</div>
  <aside data-doc-aside data-doc-aside-kind="content|index">...</aside>   <!-- optional -->
</div>
```
Geometry (SAOC tokens): `.saoc-container` (1280 max, 32 pad); `grid-template-columns: 7fr 5fr` from 1024px, `gap: clamp(40px, 6vw, 80px)`, `align-items: start`; below 1024 one column. DOM order main then aside at every width. Content aside follows main below 1024. Index aside below 1024 becomes a horizontal scroller (`overflow-x: auto`, edge fade) with `position: sticky; top: <header height>`; it is the same nav element (`data-doc-index` retained). `padding-top` of `.doc-layout` is 64px at >= 1024 and 48px below (the hero-to-content rhythm); sections inside separate by `var(--section-y)` (96px).
`.doc-aside` card: `border-radius: var(--radius-card)`; `box-shadow: var(--shadow-float)`; background white (`var(--surface)`/#fff); padding `clamp(24px, 3vw, 36px)`; `position: sticky; top: 112px` at >= 1024 (header is 97px).

## 4. Type classes (document body)
- `.doc-h2`: `font-size: var(--display-sm)`, weight 300, serif, ink colour, `margin: 0 0 24px` (20-28px). `--display-md` is NOT used in documents.
- `.doc-h3`: 22px / 400, serif, ink.
- `.doc-prose`: `max-width: 64ch`, body 16px / 1.55, `p + p` gap 18px, left aligned.
- No `<p>` whose sole child is `<strong>` inside `[data-doc-main]`.
- Mono `<p>` section labels become `<h2 class="doc-h2">` / `<h3 class="doc-h3">`. Body eyebrow pills are removed on migrated routes (hero eyebrow pills stay).

## 5. Attributes the gate keys on (do not rename)
| attribute / selector | meaning |
|---|---|
| `[data-page-hero]` | existing hero section |
| `[data-hero-facts]`, `[data-fact-count]` | the facts `dl`; count = rendered items |
| `[data-hero-fact]` > `dt` + `dd` | one fact |
| `nav[aria-label="Breadcrumb"]` | existing Breadcrumb component |
| `[data-doc-layout]` | body grid wrapper |
| `[data-doc-main]` | 7fr column |
| `[data-doc-aside]`, `[data-doc-aside-kind]` | the single aside card and its variant |
| `nav[data-doc-index][aria-label="Sections"]`, `[data-doc-index-link]` | the index and its links |
| `.doc-prose` | prose measure box (60-68ch) |
| `.doc-h2` | document h2 |
| `[data-route-focus]` | existing route-focus marker (h1 must show no ring) |
| `[data-home-show-date]` | Home only: the single date fact by the National Show CTA |
Exactly one `[data-doc-aside]` and at most one `[data-hero-facts]` per page.

## 6. Per-site token mapping (what NOS supplies)
| need | SAOC | NOS (proposal) |
|---|---|---|
| container | `.saoc-container` 1280/32 | shared 1384 container class |
| h2 | `--display-sm` / 300 | `.nos-theme h2` clamp(2rem..3rem) / 300 |
| card radius, shadow | `--radius-card` 16, `--shadow-float` | v4 `--radius-md`, `--shadow-md` |
| fact dd colour | ivory | `--gold-100` |
| fact dt colour | ivory 85% | lilac on dark |
| active index link | royal + green-1 underline (SAOC primary / accent) | royal + green-1 underline |
A NOS adopter changes only the CSS custom properties in `.nos-theme .hero-facts, .nos-theme .doc-*`; the TSX and the attributes are shared. The 7fr/5fr ratio and `gap: clamp(40px, 6vw, 80px)` are the same.

## 7. Focus ring on the route-focus h1
`[data-route-focus]:focus { outline: none }` (app/globals.css:162) must out-specify any theme-level `:focus-visible` rule. SAOC has no global `:focus-visible` rule today, so it passes; the gate keeps it that way. NOS found a `.nos-theme :focus-visible` rule that out-specifies it: NOS fixes that in its own theme, not here.
