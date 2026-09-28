# nos-hero-lockup — hero structure golden

Authoritative synthesis of `placement-spec.md` + `reference-artifact-SjeY6NP8-v4.html`
+ the design rulings, resolved where those sources conflict. Dev implements against
THIS file's decisions, not against a fresh reading of the artifact.

## 1. Scope boundary (why some obvious artifact matches are NOT done here)

- `Approval sequence` (nos-design-rulings.md): *"Nothing rolls across the remaining
  routes until Brad has approved the hero it is templated from."* This feature is
  that first hero. Anything that would touch the other 18 `/national-show/*` routes,
  or the footer/colophon, is explicitly held back to a follow-up feature, even where
  R14/R23 argue for it everywhere.
- Concretely OUT of scope for F1: the masthead's continued use on the other 18
  routes (kept, unchanged), the footer/colophon lockup (still hand-composed, still
  an R23 violation, untouched), the sitewide `--font-serif`/`--font-sans` token swap,
  `components/chrome/**`, `nav-config.ts`, any copy rewrite, button internal order,
  hero photograph/crop/focal-point.

## 2. The band above the hero (R12 "is retired")

`app/(marketing)/national-show/layout.tsx`'s `<header data-nos-masthead>` wraps
**every** child route (about, archive, conferences, exhibitors, faq,
international-guests, plan-your-visit, programme, sa-exhibitors, sponsors,
symposium, tickets, vendors, what-to-expect, workshops, wosa-conference, plus the
home page itself) — 19 routes total. Brad's "is retired" instruction is scoped to
the hero page; removing the `<header>` block outright removes it from all 19.

**Decision:** route-scope the masthead instead of deleting it. Add
`components/nos/NosMasthead.tsx` (`'use client'`, calls `usePathname()` from
`next/navigation`), rendering the existing masthead markup (`Link` + `Logo
orientation="responsive" tone="light"`, `data-nos-masthead` intact) for every
pathname **except** an exact match on `/national-show`, where it renders `null`.
`layout.tsx` swaps its inline `<header>…</header>` block for `<NosMasthead />`.
Colophon (`<footer data-nos-colophon>`) is untouched — it renders everywhere,
including home, same as today.

This satisfies Brad's instruction for the one page it names, changes nothing on
the other 18, and needs no route restructuring.

## 3. EmblemBadge in the hero

Drop the `brandMark={<EmblemBadge />}` prop (and the now-stale F21 comment above
it) from the `<NosHero>` call in `page.tsx`. `EmblemBadge.tsx` itself is untouched
— it is still legitimately used by `Logo.tsx` inside `NosMasthead` on the other 18
routes and in the footer.

## 4. The `<h1>`: lockup image, not text

`NosHero` already special-cases `titleSize="display"` for this one call site —
extend that same exclusive gate, do not add a new generic `<h1>`-as-image mode
that every hero could opt into.

- `title` becomes a `ReactNode` the call site builds with `next/image`'s
  `getImageProps()` (available in this Next 16 project) composed into a real
  `<picture>`: one `<source media="(max-width: 620px)">` → the vertical master,
  one fallback `<img>` → the horizontal master. `getImageProps` gives the
  automatic 2x `srcSet` (R22/8) without hand-rolling it.
- Exactly one `<img>` exists in the rendered DOM at any width (native `<picture>`
  source-matching, not two CSS-hidden elements) — one accessible name, no
  screen-reader duplication.
- `alt="National Orchid Show, Western Cape 2027"` on the fallback `<img>` only
  (the element that always carries the accessible name in a `<picture>`).
- Native dimensions on the `<img>`: horizontal master is 4108×1008, vertical is
  3272×2876 — pass real `width`/`height`, let CSS constrain display size, so
  there is no layout shift and next/image can compute the correct `sizes`-driven
  candidate.
- `data-nos-hero-lockup` on the wrapper — a QA/gate handle, same convention as
  `data-nos-masthead`/`data-nos-colophon`.

### Served files (R22 byte-identity)

Copy, do not touch:

- `branding/National Show 2027/Logo/NOS-2027-logo-full-colour-reversed-horizontal.png`
  → `public/images/nos/lockup/NOS-2027-logo-full-colour-reversed-horizontal.png`
- `branding/National Show 2027/Logo/NOS-2027-logo-full-colour-reversed-vertical.png`
  → `public/images/nos/lockup/NOS-2027-logo-full-colour-reversed-vertical.png`

`cmp` must report no difference between master and served copy (R22/7 — the
repo copy is byte-identical; next/image's own optimiser resizing/re-encoding on
the way to the browser is delivery, not editing, and is unaffected by this).

## 5. Placement

