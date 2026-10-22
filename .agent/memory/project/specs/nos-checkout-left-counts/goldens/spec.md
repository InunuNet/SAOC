# nos-checkout-left-counts (rLC, r45 P3): the checkout day picker shows the hub's per-day counts (architect, 2026-10-22)

BASE = the merge-base of HEAD and origin/main (cut from origin/main 62dd9f63; the check follows rebases, HEAD must still descend from 62dd9f63). Branch fix/nos-checkout-left-counts. Machine-readable twin: goldens/edits.json.

## Source (NO INVENTION, docs/rules/no-invention.md)

Design lead Codi, r45 ruling, `.tmp/sandbox/queue/r45-ruling.md:31`, verbatim: "P3 later (queued): checkout picker drops the "997 left" counts the hub card shows — show them in both."

No new copy, colour, style or data source. The count line, its markup, its classes, its CSS (`nos-structure.css:1947-1960`, `.nk-day span`, `.nk-of`, `.nk-left`, `.nk-day.is-low span`, `.nk-day span.nk-sub`) and its data are the hub card's own. The design handoff
(`design/design_handoff_saoc/`, `branding/National Show 2027/`, the NOS v4 spec in `.tmp/sandbox/nos-chrome-handoff/`) carries no separate checkout-count design, so the hub card (approved, f18b keepsake) is the visual reference, as the ruling says "the counts the hub card shows".

## Trace (measured in the worktree)

- Hub: `app/(marketing)/national-show/tickets/page.tsx` calls `loadTicketCardViewModels()` (`lib/data/admission-availability.ts`) -> `buildTicketCardViewModels()` (`lib/data/ticket-card-view-models.ts`, `buildDays()`), which reads the aggregate sold-by-day counts (`getSoldCountsByTicketTypeAndDay`, counts only, no order or person) and yields `cards.day.days: CardDay[]` (`day`, `state`, `remaining`, `total`, `provisional`). `showProvisional = !withholdPlaceholderProse()`.
- Hub cell: `components/tickets/keepsake/TicketCard.tsx` `DayPicker` (l.73-101) builds the cell from `countDisplay(d.provisional, showProvisional)` and `daySubline(d, counts)` (`keepsake/days.ts`): `<span nk-of>N of T</span><span nk-left>`${d.remaining} left`</span>` in a wrapper span, `is-low` and a "Few left" `nk-sub` line when low, other states' words (Sold out, Price to follow, Early bird ended) from `daySubline`. CSS shows `.nk-left` only below 420px (viewport), `.nk-of` above.
- Checkout: `app/(marketing)/tickets/[slug]/page.tsx` (route `/tickets/<slug>`, not under /national-show) never loads any stock; `TicketPurchaseForm.tsx` renders `<label class="nk-day"><input/><b><time/></b></label>` only.
- `lib/view-models/load-ticket-card.ts` + `lib/data/pool-remaining.ts` are a SECOND, unused-by-the-hub per-day path (`getPoolRemaining`, used by the symposium page and the checkout API). They are NOT the hub's source and must not be used: they could disagree with the hub (different capacity inputs: live `effectiveCapacity` of the day-visitor doc vs the hub's `min(capacity, releasedQuantity)` and provisional fallback). Static S3 fails them.

## Decision

1. **Source: the hub's own loader.** `page.tsx` calls `loadTicketCardViewModels()` (same React-cached Sanity fetches as the hub, the same stock read) and takes `cards.day?.days`. Server-side only; the client form receives plain props. Failure of the loader already degrades to `cards: {}` (logged by name), so the picker then shows no counts, never a sample figure (R7).
2. **Only the Day Pass.** The counts are read when `purchasable`, `cardData.requiresDaySelection` and `productId === 'day'`. Another day-selection product would otherwise show Day Pass numbers. The Weekend Pass, VIP and every other checkout get no count.
3. **Same days.** The checkout lists `showDays` (the active show's days minus the product's `excludedDays`); the counts are matched to them by the ISO day string. A checkout day the hub has no cell for shows nothing.
4. **Same format string, one definition.** A new `components/tickets/keepsake/DayCount.tsx` holds the cell content (the nk-of/nk-left pair, `${d.remaining} left`, the "Few left" line, the state words) and the "Not yet confirmed" note. `TicketCard`'s `DayPicker` is refactored to use it (hub DOM unchanged, rendered check C7 and the comparison in C1), and `TicketPurchaseForm` uses it too. The format string, `nk-of`, `nk-left` and `nk-unconfirmed` each occur once across the three files (static S1). No client fetching, no `useEffect` (static S4).
5. **Provisional handling is the hub's.** `showProvisional = !withholdPlaceholderProse()` in `page.tsx`, passed as a prop; a public build withholds provisional totals exactly as the hub does, the beta preview marks them `data-placeholder` with the "Not yet confirmed" note. No new rule.
6. **Visual treatment: reused as-is, no CSS.** The checkout option already is `label.nk-day` in `.nos-theme .nk-days-row` (3 columns, `.nk-day span` 13px `--nk-sub`, nowrap). The count spans are the same elements, so the hub's CSS applies unchanged, including the viewport rule: **below 420px the option shows "N left", at 420px and above it shows "N of T" (the hub does the same; `.nk-left` is `display:none` above).** Codi's "997 left" is the narrow line. `nos-structure.css` and `globals.css` stay equal to BASE (static S5). The label also takes `is-low` when the day is low (as on the hub).
7. **Accessible name.** The radio keeps r45's `aria-label={formatShowDay(day)}`; it gains `aria-describedby` pointing at the count's wrapper (a new `id` prop on `DayCount`, omitted on the hub so its DOM is unchanged), so a screen reader hears the count after the day.
8. **r45 behaviour untouched.** `startDay` (no default day), the required-day alert (`TicketFieldAlert spaced`), `aria-invalid={dayInvalid}` and the submit/focus handling stay byte-for-byte (static S4 pins the BASE lines; rendered C3).

