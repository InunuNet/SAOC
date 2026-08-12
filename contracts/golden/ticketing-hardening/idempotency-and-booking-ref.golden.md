# Golden — checkout idempotency and booking-reference entropy

## The defects being fixed

1. Nothing stops a duplicate checkout POST except the client disabling its own submit
   button. A double-click through a slow response, a retried request, or a reloaded
   redirect creates a second reservation that holds a seat nobody will ever pay for.
2. Booking references are `SAOC-2027-` plus a 6-digit number — a 1,000,000-value space,
   fully enumerable, and simultaneously small enough to collide by birthday paradox
   after a few hundred sales. The reference is the door code and the `m_payment_id`;
   guessing one is guessing a ticket.

## Idempotency contract

- Every `POST /api/tickets/checkout` MUST carry an `Idempotency-Key` request header.
- The value must match `^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`
  (a UUID). Missing or malformed → HTTP 400, and **no Firestore document is created**.
- The key is stored on the reservation document as `idempotencyKey`.
- Inside the same transaction as the capacity check, look for an existing ticket with
  this `idempotencyKey`. If one exists, do not create a second document: rebuild and
  return the PayFast payload for the EXISTING `bookingRef`, with HTTP 200 (a fresh
  reservation stays 201, so the two cases remain distinguishable).
- N concurrent POSTs sharing one key produce exactly ONE ticket document and one
  `bookingRef`. Two POSTs with different keys produce two documents — the deduplication
  is keyed on the header alone and must not collapse genuine separate purchases.
- The replayed payload is re-signed at request time from the stored ticket's own
  server-derived amount. Never store or replay the signature, and never take the amount
  from the request body — the existing payment-security boundary is unchanged.

Client side, `components/tickets/TicketPurchaseForm.tsx` generates one key per form
instance (`useState(() => crypto.randomUUID())`) and sends it on every submit, so a
double-click or a retry reuses the same key. Generate a fresh key only after a
reservation has actually been handed off to PayFast.

## Booking-reference format

See `booking-ref-format.golden.txt` for the exact regexes. Summary:

- New format: `SAOC-2027-` + 12 characters of Crockford base32
  (`0123456789ABCDEFGHJKMNPQRSTVWXYZ` — no I, L, O or U, so it survives being read aloud
  at a door), drawn from `node:crypto` randomness. ~60 bits of entropy.
- The old `^SAOC-2027-\d{6}$` form must no longer be produced by anything.
- Uniqueness stays enforced structurally, not by hope: the reservation is written with
  `transaction.create()` on a document id derived from the booking reference, so a
  collision fails the write instead of silently issuing a duplicate door code.
- Existing tickets in Firestore keep their old references; nothing back-fills or
  rewrites historical documents.
