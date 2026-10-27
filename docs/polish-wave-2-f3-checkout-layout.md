# Polish wave 2 F3 — ticket checkout layout (CL-1, CL-2)

Ruled by NOS Design 2026-10-25: left-aligned on the hero axis (R71), form column starting at the
hero's x, full width inside the same gutter below 1024px.

## CL-1 — 44px breadcrumb links

`.nos-theme .nk-crumbs a` in `app/(nos)/national-show/nos-structure.css` is now
`display: inline-flex; align-items: center; min-height: 44px` (the 10px block padding that gave about
40px is removed). Colour, no underline and the hover rule are unchanged. The class is shared with the
tickets hub masthead, where the taller target is intended.

## CL-2 — one container axis

`app/(nos)/tickets/[slug]/page.tsx`: the body `mx-auto max-w-[560px] px-8` wrapper becomes
`<div data-nos-wrap data-ticket-body>` (the shared NOS container the hero copy uses) holding one
`lg:max-w-[560px]` column. The hero h1 and the form column share a left edge; below 1024px the column
is the container's full content width.

## Not built (evidence)

- Buy disabled at quantity 0: contradicts the documented design (the CTA stays enabled and a click
  fills the hint, r45b). NOS Design agreed.
- `aria-live` on the total: already present in `TicketPurchaseForm.tsx`.
