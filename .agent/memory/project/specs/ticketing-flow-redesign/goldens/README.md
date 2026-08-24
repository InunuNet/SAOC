# ticketing-flow-redesign — golden index

The full decision records and per-file golden shapes for this mission's features live under
`contracts/golden/ticketing-flow-redesign-f{N}/`, not here — this project's established location
for golden files that pair with contract assertions (see `gateway-picker-admin-only` for the same
convention).

## F1 — pricing model migration (M1)

- `contracts/golden/ticketing-flow-redesign-f1/README.md` — decision record
- `contracts/golden/ticketing-flow-redesign-f1/pricing-model.golden.md` — schema + `provisional-figures.ts` + `resolveEffectivePrice()`
- `contracts/golden/ticketing-flow-redesign-f1/checkout-route-diff.golden.md` — `app/api/tickets/checkout/route.ts` diff
- `contracts/golden/ticketing-flow-redesign-f1/migration-script.golden.md` — `scripts/fix-vip-and-weekend-pass-pricing.ts`

Check scripts: `contracts/checks/ticketing-flow-redesign-f1/`.

## F2 — vertical cards, per-type dedicated buy screens, real photos (M2)

- `contracts/golden/ticketing-flow-redesign-f2/README.md` — decision record
- `contracts/golden/ticketing-flow-redesign-f2/dedicated-screen.golden.md` — `app/(marketing)/tickets/[slug]/page.tsx` + list-page changes
- `contracts/golden/ticketing-flow-redesign-f2/ticket-type-card.golden.md` — `TicketTypeCard.tsx` vertical layout + orchid photo mapping

Check scripts: `contracts/checks/ticketing-flow-redesign-f2/`.

## F3 — Day Visitor per-day quantity picker (M2)

- `contracts/golden/ticketing-flow-redesign-f3/README.md` — decision record
- `contracts/golden/ticketing-flow-redesign-f3/day-quantity-picker.golden.md` — `DayQuantityPicker.tsx` + cart data model

Check scripts: `contracts/checks/ticketing-flow-redesign-f3/`.