Both boxes are positioned relative to the hero's existing content column — the
`max-w-[1280px]` wrapper with `px-8` (32px) horizontal padding already in
`NosHero.tsx`, whose inner width is exactly Brad's 1216px reference column at
viewport ≥1280.

**Desktop (>620px):**
- Box width: `min(1140px, 93.75%)` of the content column (93.75% = 1140/1216 —
  Brad's own scale-below-1216 instruction).
- `margin-left: -32px` relative to the column — this exactly cancels the
  column's own left padding, so the box's left edge lands flush with the
  section's outer 1280px edge, matching "32px outside the column's left edge."
- `margin-top: 46px` from the hero content column's top.
- `margin-bottom`: tune so the *visible ink* (not the transparent-canvas box) sits
  ~58px above the eyebrow below it. The file carries built-in clearspace, so this
  is a visual measurement, not the raw 58px applied as a CSS margin — confirm via
  the 1280 screenshot in `visual-checklist.md`, record the value used and how it
  was checked.

**Mobile (≤620px, centred variant — supersedes the earlier horizontal-inset
version in `placement-spec.md`):**
- Vertical file, box width `min(365px, ~104%)` of the column (scales up slightly
  on narrower phones per the spec note).
- `margin-left: calc(50% - <rendered-width>/2)` to centre the box in the column.
  Do not use `margin-inline: auto` — the spec notes it fails because the box is
  15px wider than the visible ink, which would look off-centre.
- `padding-top: 3px` above the box (from the hero column's own top).
- `margin-bottom: 8px` raw, tuned/verified the same way as desktop so the ink
  sits ~37px above "The Flagship" — confirm via the 390 screenshot.
- Only the mark is centred. The Flagship / Edition XIX / lede / meta / buttons /
  countdown all stay left-aligned, unchanged.

## 6. Order below the lockup

The reference artifact's actual hero markup (not the prose paraphrase) is:

```
<h1 lockup> → eyebrow "The flagship" → hero-eyebrow-2 "Edition XIX" → meta →
count → btn-row
```

— no lede in the artifact at all. But Brad, via Codi (`placement-spec.md`), has
already been shown that the lede duplicates the mark's name and explicitly said
**do not rewrite it** — which only makes sense if it stays. R7 (copy is not
invented, and by the same logic, not silently deleted) backs keeping it. The
`ConfirmationBadge` (dates status) is live functional content with no equivalent
in the static mockup; nothing in scope asks for its removal.

**Resolved order for this build** (lockup and the two eyebrows first, matching
the artifact; lede kept per Brad; meta/count/buttons in the artifact's relative
order; ConfirmationBadge kept in its current relative slot):

```
1. lockup <h1>                          data-nos-hero-lockup
2. eyebrow "The Flagship"                data-nos-hero-eyebrow
3. eyebrow-2 "Edition {roman}"           data-nos-hero-eyebrow-2   (NEW)
4. lede                                  data-nos-hero-lede
5. meta dl                               data-nos-hero-meta
6. ConfirmationBadge                     (unchanged, unmarked)
7. buttons row (internal order unchanged) data-nos-hero-buttons
8. countdown ("Opens in" + ShowCountdown) data-nos-hero-countdown
```

Button internal order is NOT changed to match the artifact's — reordering three
existing CTAs wasn't asked for and isn't a lockup concern; flagged, not applied.

### Reordering `eyebrow` and adding `eyebrow2` — both gated on `isDisplayTitle`

`NosHero.tsx`'s internal render order is currently fixed:
`brandMark → eyebrow → h1 → lede → actions`. Matching the artifact means
`eyebrow` moves to *after* `h1` and a new `eyebrow2` slot appears between `h1`
and `lede` — but only for this one call site. `NosHero` already branches
several times on `isDisplayTitle` (layout direction, the top-down scrim, the
type scale); add one more branch there rather than reordering the shared JSX
unconditionally:

- `isDisplayTitle === false` (the other 11 heroes): unchanged —
  `brandMark → eyebrow → h1 → lede → actions`.
- `isDisplayTitle === true` (this hero only): `h1 → eyebrow → eyebrow2 → lede
  → actions`. `brandMark` is not rendered in this branch at all — this call
  site no longer passes one (§3), and no other display-mode hero exists yet to
  need the slot; if one ever does, that's the point to decide where a mark
  goes relative to a lockup image, not now.

Add a new optional `NosHeroProps` field, `eyebrow2?: ReactNode`, rendered only
inside the `isDisplayTitle` branch, between `h1` and `lede` —
`data-nos-hero-eyebrow2` on its wrapper. `eyebrow`'s own wrapper gets
`data-nos-hero-eyebrow` (both branches) so the order check in the contract can
locate it regardless of which branch rendered it.

Content: replace the current plain `<p>` "Edition {roman}" (today rendered
inside `actions`, before the meta grid, `font-sans text-[13px] ...
text-ivory/90`) — move it into `eyebrow2`, restyled to match the artifact's
`.hero-eyebrow-2` structurally: `font-mono` (JetBrains Mono — already loaded
sitewide per R1, no new font load), `text-[11px] uppercase tracking-[0.22em]`.
**Colour stays `text-ivory/90`**, not the artifact's `--gold-300` — that colour
is unverified in this codebase and `text-ivory/90` is the value already
measured and documented at this exact spot (see the F22 comment in
`page.tsx`). Do not introduce a new colour token to chase a pixel match; R9's
"measured, not guessed" applies.

### FLAGSHIP eyebrow — colour/family only

The `eyebrow` prop's content and its call-site value (`"The Flagship"`) are
unchanged — only its position (now after the lockup, in the `isDisplayTitle`
branch above) and its Tailwind classes move: family switches from the shared
`font-sans` (Jost) to the new hero-scoped Karla variable (§7); size/tracking/
weight/colour stay as already measured in this codebase — do not adopt the
artifact's raw `--olive-500` without a fresh contrast pass (out of scope here).

## 7. Fonts (R14)

Fraunces and Karla do not exist anywhere in this repo today (confirmed by
search). `--font-serif`/`--font-sans` (and the `font-serif`/`font-sans`
Tailwind utilities) are declared once on `.nos-theme` and consumed by every one
of the 19 routes AND by `Logo.tsx`'s hand-typeset masthead/footer wordmark. Per
§1's scope boundary, do not repoint those two names — that would silently roll
Fraunces/Karla onto all 19 routes and reflow the still-in-place (out of scope)
composed lockup's fake wordmark.

**Decision:** load Fraunces and Karla in `layout.tsx` as two *additional*
`next/font/google` variables — `--font-nos-fraunces`, `--font-nos-karla` —
alongside the existing Cormorant/Jost ones (still required by `Logo.tsx`
elsewhere). Inside this hero only, wherever text currently reads the shared
`font-sans` utility (eyebrow, eyebrow-2's family stays mono, lede, meta `dt`/
`dd`, countdown's "Opens in" label), switch to the new Karla variable via a
Tailwind arbitrary value, e.g. `font-[family-name:var(--font-nos-karla)]`.

No Fraunces application ships in this feature: the one piece of display-scale
text this hero ever carried (the `<h1>`) is now an image, so there is no display
text left in the hero to set in Fraunces. Cormorant is confirmed absent from the
hero's rendered text (it was only ever reached via `font-serif` on the old
text `<h1>`, which is gone). Fraunces loads regardless (`layout.tsx` is where
R14's sitewide font decision eventually lands) but the golden assertion is
narrower: **no `font-serif` utility anywhere in `NosHero.tsx`.**

Backlog (not this feature): repoint `--font-serif`/`--font-sans` sitewide to
Fraunces/Karla and retire `Logo.tsx`'s hand-typeset wordmark (R23), once this
hero is Brad-approved as the template (Approval sequence).

## 8. Scrim (R10/R15)

`NosHero.tsx`'s `titleSize === 'display'` branch is already the exclusive gate
for this one call site (the other 11 heroes pass the default `titleSize` and
must render byte-for-byte as they do today). Inside that branch only, replace
the current three-layer scrim (bottom-up + left-right + conditional top-down,
all `rgba(14,11,36,…)`) with the single required gradient:

```css
background: linear-gradient(90deg,
  rgba(11,10,20,0.94) 0%,
  rgba(11,10,20,0.80) 30%,
  rgba(11,10,20,0.44) 52%,
  rgba(11,10,20,0.18) 75%,
  rgba(11,10,20,0.04) 100%);
```

One `div`, `inset-0`, `aria-hidden`. No vertical/top-down layer, no photo
filter/duotone (already true — do not regress it). The other 11 heroes' scrim
markup is untouched — do not refactor it "while you're in there."

## 9. What ships vs. what's flagged for Brad/Codi

Ships in F1: masthead retired on `/national-show` only (§2), EmblemBadge out of
the hero (§3), lockup `<h1>` with byte-identical served masters (§4), placement
(§5), element order incl. new Edition XIX eyebrow-2 (§6), Karla in the hero only
(§7), single R10/R15 scrim gated to this hero (§8).

Flagged, not applied — needs Brad/Codi sign-off before a follow-up feature:
masthead retirement on the other 18 routes, footer/colophon R23 fix, sitewide
Fraunces/Karla token swap, button reordering to match the artifact.
