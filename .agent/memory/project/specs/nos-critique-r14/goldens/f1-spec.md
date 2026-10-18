# nos-critique-r14 F1 — one section unit between adjacent full sections on the tickets hub

BASE: main `9d16cf96`. Branch: `fix/nos-critique-r14` (worktree `.tmp/sandbox/critique-r14`).

## Ruling (Codi, FINAL, 2026-10-18), verbatim

> Tickets hub, nk-section into nk-section at 230/144: same problem. It shows as a dead band between Day tickets and Show passes. Ruling: one section unit between full sections, meaning the bottom padding of one or the top padding of the next, not both. That gives about 115px at 1280 and 72px at 390. Scope it to the adjacent sections on the hub. Disclosure-ending sections keep your 40px. (craft-floor › spacing rhythm; critique › hierarchy, since grouping reads by proximity)

## Cause (measured at BASE 9d16cf96, public build)

`.nk-section` and `.nos-theme .nos-section` both carry `padding-block: clamp(72px, 9vw, 120px)`
(115.2px at 1280, 72px at 375/390/768). Two adjacent sections stack the leader's padding-bottom
on the follower's padding-top.

| pair on /national-show/tickets (wrap bottom -> wrap top) | 375 | 390 | 768 | 1280 |
|---|---|---|---|---|
| #thursday -> #passes | 144 | 144 | 144 | 230.4 |
| #passes -> #programme | 144 | 144 | 144 | 230.4 |
| #programme -> foot `.nos-section` | 144 | 144 | 144 | 230.4 |
| target (one unit) | 72 | 72 | 72 | 115.2 |

"Day tickets" in the ruling is the first ticket section, `#thursday` (heading "Thursday evening",
`TICKET_COPY.sections` in `lib/data/ticket-presentation.ts`); "Show passes" is `#passes`.

## Scope

- Route: `/national-show/tickets` only. The hook is `.nk-masthead` (TicketsMasthead), which is a
  direct child of `.nos-theme` only on the hub. No other NOS route has an `.nk-section` followed by
  a full section (workshops' disclosure section -> `.nk-section` is r12 F6; conferences has a subnav
  before its `.nk-section`).
- Pairs: every full section (`.nk-section` or `.nos-section`) directly following an `.nk-section`
  inside the hub's `.nos-theme`. The architect's reading is that "adjacent sections on the hub" includes
  Programme -> the foot options `.nos-section`, which shows the same doubled band. The masthead ->
  #thursday join (a dark-to-light ground change, 240/254) is not a pair and is not touched.
- r12 F6 (disclosure-ending sections, 40px) stays exactly as it is.

## Decision

Additive CSS in `app/(marketing)/national-show/nos-structure.css` (this is the file's location; there
is no `styles/nos-structure.css`), placed directly after the r12 F6 rules in the same idiom: a
`.nos-theme`-scoped selector that sets the follower's `padding-top: 0`. The gap then equals the
leader's padding-bottom, i.e. one rhythm unit, at every width. No new token, no new length, no
copy change, and no edit to an existing line.

## Acceptance (checks/, pinned in checks-f1.sha256)

- A2 `f1-footprint.mjs`: the branch differs from BASE only in `goldens/f1-footprint.json`
  (nos-structure.css), `goldens/f2-footprint.json` (societies/page.tsx, r14 F2 on the same branch),
  `docs/nos-critique-r14.md` and this spec dir. HEAD descends from BASE.
- A3 `f1-static.mjs`: every BASE line of nos-structure.css is kept in order. Added non-comment
  lines add no custom property and no length other than 0, and at least one is added. The docs
  name F1 and Codi.
- A4 `f1-rendered.mjs` (public build, widths 375/390/768/1280):
  - Hub: the unit is read from a probe `.nk-section`'s computed padding-top and must equal
    clamp(72px, 9vw, 120px) +-0.5. Every pair gap must equal the unit +-2, and #thursday -> #passes
    must exist. Section content heights must equal the baseline +-1.
  - F6: what-to-expect and workshops stay at 40 +-2.
  - Every other swept NOS route plus /tickets/vip and /tickets/day-visitor keeps its section boxes
    relative to the hero bottom (`goldens/f1-baseline.json`, captured at BASE).
  - No horizontal overflow anywhere.

## Proof

- At BASE, A4 fails on exactly the 12 hub pair rows (3 pairs x 4 widths). The F6, other-route
  and overflow rows pass. A3 fails, since no rule is added and there are no docs.
- With a prototype of the decision (one rule after F6, follower `padding-top: 0`, plus a docs
  file), A2, A3 and A4 PASS (76 measurements). The prototype was reverted. Writing it is the dev's job.

## NO INVENTION sources

- `docs/rules/no-invention.md`
- `design/design_handoff_saoc/` (design_system_README.md, colors_and_type.css, SKILL.md, ui_kits/, src/, screenshots/): the section rhythm token stays the one already in use
- `branding/National Show 2027/`
- Codi's ruling above (the only source for the one-unit gap)
