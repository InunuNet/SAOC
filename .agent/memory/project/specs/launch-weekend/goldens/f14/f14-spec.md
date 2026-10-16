# F14 design spec: home NavCards and ShowBand

Base: origin/main e9f7d4f9. Files: `components/home/NavCards.tsx`, `components/home/ShowBand.tsx` (plus an optional F14-commented block in `app/globals.css`; the reference build needed none). Every value is cited to the handoff (`design/design_handoff_saoc/`): README = `design_system_README.md`, src = `src/styles.css`, tokens = `colors_and_type.css`. Machine-readable targets: `tokens.json` (the checks read it).

Skills applied: impeccable (critique, audit, polish, craft-floor; launcher unavailable, so context was read directly), frontend-design, web-design-guidelines, accessibility. Critique ran single-context, not as two isolated sub-agents (degraded: sub-agent cost not justified for a two-section pass). Measurements are from a production build of e9f7d4f9 at 390, 1280 and 1920. Before shots: `.tmp/sandbox/lw-f14/before/`. A throwaway reference build proving the spec is satisfiable: `.tmp/sandbox/lw-f14/after/` shots and `reference-prototype.patch` (uncommitted, not a deliverable; the dev implements against this spec).

Craft-floor note: impeccable bans a kicker above a heading. The handoff pins the eyebrow pill ("Flagship event", "Find your way in") and Brad's rule bars copy changes, so the eyebrows stay. The brief wins.

## 1. Critique of what renders now

### NavCards ("Four ways into SAOC")
1. The reaction Brad calls absent exists but is below perception. Hover = Tailwind stock `shadow-md` on parchment-on-bone, image scale 1.03 at 300ms, arrow nudge at 150ms. No border, colour, title or lift change. Durations 200/300/150ms are off the handoff's 150ms. There is no `focus-visible` state at all (measured: keyboard focus shows only the UA outline on a card that otherwise stays still).
2. Flat blocks: borderless parchment on bone. The handoff `.navblock` has a 1px `--rule` border (src `.navblock`); this build dropped it.
3. Inverted hierarchy: title 18px/500 against 16px prose (ratio 1.125). Handoff title is 24px/600 (src `.navblock__title`).
4. Sub-floor mono: meta 10px, badge 10px; handoff meta 11px, badge 10.5px.
5. `flex-1` on the h3 pushes one-line titles away from their prose: a ~50px hole in the "Since 1968" card and ragged prose baselines across the row.
6. Mobile: two columns at 390 leave a 107px measure for 16px prose (5 to 7 lines), meta wraps onto the arrow, cards are 552px tall.
7. Good, keep: whole card is one anchor; arrow is aria-hidden; 16px prose is already on main (the 13px was a stale working-tree defect, not on origin/main); contrast of prose and meta passes.

### ShowBand
1. Gutter: the grid sits in `max-w-[1280px] mx-auto` inside a full-bleed dark band. At 1920 the photo starts at x=320 (320px of dark on each side). At 1280 it is flush, so the fault is width-dependent. Handoff `.nextshow__grid` is `max-width:none; padding:0` (full bleed).
2. Dead space: the countdown box is 560px wide and its cells occupy about 330px (right 40% empty); facts and CTA row are ragged against it.
3. Countdown: proportional numerals jitter every second (no tabular-nums); numerals clamp to 27px at 390 against the handoff's 42px; `aria-label` sits on a role-less div (ignored by assistive tech, so the countdown has no name); min-width 86px cells (handoff) would overflow at 390 if copied naively.
4. Buttons: one brass "Show details" next to two identical ghost buttons. The revenue action ("Book Tickets", title-cased against README l.51) is a third-class ghost. Ghost border `ivory/30` measures 2.53:1 (below 3:1). Radius 0 (handoff 2px). Hover is colour only (no 1px lift, README l.143); no focus-visible state.
5. Facts: labels 10px at `ivory/50` (4.54:1, on the edge), values 15px.
6. A photo gradient scrim across the whole image muddies it, and no text sits on the photo (README l.~111: scrims are for text).
7. Mobile (390): 1122px tall, the ticket button orphaned alone on a second row.

Heuristics (0-4, judged): visibility of status 1 (hover), consistency with handoff 2, aesthetic and minimalist 2, flexibility 2, error prevention n/a. Audit (judged/measured): a11y 2, performance 3, theming 3, responsive 2, integrity 2 = 12/20, Acceptable.

## 2. Rulings

