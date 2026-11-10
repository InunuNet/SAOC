# Per-ticket-type confirmation emails (samples)

Lee-Ann's eight confirmation emails (Early Bird, Day Visitor, Weekend Pass, VIP, Sunset Cocktails,
SAOC Symposium, WOSA Conference, SAOC/WOSA Joint Ticket), built from her Drive doc "Ticket
information for purchasers.docx" and rendered as sample PDFs for her approval.

**Nothing is live until Lee-Ann approves.** The switch `TICKET_TYPE_EMAILS_LIVE` in
`lib/ticket-type-emails-switch.ts` is `false`, so `sendConfirmationEmail` still sends the generic
order confirmation, byte for byte. Going live is one reviewed edit of that constant after she
approves. It does not touch `TICKETING_PAYMENTS_LIVE` or `SITE_PUBLIC_LAUNCH`.

## Pieces

- `lib/ticket-email-copy.ts` — her text, verbatim, as a pure table keyed by email, plus the ticket
  type slug mapping. An unmapped slug returns `null` and the generic email is sent. A missing part
  renders as the visible text `[To be confirmed]`, never as invented copy. The joint slug
  `saoc-wosa-joint` is provisional: no joint ticket type exists yet.
- `emails/TicketTypeConfirmation.tsx` — EmailShell family A, with the per-ticket QR card of
  `emails/OrderConfirmation.tsx`. No new visual design.
- `lib/ticket-type-email.ts` — the one pure builder (subject and element), used by both
  `sendConfirmationEmail` and the sample script.
- `lib/confirmation-email.ts` — `SendConfirmationEmailInput` gains optional `firstName`,
  `quantity`, `amountPaid`, `paymentStatus` and `visitDate`. The ITN route supplies `amountPaid`,
  `paymentStatus` and `visitDate` (`lib/tickets-notification.ts`, from the stored order price and
  the buyer's chosen day); any value it cannot supply still renders as `[To be confirmed]`.

## Samples

`pnpm samples:ticket-emails` writes to `samples/ticket-emails/` (git-ignored): `00-cover.pdf`
("Questions for Lee-Ann"), `email-<key>.pdf` x8, `ticket-<key>.pdf` x8 and
`ticket-emails-combined.pdf`. The data is made up and the cover page says so. The sample path has
no send, network, Firestore, Sanity or payment calls; the browser is blocked from every request
that is not an inline `data:` URI.
