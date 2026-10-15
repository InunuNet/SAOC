# F2 golden: NOS type (R14) and hero (R15) on /national-show/* page bodies (mission nos-own-brand-chrome)

Authority: Brad approved NOS design v4 on 2026-10-15; NOS Design (design lead) ruled on the type mapping. Sources vendored beside this file:

- `r14-type-mapping.md` (cited **M:n**, line n): the R14 mapping verbatim plus the R15 inner-hero and hub-hero items 3-7.
- `mock-index.html` (cited **I:n**): the approved mock, inline CSS. **Where M and I disagree, I wins** (M:3). Every disagreement found is listed in section 6 so the dev and NOS Design can see which side was applied.
- F1 spec `../f1/f1-chrome-spec.md` and `../f1/HANDOFF.md` ("Hub hero", H:223-234).

`docs/rules/no-invention.md` applies: no value below is the architect's; each is cited. Anything without a clean mapping is in section 7 (QUESTIONS FOR NOS DESIGN), not guessed.

## 1. Scope and decisions

| Question | Decision | Why |
|---|---|---|
| Scope | `/national-show/*` page bodies: `nos-theme.css`, `national-show/layout.tsx`, NOS page files, `components/nos/**`, `components/show/**`, `components/nos-chrome/fonts.ts` (italic only), and one shared-looking file, `components/tickets/CategoryTicketsPage.tsx` (its only two importers are `/national-show/workshops` and `/conferences`; verified by grep). SAOC routes stay byte-identical: `components/ui/PageHero.tsx`, the rest of `components/tickets/**`, `components/vendors/**`, `app/globals.css` and every non-national-show route are NOT editable (F2-S scope check + F1 A3). | Brief. |
| How shared SAOC components inside NOS pages are re-fonted | Only through `.nos-theme` custom-property redeclaration. `font-mono` / `var(--mono)` in `components/tickets/*`, `components/vendors/*`, `components/ui/*` resolve through `--font-mono`/`--mono`, which `app/globals.css` declares on `:root` (`--font-mono: var(--mono)` is resolved at `:root`, so it inherits as the already-computed JetBrains stack). Redeclare the **names** on `.nos-theme` (nos-theme.css's own header explains this trap for colours): `--font-serif`, `--serif` -> `var(--font-nos-fraunces), Georgia, 'Times New Roman', serif`; `--font-sans`, `--sans`, `--font-mono`, `--mono` -> `var(--font-nos-karla), 'Helvetica Neue', Arial, sans-serif`. No `monospace` fallback anywhere. Headings that shared components set to weight 500 (`font-medium`) are corrected by scoped **unlayered** rules in nos-theme.css (same technique as its existing focus reset): `.nos-theme :is(h1,h2,h3,h4,h5,h6) { font-weight: 400; font-optical-sizing: none; text-wrap: balance }` and a default `font-variation-settings: "opsz" 24` for h3-h6. | Brief; M:27. |
| The three PageHero routes | `/national-show/about` renders SAOC's `PageHero` (purple wash, mono 10.5px eyebrow, centred). `/workshops` and `/conferences` render it via `CategoryTicketsPage`. All three move to `NosHero` (inner variant): about's page file swaps the component; `CategoryTicketsPage.tsx` swaps `PageHero` for `NosHero`. `NosHero.image` is typed to the five rights-cleared files (`NOS_HERO_IMAGES`), so a `heroImage` outside those five is a type error to resolve by choosing one of the five, never by widening the type. | Lead: "about and the other inner pages using that hero"; PageHero cannot change. |
| Heroes: one component, two variants | `NosHero` root is `<section data-nos-hero="hub">` for `titleSize="display"` and `data-nos-hero="inner"` otherwise. The 11 existing inner heroes and the three converted ones are all `inner`. | Checks select on it. |
| Fonts config | Fraunces keeps `axes: ['opsz']`, no `weight` (F1 A14), and gains `style: ['normal', 'italic']` in BOTH `national-show/layout.tsx` and `components/nos-chrome/fonts.ts` (blocks stay character-identical, A14). Reason: M:5 LOAD lists `ital`, and the archive pages and `JudgingGroupCard`/`PastEditionCard` set Fraunces italic, which would otherwise be a synthetic oblique. `Cormorant_Garamond` and `Jost` imports and their classes are removed from layout.tsx. Karla config unchanged. | M:5, M:17. |
| Hub hero fold (ruling 2026-10-15 Q1) | At 1280x800 the first screen shows the h1, lede, facts and BOTH CTAs (every bottom <= 800). The countdown sits directly below the CTAs (DOM and visual order), may fall below the fold, and is never beside the facts. The dev may tune only `.hero-inner` padding-block, the 28/24px gaps and the facts row gap, only within the mock's values. If the CTAs still miss the fold the dev reports the measured px instead of moving anything else. | NOS Design. |
| Countdown (Q2) | Stays (the page renders one today), directly below the CTAs. Digits: Fraunces 300, opsz 72, lining + tabular, 42px. TBC state: Fraunces 300, opsz 24, 24px. Unit labels: Karla 700 12px .14em uppercase. | NOS Design. |
| Inner h1 (Q3) | max-width 14ch; size clamp(2.6rem, 1.6rem + 4vw, 5.5rem) on inner heroes only (hub keeps the mock clamp); no hyphenation, no break-all. New check F2-H4: at 360/375 no h1 word box exceeds the content width and scrollWidth == clientWidth. | NOS Design. |
| Eyebrow (Q4) | Dropped from every inner hero (the approved template has none) and from the hub. Strings removed are listed in section 7a. | NOS Design. |
| Body colour (Q5) | Body copy that inherits royal becomes ink-700 `#3A3654` (`.nos-theme` root colour included). Headings, links and elements the mock paints royal stay `#211A57`. | NOS Design. |
| F1 A13 | F1's scope check reads F1's narrower allowlist and rejects every F2 page edit by design. For the F2 run it is superseded by **F2-S** (`check-f2-scope.mjs`, `goldens/f2/scope-allowlist.json` = F1 allowlist + F2 additions). Every other F1 check runs unchanged as a regression. | Both cannot hold. |

## 2. R14 type roles (every value cited)

Loaded faces: Fraunces (ital, opsz, wght 300..500) and Karla (400..700), nothing else (M:5, I:6). Headings: `font-optical-sizing: none` and `font-variation-settings: "opsz" N` pinned per role (M:5, I:84). Scale rem: xs .75, sm .875, base 1, body 1.0625, md 1.25, lg 1.5625, xl 1.9375, 2xl 2.4375, 3xl 3.0625, 4xl 3.8125 (M:7, I:32-41).

| Role | Family / weight / opsz | Size, line-height, tracking | Cite | Asserted by |
|---|---|---|---|---|
| Body root (`.nos-theme`) | Karla 400 | 17px (1.0625rem), lh 1.65 | M:20, I:69-79 | F2-T3 |
| Hub h1 | Fraunces 300, opsz 96 | clamp(3.2rem, 2rem+4vw, 5.5rem); at <=700 clamp(2.8rem, 12vw, 3.4rem); lh 1; -0.01em; gold-100 `#FBFAF0`; max 11ch | M:10, I:141, I:315, H:225-227 | F2-T3, F2-H2 |
| Inner h1 | Fraunces 300, **opsz 24** | clamp(2.6rem, 1.6rem+4vw, 5.5rem) (ruling Q3; the mock I:249 had 3.2rem/2rem); lh 1; -0.01em; gold-100; max **14ch** (ruling Q3; mock 9ch) | I:249 + ruling Q3 (M:11 says opsz 96: I wins, section 6 D1) | F2-T3, F2-H2 |
| Hub lede | Fraunces 300, opsz 28 | clamp(1.3rem, 1.1rem+.8vw, 1.625rem); lh 1.42; max 34ch; gold `#F3F2D6` | M:12, I:143 | F2-T3 |
| Inner standfirst | **Karla 400** (no family set, inherits body) | 20px (`--fs-md`), lh 1.6, max 34ch, gold-300 `#E8E6C2` | I:250 (M:12 says serif 28: I wins, D2) | F2-T3 |
| Section h2 | Fraunces 400, opsz 48 | clamp(2rem, 1.5rem+1.6vw, 2.4375rem); lh 1.15; -0.01em. The closing-band h2 may be larger, up to 3.8125rem (I:231), so the check allows 31.3..61.2px but never below the base clamp | M:13, I:158, I:231 | F2-T3 |
| h3-h6 / card, list, destination titles | Fraunces 400; opsz 24 when <=22px (md, 20px), 32 when <=28px (lg, 25px), 48 above ("nearest role above", M:27) | lh 1.2-1.25 | M:14, I:184, I:216, I:224 | F2-T3 |
| Numerals / figures | Fraunces 300, opsz 72 (96 at >=4.75rem); `lining-nums tabular-nums`; lh 1 | per mock (I:171 clamp(2.6rem,2rem+2vw,3.8125rem), I:198, I:223) | M:15 | F2-T3 (countdown digits only, see Q2) |
| Hero fact label (`dt`) | Karla **600**, 12px, tracking **.16em**, uppercase, gold-300 | | I:146 (M:22 says 700/.14em: I wins, D3) | F2-T3 |
| Countdown digits / TBC / units | digits Fraunces 300 opsz 72 lining+tabular 42px; TBC Fraunces 300 opsz 24 24px; units Karla 700 12px .14em uppercase | | ruling Q2, M:15, M:22 | F2-T3 |
| Body copy colour | ink-700 rgb(58,54,84) on the `.nos-theme` root and on paragraphs that inherited royal at alpha 1 (explicit alpha, muted and on-dark paragraphs exempt); h1-h3 outside heroes royal rgb(33,26,87) (light headings on dark skipped) | | ruling Q5, M:20 | F2-T3 |
| Hero fact value (`dd`) | Karla 400, 16px (`--fs-base`), lh 1.45, gold-100 | | I:147 | F2-T3 |
| Labels, group heads, chips (hero eyebrows are gone) | Karla 600 or 700, 12-14px, uppercase, tracking .12-.18em | mapping .14em (M:22); the mock uses .12 (I:197), .14 (I:124, I:196, I:215), .16em (I:146) so the check accepts the whole band | M:22, I:124, I:146, I:196-197, I:215 | F2-T3 |
| Buttons / CTAs | Karla 700, .875rem (14px), tracking .12em, uppercase, min-height 50px | | M:23, I:101-107 | F2-T3 (`data-nos-button`) |
| Small / secondary text | Karla 400, .875rem | | M:21 | (family only, F2-T1) |
| Italic | Fraunces italic, same weight/opsz as its role | | M:17 | F2-T1 (real italic face loads when used) |
| Every other Fraunces text | weight 300 or 400, opsz pinned to one of {24, 28, 32, 36, 48, 72, 96} (the set used in I), headings optical-sizing none | | I:143, 158, 171, 184, 198, 214, 216 | F2-T3 |
| Floor | no visible text under 12px (visually hidden <=2px boxes exempt) | | M:24, M:27 | F2-T2 |

Mono is gone: every `font-mono` label (hero DATES/HOST, countdown units, "Opens in", badges, `PageHero` eyebrow) becomes the Karla label role (M:34). F2-T1 forbids any computed family whose stack contains cormorant, jost, mono, jetbrains, crimson, manrope, lora, courier, menlo, consolas or sfmono on any visible element or form control, and forbids a Cormorant/Jost `FontFace` from even being declared. (Crimson/Manrope/JetBrains are still declared by the SAOC root layout, which F2 must not touch, so only their `loaded` status is judged.)

## 3. R15 hero ramps (the scrim)

One gradient only, `90deg`, every stop `rgb(11, 10, 20)` (= `--black #0B0A14`, I:21), never purple. Literal `rgba()` stops: the existing Tailwind `bg-gradient-*` with `var()` colours computes to `oklab(...)` and is rejected.

**R15/9 (2026-10-16) supersedes the per-hero ramps below the heading.** Both heroes use the same ramp, at >=1024px only:

| Stop | Alpha | Position |
|---|---|---|
| 1 | .92 | 0 |
| 2 | .86 | calc(min(640px, 50%) + 48px) (Chromium serialises `calc(48px + min(640px, 50%))`) |
| 3 | .42 | 66% |
| 4 | .18 | 82% |
| 5 | .06 | 100% |

The copy column is capped at `min(640px, 50%)` of the hero at >=1024px (measured h1.left to the widest copy or CTA right edge, +1px tolerance). Source: R15/9 in the NOS rulings file; the old mock ramps (I:139, I:247) no longer apply.

Stacked at **<=1023px for BOTH heroes**: no gradient at all, solid `rgb(11, 10, 20)` ground, no scrim, photo static below the copy at 4:3 (4:3 or 16:9 between 768 and 1023). The facts-after-CTAs order and full-width CTAs stay at the mock's <=700 (I:307, I:318); the hub h1 small clamp stays at <=700.

## 4. Hero geometry

Hub (I:136-148, I:304-318):
- `min-height: clamp(600px, calc(100svh - 97px), 820px)`; at 1280x800 that is 703px. Hero top is 97px (the F1 header). Ruling Q1: h1, lede, facts and both CTAs end at or above y=800; the countdown may be below.
- Photo: `[data-nos-hero-media]` inset `0 0 0 22%`, `mask-image: linear-gradient(90deg, transparent 0, #000 16%)`, `object-position: 68% 50%` (I:137-138).
- Copy: h1 first, `padding-block: 72px 56px` (h1 at least 72px below the hero top; 40px stacked, I:314), `gap: 28px`, `.hero-body` max 640px with `gap: 24px`, facts `grid 2 columns, gap 20px 32px, max 620px` with a 1.5px `--green-2` left border (I:140-147). Order desktop: h1, lede, facts, CTAs, then the countdown directly below the CTAs.
- Stacked (<=1023, R15/9; facts-after-CTAs and full-width CTAs only at <=700): column; copy first on solid black; photo `[data-nos-hero-media]` in flow, `aspect-ratio: 4/3` (4/3 or 16/9 at 768-1023), no mask, `object-position: 64% 50%`; `min-height: 0`; facts move after the CTAs (I:307); CTAs full width (I:318).
- CTAs stay as F1 left them: "Plan your visit" (`on-dark`) first, "Find your society" (`ghost-on-dark`) second, both `data-nos-hero-button` (F1 A21).

Inner (I:245-256):
- No eyebrow (ruling Q4). `min-height: clamp(360px, 32vw, 460px)`, `display: grid; align-content: center`, photo `inset: 0` behind the copy (`object-position` per page focal point), copy `padding-block: 64px`, `gap: 22px`.
- <=1023 (R15/9, was 620): `min-height: 0`, `align-content: start`, photo static below the copy at 4:3, copy `padding-block: 48px 32px`.

Contrast (brief): the brightest composited pixel behind every hero text run keeps >= 4.5:1 with that run's colour, at 1280, 1024, 768, 390 and 375 (F2-H3), floor stays 4.5:1. The 14ch inner and 11ch hub h1 caps stay, and the hub fold at 1280x800 must still hold with the column cap. A route that still fails goes to NOS Design before any photo swap (R16); `no-photo-swap` (below) fails any added, removed or renamed photo reference without goldens/f2/r16-photo-swap-ruling.md.

## 5. DOM contract (checks select on these)

```
section[data-nos-hero="hub" | "inner"]     NosHero root
  [data-nos-hero-media]                     wrapper around the photograph (hub: inset 22% + mask; stacked: in flow, 4:3)
    img                                     the one photograph (first img in the hero)
  (scrim: a div or ::before/::after; found by computed gradient, no hook needed)
  h1                                        exactly one
  [data-nos-hero-lede]                      the lede / standfirst <p> (both variants)
  [data-nos-hero-eyebrow]                   absent everywhere (ruling Q4)
  dl > div > dt, dd                         hub facts
  [data-nos-hero-button] x2                 hub CTAs (F1)
  [data-nos-hero-text^="countdown-"]        hub countdown (existing attributes on ShowCountdown, keep them)
[data-nos-button]                           components/nos/Button.tsx root, every variant
```

## 6. Where the mapping and the mock disagree (mock applied)

- **D1** inner h1 opsz: M:11 "identical to hero h1" (96); I:249 pins 24. Applied 24.
- **D2** inner standfirst: M:12 "Hero lede/standfirst (serif) opsz 28"; I:250 sets no family and 20px. Applied Karla 20px. The hub lede is serif 28 (I:143, both agree).
- **D3** fact labels: M:22 label = 700 / .14em; I:146 = 600 / .16em. Applied 600 / .16em on the hub `dt`. Elsewhere the check accepts 600 or 700 and .12-.18em (the mock itself uses 600 and .12/.14/.16em).
- **D4** hub scrim has 6 stops (I:139) while the brief's R15 ramp has 5; the 5-stop ramp is the inner hero's (I:247). Each hero gets its own.

## 7. NOS Design rulings of 2026-10-15 (answers to the architect's five questions)

1. **Hub fold:** "countdown inside the fold" is dropped. The first screen shows the h1, lede, facts and both CTAs (bottoms <= 800 at 1280x800); the countdown sits directly below the CTAs, may fall below the fold, never beside the facts. Dev levers: `.hero-inner` padding-block, the 28/24px gaps, the facts row gap, within the mock's values only; otherwise report the measured px.
2. **Countdown:** digits numerals role at 42px; TBC Fraunces 300 opsz 24 at 24px; unit labels Karla 700 12px .14em uppercase.
3. **Inner h1:** 14ch; inner size clamp(2.6rem, 1.6rem + 4vw, 5.5rem), hub keeps the mock clamp; no hyphenation, no break-all; check at 360 that no h1 word box exceeds the content width ("International" worst case) and scrollWidth == clientWidth.
4. **Inner eyebrow:** dropped from inner heroes.
5. **Body colour:** body copy that inherits royal becomes ink-700 `#3A3654`; headings, links and mock-royal elements stay `#211A57`.

6. **/archive/[year] label (ruling 2026-10-16):** the `editionLabel` eyebrow becomes the current breadcrumb crumb "Show history — {editionLabel}", using the tickets-page breadcrumb pattern: the crumb is Karla at breadcrumb size, unlinked, `aria-current="page"`; "Show history" links to `/national-show/archive`; the label text stays verbatim from `editionLabel` and does not repeat in the h1 or standfirst. Asserted by F2-C on every archive year route the archive index links (2012, 2015, 2018, 2021, 2024 today), 1280 and 390. The check accepts any `nav[aria-label="Breadcrumb"]` outside the chrome and requires: a "Show history" link to /national-show/archive, one unlinked `[aria-current="page"]` crumb whose text matches `Edition <roman> · <year>` (or the bare year) ending in the route year, Karla, >= 12px, no hero eyebrow, and the label absent from the h1 and `[data-nos-hero-lede]`.
7. **Muted and alpha body copy (ruling 2026-10-16):** with the base at ink-700, text such as `text-ink/80`, muted, ink-500 or lilac-muted must measure >= 4.5:1 on its actual ground; anything failing is raised to solid ink-700 `#3A3654` (NOS Design correction: ink-500 is lighter and would lower contrast). Purely decorative glyphs are exempt per WCAG 1.4.3: anything `aria-hidden`, or a single non-alphanumeric symbol; they must still never be the only carrier of meaning. Asserted by F2-H5 (below).

8. **R15/9 hero stack, ramp and contrast (2026-10-16):** see section 3 and 4. Breakpoint 1023 for both heroes, column cap min(640px, 50%), new 5-stop ramp, A13 stays 4.5:1, no photo swap without R16.
9. **R25 headings (2026-10-16):** FAQ category heads and the AccommodationList group label are real headings (h2, or h3 under a page h2), not `<p>`; no heading level skips. Asserted by F2-K1 (rendered) and static `heading-markup` (AccommodationList renders only when accommodation data exists, so it is checked in source). Lead-in captions ("※To be confirmed...", "Each entry will show") are not group heads and are exempt; making them headings is allowed.
10. **R25 no text in bare `<div>`:** card names are h3 (AccommodationList card name h3, or h4 under an h3 group label), FAQ question text stays in button/summary/span, the date range is `<p class="meta">`; colour comes from a class, not the element (static `colour-by-class` forbids `color:` on bare p, a, div, span, li selectors (headings keep role colour from element selectors, ruling 2026-10-16) in nos-theme.css; `.nos-theme .prose p` and any class-qualified selector are fine). Asserted by F2-K2.
11. **R25 no mono:** `.font-mono` maps to Karla 700 12px .14em uppercase (F2-T3 role check); no element on any NOS route may compute to a mono family (F2-T1 `check-f2-fonts.mjs` already fails any visible element or control whose stack contains mono, jetbrains, cormorant, jost, etc.). The h2 size is scoped to NOS: F2-S1 compares SAOC h2 computed styles against goldens/f2/saoc-h2.json (captured from the F2 base, SAOC files untouched per scope) and fails if any SAOC h2 computes to Fraunces or Karla.
12. **Confirmed:** the archive breadcrumb (ruling 6) and the removal of the six hero eyebrows (7a).

### 7a. Hero eyebrows removed, by route (for NOS Design to confirm none carried unique information)

| Route | Eyebrow string |
|---|---|
| /national-show (hub) | "The Flagship" and the second line "Edition {roman}" (from `toRomanOrdinal(edition)`) |
| /about, /tickets, /vendors, /vendors/apply, /vendors/payment, /vendors/payment/status, /vendors/register, /vendors/photos, /faq, /exhibitors, /plan-your-visit, /what-to-expect | "National Show" |
| /workshops, /conferences | "2027 National Show" |
| /archive | "Show history" |
| /archive/[year] | `editionLabel(show)` (dynamic, e.g. "Edition XVIII · 2024"): moves to the breadcrumb crumb (ruling 6), so nothing is lost |
| /programme, /symposium, /wosa-conference, /sa-exhibitors, /international-guests, /sponsors | none passed |

## 8. Checks (contracts/checks/nos-own-brand-chrome/f2/, run from the worktree root)

`node --import tsx/esm contracts/checks/nos-own-brand-chrome/f2/<check>.mjs`; they share F1's `_lib.mjs` (spawn `next start` on `NOS_PORT`, default 3617; `NOS_REUSE_SERVER=1 NOS_BASE=http://localhost:<port>` to reuse one). Build first: `SITE_PUBLIC_LAUNCH=true pnpm build`.

Routes covered by the browser checks (all 17): /national-show, /about, /what-to-expect, /plan-your-visit, /faq, /programme, /workshops, /symposium, /wosa-conference, /conferences, /sa-exhibitors, /international-guests, /exhibitors, /vendors, /tickets, /sponsors, /archive (all under /national-show).

| Check | File | Asserts |
|---|---|---|
| F2-T1 | `check-f2-fonts.mjs` | no Cormorant/Jost face declared or loaded; only Fraunces/Karla loaded; no mono/Cormorant/Jost/etc. on any visible text or control; italic Fraunces is a real face when used. 1280 + 390 |
| F2-T2 | `check-f2-floor.mjs` | no text under 12px. 1280, 390, 375 |
| F2-T3 | `check-f2-roles.mjs` | section 2 roles (computed family, weight, opsz, size, lh, tracking, colour). 1280 + 390 |
| F2-H1 | `check-f2-hero-scrim.mjs` | section 3 R15/9 ramp at >=1024, never purple, none when stacked (<=1023), black ground. 1280/1100/1024/1023/768/767/620/390/375 |
| F2-H2 | `check-f2-hero-layout.mjs` | section 4 geometry: no eyebrow in any hero, h1 11ch/14ch, padding, min-height, 22% inset + mask, 4:3 stacked photo below copy (<=1023, 16:9 allowed 768-1023), column cap min(640px,50%) at >=1024, facts-after-CTAs and full-width CTAs at <=700, h1/lede/facts/both CTAs <= y=800 at 1280x800, countdown directly below the CTAs |
| F2-H4 | `check-f2-h1-words.mjs` | 360/375: no h1 word box wider than the content, no hyphens:auto / break-all, no horizontal scroll |
| F2-H3 | `check-f2-contrast.mjs` | brightest composited pixel behind hero text >= 4.5:1 at 1280/1024/768/390/375 (`NOS_F2_CONTRAST_MIN` overrides) |
| F2-S | `check-f2-scope.mjs` | diff against `c0e48c39` only touches `goldens/f2/scope-allowlist.json` files |
| F2-C | `check-f2-archive-crumb.mjs` | ruling 6: breadcrumb "Show history" link + unlinked aria-current editionLabel crumb in Karla, label not repeated in h1/standfirst, no hero eyebrow; every linked archive year, 1280 + 390 |
| F2-H5 | `check-f2-body-contrast.mjs` | ruling 7: every muted/alpha text run outside hero, chrome and buttons (colour alpha < 1 or rgb(106,103,128)) >= 4.5:1 on the screenshotted real ground, exempting decorative glyphs (aria-hidden or a single non-alphanumeric symbol, e.g. "※" on /plan-your-visit and /faq); de-duplicated by colour + class, `NOS_F2_BODY_CAP` (40) per page and width |
| F2-K1 | `check-f2-headings.mjs` | R25: label-styled group heads before lists are h2-h6 (FAQ needs >= 2), no heading level skip, 17 routes |
| F2-K2 | `check-f2-text-elements.mjs` | R25: no Fraunces text in a bare div (tabular numerals and hero hooks exempt); what-to-expect date range is `<p class="meta">` |
| F2-S1 | `check-f2-saoc-h2.mjs` | R25: SAOC h2 computed styles equal goldens/f2/saoc-h2.json on 6 routes x 1280/390; none computes to Fraunces/Karla |
| static | `check-f2-static.mjs <mode>` | `type-clean`, `theme-tokens`, `layout-fonts`, `colour-by-class`, `heading-markup`, `no-photo-swap` (uses goldens/f2/photo-refs.json; `capture-photo-refs` is architect/lead only), `logo-orphan` (`components/nos/Logo.tsx`, the typeset logo artwork, is the one file exempt from the Cormorant/Jost ban and must stay un-imported) |

No horizontal scroll at 360/375/390/768, SAOC byte-identical, the 17-route chrome checks and the hub h1/CTA check are F1's own checks, run unchanged as regressions (contract R-assertions).

## 9. Base results (worktree on :3002, F1 uncommitted, 2026-10-15)

| Check | Base | Reading |
|---|---|---|
| F2-S scope | pass | 66 changed files, all inside the allowlist (F1's work) |
| static type-clean / theme-tokens / layout-fonts | FAIL | `font-mono` in 10+ `components/show/*`, `--sans` leads with Jost, `--font-mono`/`--mono` undeclared, layout still imports Cormorant_Garamond and Jost |
| static logo-orphan | pass | Logo.tsx has no importer |
| F2-T1 fonts | FAIL | 1248 problems: Cormorant/Jost declared and loaded, JetBrains Mono loaded, mono/Cormorant/Jost computed everywhere |
| F2-T2 floor | FAIL | 9: `PageHero` eyebrow 10.5px on /about, /workshops, /conferences |
| F2-T3 roles | FAIL | 993: body is Jost 16px, h1/h2/buttons/labels all Cormorant/Jost 500 |
| F2-H1 / H2 / H3 | FAIL | no `[data-nos-hero]` yet; base heroes also carry purple `rgba(14,11,36)` ramps, `oklab` PageHero wash, min-height 520px, hub 731px tall (ends y=828 > 800) |
Self-test: the same measurement code run against the approved mock (`mock-index.html`, hub and a synthetic `.ihero`) accepts both ramps, the 22% inset, mask, 4:3 stack, h1 sizes at 1280/700/390, and the Fraunces/Karla role values, so the checks pass on a faithful build.
