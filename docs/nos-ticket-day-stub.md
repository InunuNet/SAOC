# NOS ticket day stub (r45)

The Day Pass names no show day until the buyer picks one.

## Root cause

`components/tickets/keepsake/TicketMini.tsx` computed
`showDayStub(firstSelectableDay(vm.days) ?? vm.days[0]?.day ?? '')` whenever `vm.days` existed, and preferred it over
`product.numeral` / `product.caption`. Only the Day Pass has `vm.days` (it is the `requiresDaySelection` product), so its hero fan
ticket read "24 / Friday" over the product's own empty numeral and caption. The hub card had the same default one level down:
`TicketCard.tsx` started the day state at `firstSelectableDay(vm.days)`, so Friday was pre-checked, the stub read "24 / Friday" and
Buy linked `&day=2027-09-24`.

## What was built

| file | change |
|---|---|
| `TicketMini.tsx` | The fan stub uses `product.numeral` and `product.caption` only. |
| `TicketCard.tsx` | The day state starts at `summary ? summaryDay : null`; there is no default. The stub is `showDayStub(day)` once a day is chosen, the product's own before. Buy with no day calls `showDayMissing()`, which sets `dayMissing` and focuses the first enabled day radio. The day picker gets `invalid` (`aria-invalid` on the fieldset) and a `role="alert"` paragraph after the day row reading `TICKET_COPY.chooseDay`. |
| `BuyBlock.tsx` | Optional `onMissingDay`. When it is given and no day is chosen, the CTA click is `preventDefault`ed and handed to the card. The CTA stays an enabled link; every other card passes nothing. |
| `days.ts` | `firstSelectableDay` is deleted (no callers left) and the header comment corrected. |

No new copy or visuals: the error text is the picker's own legend "Choose a day", and the paragraph uses the required-field alert
class of `components/tickets/TicketFormField.tsx` plus `mt-1.5` (that field's `space-y-1.5` gap).

The checkout summary variant keeps its behaviour: its day still comes from the page and `CHECKOUT_DAY_EVENT`.

## Not changed

The checkout form (`TicketPurchaseForm.startDay`) and the checkout page `summaryDay` default stay as before; a design ruling on them
is pending. A middle-click on Buy with no day still opens `/tickets/<slug>?quantity=1`, which lands on that checkout default.

## Server

`POST /api/tickets/checkout` already rejects a `requiresDaySelection` item with no `chosenDay` with a 400 before reservation and
payment, and nothing on the path defaults one. The check `f1-server.mjs` (in the spec dir, run with `pnpm exec tsx`) locks this in.
