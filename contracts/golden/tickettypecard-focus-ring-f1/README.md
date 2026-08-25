# tickettypecard-focus-ring F1 — golden

## Defect

`components/tickets/TicketTypeCard.tsx`, `mode === 'list'` branch, renders:

```tsx
<Link href={`/tickets/${slug}`} className={cardClassName}>
```

`cardClassName` carries only layout/border/background tokens — no `focus-visible:*` classes.
Tabbing to this link falls back to the browser's default focus outline, which is visually
inconsistent with the custom ring already used elsewhere in this file (and site-wide) on the
quantity stepper buttons (`mode === 'buy'` branch):

```
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2
```

## Fix

Append that exact token set — unchanged, no new color/width/offset invented — to the
list-mode `<Link>`'s className. The four tokens must appear verbatim:

- `focus-visible:outline-none`
- `focus-visible:ring-2`
- `focus-visible:ring-ink/40`
- `focus-visible:ring-offset-2`

Whether they're added to the `cardClassName` template string or appended separately on the
`<Link>` element is an implementation choice — the requirement is that the rendered className
for the list-mode `<Link>` contains all four tokens, and that the stepper buttons' className
strings are untouched (still contain the same four tokens, unchanged elsewhere).

## Non-goals / regression guard

- `mode === 'buy'` (card/grid rendering with the stepper) must render identically to before —
  stepper button className strings unchanged, stepper behavior unchanged.
- No other component, no other className, no other visual token changes.
- Do not touch `cardClassName`'s existing soldOut/quantity/border/background conditional
  logic — only add the focus-ring tokens.

## Manual/visual proof (mandatory, kind: agent_review)

A BrowserAgent (Playwright) pass against the running dev app must:

1. Navigate to a page rendering `TicketTypeCard` in `mode="list"` (the tickets list page,
   e.g. `/tickets`).
2. Use real keyboard Tab navigation (not `:focus` CSS injection, not `.focus()` via JS) to move
   focus onto the ticket-type `<Link>`.
3. Screenshot the focused link showing the ring.
4. Navigate to a page rendering `TicketTypeCard` in `mode="buy"` (a per-type buy screen, e.g.
   `/tickets/<slug>`), Tab to a stepper button, and screenshot its focus ring.
5. Compare the two screenshots — ring color, width, and offset must read as visually identical
   (same treatment), not merely "some ring exists."
6. Confirm normal (non-list, non-focused) card rendering in both modes is otherwise unchanged
   from before the fix (spot-check against the pre-fix screenshots if available, or against the
   unaffected card layout/border/background).
