# NOS checkout left counts (rLC, r45 P3)

Design lead Codi's r45 ruling: "P3 later (queued): checkout picker drops the "997 left" counts the hub card shows - show them in both."

## What changed

The Day Pass checkout day picker (`/tickets/<slug>`) now shows each day's remaining count exactly as the hub's Day Pass card does.

- `components/tickets/keepsake/DayCount.tsx` is the one definition of the count cell: the `nk-of` ("N of T") and `nk-left` (`${d.remaining} left`) pair, the state words from `daySubline`, the "Few left" line and the "Not yet confirmed" note (`nk-unconfirmed`).
- `TicketCard`'s `DayPicker` renders `DayCount`; the hub DOM is unchanged.
- `app/(marketing)/tickets/[slug]/page.tsx` calls `loadTicketCardViewModels()` (the hub's own loader) and passes `cards.day.days` to `TicketPurchaseForm` as plain props, with `showProvisional = !withholdPlaceholderProse()`. Only for `productId === 'day'` with `requiresDaySelection`; Weekend Pass, VIP and the rest show no count.
- `TicketPurchaseForm` renders `DayCount` in each day option and points the radio's `aria-describedby` at it. It fetches nothing on the client. Every r45 behaviour (no default day, required-day alert, `aria-invalid`, focus) is untouched.

## Not the source

`lib/view-models/load-ticket-card.ts` and `lib/data/pool-remaining.ts` are a second per-day path and can disagree with the hub; they are not used here.

## Viewport rule

No CSS was added. The hub's rules apply: below 420px an option shows "N left", at 420px and above "N of T".

## Known gaps (for Codi)

1. Amendment 1 (Codi): a closed day (`isDayClosed`: sold out, price pending, early bird ended) is a native disabled `is-out` option on the checkout, as on the hub. The server still rejects a closed day linked via `?day=` at submit.
2. "N left" at every width on the checkout would be a separate decision.
3. Counts are as fresh as the hub's (force-dynamic, same stock read); checkout still re-checks capacity authoritatively.
