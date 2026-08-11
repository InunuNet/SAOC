# The content/money line

Brad's rule, verbatim: **anything a visitor READS is content; anything that MOVES MONEY is
code.**

## Becomes Sanity-editable content (this contract)

- Every heading, subheading and lede on `/tickets`, `/tickets/confirmation`, `/tickets/cancelled`
  — `ticketsPage` singleton, see `ticketsPage-schema.golden.json`.
- The buy button label, sold-out message, sales-closed message.
- The confirmation page's pending/success/not-found copy.
- What a buyer is told their ticket includes (`ticketIncludesNote`).
- The cancellation page copy and its button label.
- Ticket type names, descriptions and prices (`ticketType` documents — already F1).

## Stays in code — never becomes a CMS field

- `lib/payfast.ts` — signature generation, `phpUrlEncode`, `getClientIp`. No Sanity import,
  ever.
- `app/api/tickets/itn/route.ts` — ITN verification: signature check, source-IP allowlist,
  server-confirm, amount match, the transactional paid-write. No Sanity import, ever. Also
  covered by the byte-identical SHA-256 gate (A43) from the original F1–F4 pass.
- The amount-derivation path in `app/api/tickets/checkout/route.ts` — it reads a `ticketType`
  document's `price` field (data, looked up server-side), which is different from a visitor-
  facing copy string. The lookup itself, the 403-when-closed check, and the fact that the
  amount is never read from the request body remain 100% code, unconditionally.
- `salesOpen` on `nationalShow` — a functional boolean gate that changes program behaviour
  (whether the checkout API accepts requests at all), not a sentence a visitor reads. It is
  Sanity-editable (Lee-Ann needs to flip it), but it is state, not copy — kept deliberately
  separate from `ticketsPage.salesClosedMessage`, which IS the copy shown alongside that state.

## Why this is a clean line, not a fuzzy one

If a field's value could be swapped for a different string and the worst outcome is "the page
reads a bit differently," it's content — put it in `ticketsPage` or `ticketType`. If swapping
the value could change how much someone is charged, whether a payment is accepted as genuine,
or whether an attacker's spoofed request is trusted, it's money-code — it stays a constant, an
env var, or a computed value in a route handler, full stop.
