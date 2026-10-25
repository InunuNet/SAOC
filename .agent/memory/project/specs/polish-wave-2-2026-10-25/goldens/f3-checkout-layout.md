# F3 — ticket checkout layout (CL-1, CL-2)

RULED by NOS Design 2026-10-25 (final), goldens/nos-design-rulings-2026-10-25.md: left-aligned on the hero axis (R71), 560px form column starting at the hero's x, full width inside the same gutter below 1024; gate h1 left edge == form column left edge (+-1px) at 1280 and 2056. Buy stays enabled at qty 0 (r45b), agreed.

Re-measured from source on origin/main ee2e9941 (no build, see README): two of the four backlog sub-items are already done or contradict a design decision
(README, "Candidates dropped"). What is built:

## CL-1 breadcrumb links are 44px targets
`.nos-theme .nk-crumbs a` (app/(nos)/national-show/nos-structure.css, ~L1566) is an inline anchor with `padding-block: 10px` on a 15px line, about 40px
tall. Change the rule to: `display: inline-flex; align-items: center; min-height: 44px;` and remove `padding-block: 10px`. Keep color, text-decoration:
none and the hover rule exactly. The `.nk-crumbs` flex row already has `gap: 10px` and `align-items: center`; the separators are unchanged.
The class is shared by the tickets hub masthead crumbs; the taller target there is intended (same component family).

## CL-2 one container axis
app/(nos)/tickets/[slug]/page.tsx: replace `<div className="mx-auto max-w-[560px] px-8 pb-12 pt-4">` with
`<div data-nos-wrap data-ticket-body className="pb-12 pt-4"><div className="lg:max-w-[560px]"> ... existing children ... </div></div>`.
(`lg:` is Tailwind's 1024px: the column is capped at 560px from 1024 up and is full width inside the gutter below it, per the ruling.)
`[data-nos-wrap]` is the shared NOS container (nos-structure.css, "C1: ONE container"): the same max width and inline padding the hero copy uses, so the
hero h1 and the form column share one left edge. The inner div is the only child, so the column sits left on the axis. Nothing else in the file changes
(the sales-closed notice, summary card and form stay in the same order, inside the inner div). Do NOT edit loading.tsx (PR #93 touches it; it has no body).

## Not built
Buy disabled at quantity 0 (documented design: stays enabled, click fills the hint) and aria-live on the total (already there). See README, DESIGN QUESTIONS 1 and 3.

## Docs
docs/polish-wave-2-f3-checkout-layout.md naming CL-1 and CL-2, and recording the two dropped sub-items with their evidence.

## Checks
f3-layout-static.mjs (rule, wrapper, no `mx-auto max-w-[560px] px-8`) and f3-layout-rendered.mjs (crumbs >=44px with 15px/no-underline unchanged; h1 left
edge equals form column left edge within 1px, at 390, 768, 1280, 1440 and 2056 (the ruling's gate is 1280 and 2056); below 1024 the column equals the container's content width, from 1024 up it is <=560px).
