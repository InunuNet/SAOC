# Polish wave 2 F4 — policy links under Buy (PL-1, PL-2, PL-3)

Ruled by NOS Design 2026-10-25: labels "Refunds" and "Privacy" (the NOS footer's own labels, from
`components/nos-chrome/nos-footer-data.ts`), one line directly under Buy.

## PL-1 — links

`components/tickets/TicketPurchaseForm.tsx` ends its form with
`<p className="nk-policy">` holding `Refunds`, an aria-hidden dot and `Privacy`, linking `/refunds`
and `/privacy`. No new copy; the page H1s stay on the destination pages.

## PL-2 — styling

`.nk-policy` in `nos-structure.css`, next to `.nk-hint`, uses the same tokens (`--sans`, 14px,
`--primary-800`). Links are underlined with a 4px offset and are 44px tall (the ruling's floor is 24px).

## PL-3 — fixture route

`app/ticket-fixtures/buy/page.tsx` renders the real form over one static ticket type so the rendered
check can measure it without an on-sale ticket. It is `force-dynamic`, returns 404 unless
`TICKET_FIXTURES` is `'1'`, touches no auth, and the flag appears in no deploy or example env file.
