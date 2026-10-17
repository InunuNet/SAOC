# F18b audit checklist (Codi, from v13 + HANDOFF.md)
Run on :3012 at 1280, 1920, 768, 390. Skills: impeccable critique (H1–H10), audit, craft-floor.

## Structure
- [ ] Masthead: h1, facts, countdown; hero fan VIP·Sunset·Weekend·Day on one arc; each card is 1 link to its section/checkout
- [ ] <1240: copy and fan stacked; ≥1240: side by side; ≤700: 2×2 deck with reserved heights (CLS 0)
- [ ] Sections in order: #thursday (2 col) · #passes (pool banner + bracket ≥960, 2 col) · #programme (3 col) · #sessions
- [ ] No F16 rows / F17 captions left; old catalogue URLs redirect (no 404)

## TicketCard
- [ ] article[aria-label]; h3 name under group h2; stub aria-hidden; photo alt=""
- [ ] Die-cut stub: numeral, Disa emblem, "Admit one", perforation + 11px notches; filter drop-shadow (not box-shadow)
- [ ] Stub moves right at container ≥470; 768 horizontal again; 390 vertical
- [ ] Field colours VIP #0B0A14 · Sunset #7E3F97 · Weekend #211A57 · Day #7F7D33 · Symposium #4A3D8C · WOSA #6A6829 · Workshops #33296F
- [ ] Photos only from the approved set; field colour fallback
- [ ] States mask correctly: pricePending (no CTA, "Price to follow") · soldOut (stamp, no CTA) · earlyBirdSoldOut · low ("Few left", warning ink) · available
- [ ] Greyscale check: states differ by words/tag/stamp, not colour alone

## Controls
- [ ] Day selector: fieldset+legend "Choose a day", native radios, 58px cells, disabled cells keep size, stub numeral follows the chosen day
- [ ] Stepper: role=group "<name> quantity", 44px, min 1, max min(10, remaining)
- [ ] CTA 50px; Vote 2B on checkout (enabled; qty 0 → inline "Choose at least one ticket" + focus)
- [ ] Focus: 2px outline, 3px offset, violet on light, #FBFAF0 on royal

## Data (R7)
- [ ] No sample numbers (312, per-day remaining) unless real stock; else hidden
- [ ] Early bird: struck regular price under the EB price; pool 0 → "Early bird sold out", regular SKU sells
- [ ] scarcity aria-live polite, updated in place

## Motion (R28 exception, Codi 2026-10-17)
- [ ] Hero fan-out once on load (1.1s), hover lift 5px 360ms, press 0.98 — all inside prefers-reduced-motion: no-preference

## Layout
- [ ] 390: no horizontal scroll, 16px gutters, fan tickets 196px
- [ ] Contrast spot checks per HANDOFF §5