| # | Ruling | Why / cite |
|---|---|---|
| R1 | Card hover grammar is the handoff's own `.navblock:hover`: lift 4px, brass border, shadow `0 20px 50px rgba(34,40,31,.08)`, arrow +4px, image 1.03. Duration 150ms not src's 200ms | src `.navblock:hover`, `.navblock__arrow`; README l.141 (150ms). README says cards use borders not shadow, but the src component for this exact element carries the shadow and outranks the general line. To drop the shadow, edit `card.hoverShadowParts` in tokens.json and this row only |
| R2 | Band hierarchy: **Book tickets = primary** (brass fill, ink text); Show details = secondary (ghost-light); Exhibitor info = tertiary (text link, brass underline) | The handoff gives the brass `.btn--accent` to the band's lead action (src `.nextshow__ctas`); it had no ticket button, so Show details led. The band's job is the sale. Brass fill (5.40:1 with ink) is the only fill the band can carry, since `--primary` on `--primary-800` disappears. DOM and tab order follow the visual order |
| R3 | Photo bleeds flush to the viewport's left edge, grid `1fr 1.1fr`, min-height 620, no scrim gradient | src `.nextshow__grid`, `.nextshow__img`; README scrim rule |
| R4 | Breakpoint 1100px for the band stack and the 4-col grid; cards 1 col below 560, 2 cols 560 to 1099 | src `@media (max-width:1100px)`. The 1-col step is the one departure (handoff keeps 2 cols at 390): forced by R65, a 16px measure of 107px is unreadable |
| R5 | Card title 24px/1.18, weight 600; prose 16px/1.55 `--muted` | src `.navblock__title`; README l.100 (R65). Handoff body is 14px and is overridden by R65 |
| R6 | Focus-visible = everything hover does plus `outline: 2px solid`, offset 3px. Cards `--primary` (8.47:1 on bone); band CTAs `--accent-soft` (7.30:1 on primary-800) | The handoff defines no focus style (nothing in src or README). WCAG 2.4.7 and 1.4.11 |
| R7 | Secondary border `rgba(244,243,236,.45)` (3.92:1) | Handoff `.btn--ghost-light` is .35 (2.95:1, fails 3:1 UI). Same ivory token, alpha only |
| R8 | Reduced motion: no transforms (card, image, arrow, CTA lift); colour, border, underline and outline changes remain | README l.140-145; the global 0.01ms collapse in globals.css stays, so transitions are instant, transforms are removed |
| R9 | Countdown is the handoff `.countdown` (2px gutters, equal cells, 42px tabular numerals) with `role="group"` and the existing aria-label | src `.countdown*` |
| R10 | Hover transforms are gated to real hover devices (Tailwind v4 `hover:` already is); focus-visible is not | touch devices must not stick in a lifted state |
| R11 | Copy untouched except "Book Tickets" to "Book tickets". Placeholder figures stay | Brad |

## 3. NavCards target

Section: keep `py-24 px-8 md:px-16 bg-bone`, header block, eyebrow, h2 untouched. Grid `gap-5` (src 20px). Colour utilities map to tokens via the Tailwind theme (`--color-*`); no literals except the one ruled shadow.

Card (one `<a>`, `data-nav-card`): flex column, `--parchment` bg, `1px solid --rule`, radius 0, no padding on the anchor.
- Transition: transform-class properties (`translate`, `scale`; Tailwind v4 sets these individually, so `transform` computes `none`: the checks read the effective sum), `box-shadow`, `border-color`, all **150ms** with `--ease`.
- Hover and focus-visible: translateY(-4px); border `--accent`; shadow `0 20px 50px rgba(34,40,31,.08)`; image scale 1.03; arrow translateX(4px) and colour `--accent`; title colour `--primary-800` with a 1px `--accent` underline at 4px offset (rest: underline present but transparent so it transitions).
- Active: translateY(-2px). No scale (README l.145).
- Focus-visible only: outline 2px solid `--primary`, offset 3px.
- Reduced motion: translate and scale revert to none on hover, focus and active.

Image well: `overflow-hidden`; 4/5 aspect from 560px, 3/2 below 560. Badge: mono 10.5px, tracking .16em, uppercase, ivory on `bg-primary/80`, padding 5/11, radius 2px (src `.navblock__badge`; no backdrop blur, README bans glass).

Body: padding 22px. h3 24/1.18/600 serif, margin-bottom 12px, **no flex-1**. Prose 16/1.55 `--muted`, `margin-bottom:auto; padding-bottom:20px` (src `.navblock__body-text`), which moves the slack between prose and meta so titles sit on their prose. Meta row: 1px `--rule` top border, padding-top 16px; meta mono 11px, tracking .12em, `--muted`; arrow serif 18px.

## 4. ShowBand target

