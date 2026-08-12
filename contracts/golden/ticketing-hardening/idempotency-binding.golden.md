# Idempotency key binding — golden (round 2, S2)

Closes **S2 (MEDIUM)**. `reserveTicket` matches on `idempotencyKey` alone and returns the
stored `bookingRef` with a freshly signed PayFast payload, ignoring the request body
entirely. @qa measured: Bob POSTing Alice's key gets **Alice's booking reference — which
is the door code**; the same key with a different `ticketType` returns the original
ticket at the wrong amount; the same key after check-in returns a live payment payload
for a consumed ticket; and `00000000-0000-0000-0000-000000000000` is accepted.

A8 and A9 pass today because neither varies the buyer. They stay — a replay with an
*identical* payload must still return 200 and the same reference.

## Rule 1 — the key is bound to the payload it first created

The ticket document already stores `attendeeEmail` and `ticketType`. No new field is
needed. On a replay hit, compare the stored document against the incoming request:

```
stored.attendeeEmail === request.attendeeEmail.trim().toLowerCase()
stored.ticketType    === request.ticketType
```

Both match → replay as today (200, same `bookingRef`, re-signed from the **stored**
amount).
Either differs → **HTTP 409**, and the response body MUST NOT contain `bookingRef`,
`fields`, or any other property of the stored ticket. Leaking the reference is the whole
defect; a 409 that still echoes it fixes nothing.

Suggested body: `{ error: 'This Idempotency-Key was already used for a different purchase.' }`

`attendeeName` is deliberately NOT part of the comparison — a buyer correcting a typo in
their own name on a retry is a legitimate replay, and the name is not a security
boundary. Email and ticket type are: one identifies the recipient of the door code, the
other sets the price.

## Rule 2 — a key may only be replayed while the reservation is still payable

The replay branch returns a live, signed PayFast payload. It must only do so for a
reservation that can still be paid:

- stored `status === 'reserved'` and not expired (see `reservation-expiry.golden.md`) →
  replay, 200.
- stored `status` is anything else (`paid`, `checked-in`, `cancelled`), **or** the
  reservation has expired → **HTTP 409**, no `bookingRef`, no `fields`.

Suggested bodies: `{ error: 'This ticket has already been paid for.' }` for a non-reserved
status, `{ error: 'This reservation expired. Please start again.' }` for an expired one.

Handing a payment payload to someone whose ticket has already walked through the door is
the case @qa measured; an expired hold is the same problem introduced by S1's fix.

## Rule 3 — the nil UUID is rejected

`UUID_PATTERN` accepts `00000000-0000-0000-0000-000000000000`, the single most likely
constant key a non-browser client will send — and a constant key hands every subsequent
caller the first caller's booking reference. Reject it, and the all-`f` maximum UUID with
it, at the same point the pattern is checked, with the same **HTTP 400** and no Firestore
write:

```ts
/** The nil and max UUIDs are the two constants a client sends when it has no real key.
 *  A constant key is not an idempotency key — it deduplicates unrelated buyers onto one
 *  reservation and returns the first buyer's door code to all of them. */
const FORBIDDEN_IDEMPOTENCY_KEYS = new Set([
  '00000000-0000-0000-0000-000000000000',
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
]);
```

Compare lowercased. Do NOT tighten `UUID_PATTERN` to require version-4 bits: the only
in-repo client is `crypto.randomUUID()` (v4), but rejecting v7 or a v1 key from a future
integration is a behaviour change with no security benefit — a random v7 key is exactly
as unguessable.

## Where the check lives

Rules 1 and 2 belong **inside the transaction**, in the existing `duplicate.empty ===
false` branch, returned as new `ReservationOutcome` kinds rather than thrown — the same
pattern `over-capacity` already uses, for the same reason (the caller may need Sanity
copy, and Sanity must never be called from a retryable transaction body).

```ts
type ReservationOutcome =
  | { kind: 'created'; bookingRef: string; amount: number }
  | { kind: 'replayed'; bookingRef: string; amount: number }
  | { kind: 'over-capacity' }
  | { kind: 'key-payload-mismatch' }   // rule 1
  | { kind: 'key-not-payable' }        // rule 2
  | { kind: 'invalid-pricing' };       // see capacity-and-price-validation.golden.md
```

Rule 3 belongs where `UUID_PATTERN` is already tested, before any read.

## Assertions

| id | proves | kind |
|----|--------|------|
| A25 | replay with a different `attendeeEmail` → 409, Alice's `bookingRef` not returned to Bob | behavioural |
| A26 | replay with a different `ticketType` → 409, no payload at the wrong amount | behavioural |
| A27 | replay against a non-`reserved` ticket → 409, no live PayFast payload | behavioural |
| A28 | nil and max UUIDs → 400, no Firestore write | behavioural |
