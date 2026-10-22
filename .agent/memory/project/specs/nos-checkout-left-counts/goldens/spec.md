# nos-checkout-left-counts (rLC, r45 P3): the checkout day picker shows the hub's per-day counts (architect, 2026-10-22)

BASE = origin/main 62dd9f63. Branch fix/nos-checkout-left-counts. Machine-readable twin: goldens/edits.json.

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

## Known gaps (not in scope; for Codi)

1. A sold-out, price-pending or early-bird-ended day: the hub disables it (`is-out`, `disabled`); the checkout still lets it be chosen (server rejects at submit). With rLC it now prints "Sold out" on a selectable option. Disabling it is a behaviour change outside the ruling ("show the counts"), so it is not made here.
2. At 420px and above the hub (and so the checkout) shows "N of T", not "N left". The ruling quotes "997 left"; matching the hub means the viewport rule decides which line shows. If Codi wants "N left" at every width on the checkout only, that is a separate, one-rule decision.
3. The counts are as fresh as the hub's (force-dynamic page, same stock read); checkout still re-checks capacity authoritatively.