Section `bg-primary-800`. Grid `1fr` below 1100; `1fr 1.1fr`, min-height 620 from 1100; **no max-width wrapper**.
- Photo (`data-show-band-image`): fill/cover, `/images/orchid-yellow.jpg`, alt unchanged. Stacked: aspect 3/2. Wide: stretches the full band height. No gradient overlay.
- Content column: flex column, centred vertically, `on-dark`. Padding 60px 32px below 1100; 90px 80px from 1100 (src `.nextshow__body`). Inner `data-show-band-content`: `width:100%; max-width:720px`. Expected: 1280 content 510px with an 80px right gutter; 1920 content 720px with a 206px right gutter.
- Eyebrow unchanged, margin-bottom 24. h2 as now plus `text-wrap: balance`, margin-bottom 32.
- Facts `<dl>`: 2 columns, gap 40px x 20px, margin-bottom 32. Each fact: `border-top: 1px solid rgba(244,243,236,.15)`, padding-top 12. dt mono 11px, tracking .18em, `--fg-on-dark-muted` (ivory .65, 6.57:1); dd 16/1.55 ivory.
- Countdown (`data-show-band-countdown`, `role="group"`, existing aria-label): flex, 2px gap and padding, bg `rgba(244,243,236,.08)`, radius 2px; four `flex:1; min-width:0` cells (`data-countdown-cell`), bg ivory .04, padding 18px 12px (6px sides below 640), centred. Numeral serif 500, `--accent-soft`, tabular-nums, 42px (34px below 640), line-height 1 (`data-countdown-value`). Label mono 11px, tracking .18em, ivory .65, margin-top 6. The no-date fallback keeps its copy and gets the same box and hook.
- CTAs, `gap 12px`, wrap, `align-items:center`, in DOM order primary, secondary, tertiary. All 14px/500, tracking .01em.
  - **Primary** "Book tickets" `/tickets`: bg `--accent`, text `--ink`, padding 14/22, radius 2px, `1px transparent` border. Hover: bg `--accent-soft` (src `.btn--accent:hover`; README "darken one step" cannot apply to brass on the darkest surface, so the step is toward ivory) and translateY(-1px). Active: translateY(0). Below 560px full width.
  - **Secondary** "Show details" `/national-show`: transparent, ivory text, 1px ivory .45 border, padding 14/22, radius 2px. Hover: border ivory, bg `rgba(255,255,255,.06)`, lift 1px.
  - **Tertiary** "Exhibitor info" `/national-show/exhibitors`: ivory text, permanent 1px `--accent` underline at 4px offset, min-height 44px, padding 0 4px. Hover: text and underline `--accent-soft`. No lift.
  - Focus-visible on all three: outline 2px solid `--accent-soft`, offset 3px (primary and secondary also lift, equal to hover).
  - Transitions 150ms; reduced motion removes the lift only.

## 5. Contrast ledger (measured on the tokens)

ink/brass 5.40; ink/accent-soft 8.56; ivory/primary-800 13.57; accent-soft/primary-800 7.30; ivory .65 on primary-800 6.57; muted/parchment 5.24; muted/bone 4.66; primary/parchment 9.53; badge worst case over white 5.23; brass on primary-800 (UI) 4.61; ivory .45 border on primary-800 3.92; primary outline on bone 8.47. The brass border/underline on parchment is 2.94 and is therefore never the only hover signal (lift, shadow and title colour also change).

## 6. Test hooks the dev adds (markup only)

`data-home-section="nav-cards"` / `"show-band"` on the sections; `data-nav-card` on each card anchor; `data-nav-card-title`, `-badge`, `-meta`, `-arrow` inside; `data-show-band-image`, `-content`, `-facts`, `-countdown`; `data-countdown-cell`, `data-countdown-value`; `data-show-band-cta="primary|secondary|tertiary"`.

## 7. Dev may touch

`components/home/NavCards.tsx`, `components/home/ShowBand.tsx`, and `app/globals.css` only by pure addition under an `F14` comment. Nothing else (A-H enforces). No new colour, font, shadow, animation or duration other than 150ms.

## 8. Pitfalls found while proving the spec

- `border border-transparent` plus `border-ivory/45` on the same element resolves by stylesheet order, not class order: the secondary border rendered invisible (1.00:1) until the transparent border was moved to the variants that want it. Checks b and f caught this.
- Tailwind v4 `hover:-translate-y-*` and `scale-*` set `translate` and `scale`, not `transform`; asserting `transform` alone would pass a card that never moves.
- Reduced motion cannot rely on the global 0.01ms collapse: it makes the lift instant, not absent.