## Implementation for the dev (footprint, goldens/footprint.json)

- `components/tickets/keepsake/DayCount.tsx` (new, no 'use client'): props `{ d: KeepsakeDay, showProvisional: boolean, id?: string }`; renders exactly the fragment that TicketCard l.90-99 renders today after `<b>` (wrapper span with `data-placeholder`, `nk-of`, `nk-left`, the "Few left" `nk-sub`), plus an exported note component (or equivalent) for the `nk-unconfirmed` paragraph with the hub's condition. The wrapper span takes `id` when given.
- `components/tickets/keepsake/TicketCard.tsx`: `DayPicker` uses `DayCount` and the note; the cell wrapper (label, classes, input, disabled) stays.
- `components/tickets/TicketPurchaseForm.tsx`: props `dayCounts?: KeepsakeDay[] | null`, `showProvisional?: boolean`; per day look up the count by `day`; render `<DayCount id=... />` after the `<b>`; set `aria-describedby` on the radio when a count renders; add `is-low` to the label class when the day's state is `low`; render the note under the options like the hub. Nothing else changes.
- `app/(marketing)/tickets/[slug]/page.tsx`: load as in Decision 1-3, pass `dayCounts` and `showProvisional`.
- `docs/nos-checkout-left-counts.md`: record rLC (sources, the trace, the 420px rule, the gaps below).
- Nothing else. Footprint check A2 fails any other file.

## Amendment 1 (design lead Codi, 2026-10-22), verbatim

"1. Match the hub at every width. The shared DayCount is the point, and the hub's "N of 1000" at 420px and wider vs "N left" below was already reviewed (critique H4 consistency). No checkout-only variant.
2. Fold it in this round. A day labelled "Sold out" that you can still select contradicts its own label and invites a server rejection (H5 error prevention). Treat it the same way as the hub: a native disabled input, which is enough on its own (add aria-disabled only if it's a custom control). Use the same muted style, and add no new copy. If a pre-selected day sells out before submit, the existing server error must still render at the field. Accept: at 1280/390, a sold-out day can't be chosen by click or keyboard, and the rest is unchanged."

(1) changes nothing: the checks already require the hub's markup and CSS at each width. (2) is checks/soldout.mjs and static S4b:

- **Rule:** the hub's `isDayClosed(d)` (sold out, price pending, early bird ended). The checkout option gets `disabled={submitting || closed}` and the label class `is-out` (the hub's muted style: `.nk-day.is-out`, opacity .62, cursor not-allowed, day name line-through, nos-structure.css:1275-1281; no CSS change). Its line is the hub's `daySubline` ("Sold out"), which DayCount already prints. Native `disabled` only; `aria-disabled` is forbidden (the control is a native radio).
- **Unchanged:** the rest of r45 (`startDay`, the no-day alert, `aria-invalid`). The existing no-day handler already focuses the first `input:not(:disabled)`, so a sold-out first day is skipped.
- **Server error "at the field":** the existing cart error (`cart.status === 'error'`, a `TicketFieldAlert` in the form) is what renders; nothing new. Check D5 pins that it still renders after a day sells out between load and submit (a day chosen, the server replies 409 "Sold out.") and when a sold-out day is linked (`?day=D`: the page loads with D disabled, submit sends D, the server's verdict shows). The alert's position is the existing one (form level, above the total), not inside the fieldset; if Codi wants it inside the day group that is a new placement, not "still renders".
- **Linked sold-out day (decision):** a day reached by `?day=D` that is closed renders as a disabled radio that stays CHECKED (`checked={cart.day === day}` is a pinned r45 line, S4). The hub unchecks a closed day because its day is local state it can drop; the checkout's day is the cart's, and Codi's rule is that the server's verdict must still render, which needs the submit to carry the day. A disabled-but-checked option cannot be re-chosen by the buyer, shows the ticked, muted, struck-through, "Sold out" cell, and is left by choosing another day. Accepted; S4 is unchanged.
- **Harness (live data has no sold-out day):** the hub and checkout document responses are rewritten in flight (page.route) so the RSC payload's day object for the checkout's first day reads `state:"soldOut", remaining:0`; the hub's own cell is the oracle for markup and computed style. This needs the page to pass the hub's day objects to the form unchanged (static S4b forbids a `remaining:` literal in page.tsx). The server-rendered cell still shows the old state, so React client-renders from the payload (a hydration warning is expected).

## Known gaps

1. The "Server error at the field" wording: see above.
2. The counts are as fresh as the hub's (force-dynamic page, same stock read); checkout still re-checks capacity authoritatively.
3. The sold-out harness depends on the RSC payload shape (`"day":..,"state":..,"remaining":..`); if Next changes how it serialises props the check reports "could not force" (INFRA), not a silent pass.
