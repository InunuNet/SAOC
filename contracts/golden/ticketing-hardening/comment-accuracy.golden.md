# Comment accuracy — golden (round 2, S6 + S7 + the form-key caveat)

Three comments in the tree assert things that are not true. None is a live defect. All
three mislead the next editor into a decision that would be, so all three are asserted —
comments that document a security property must not be allowed to rot silently.

Every assertion here is **structural (grep)** and labelled as such in the contract: a
source comment has no runtime surface, so there is nothing behavioural to measure. This
is the one category where a grep is the honest tool rather than the lazy one.

## S6 — `app/api/tickets/status/route.ts:8-11`

Claims a booking ref is "guessable enough (SAOC-2027- + 6 digits)". Refs are now 60-bit
(12 Crockford base32 chars); @qa measured 20,000/20,000 unique with uniform position
frequencies. The **mitigation is still correct** — the endpoint must keep returning only
`{ status }` — but the stated reason is stale, and an editor who checks the premise and
finds it false may conclude the mitigation is unnecessary and start returning the
attendee's name.

Rewrite so the reason survives the premise. Required content:

- must NOT contain the string `6 digits`
- must state the current entropy (`60 bits` / `60-bit`)
- must still say the endpoint returns status only, and why it is unauthenticated

Suggested:

```
// F3 (ticketing-pages) — read-only status endpoint so /tickets/confirmation can poll
// without claiming success or failure prematurely (the PayFast ITN race). Returns the
// absolute minimum: { status }. No name, email, price paid, or internal ids.
// Unauthenticated by necessity — the buyer has no account, only the ref in their return
// URL. Booking refs are 60 bits (lib/booking-ref.ts), so this is not enumerable; but
// anyone holding a ref — a photo of a ticket — can see its check-in state, so "status
// only" stays the load-bearing mitigation and must not be widened. Per-IP rate limiting
// is deferred to F6.
```

## S7 — `lib/booking-ref.ts`

`byte & 0x1f` yields 0–31 and `CROCKFORD_ALPHABET.length` is 32, so
`if (index < CROCKFORD_ALPHABET.length)` can never be false. The rejection-sampling
comment describes behaviour that does not occur.

**Keep the guard** — it is correct defensive code and it is exactly what makes a future
alphabet change safe. Fix the comment to say the branch is currently unreachable and why
it is retained. Required content:

- must NOT claim rejection sampling is occurring
- must state that the mask is exact for a 32-symbol alphabet / the branch is unreachable today
- must state the guard is retained for a future alphabet of a different length

Suggested:

```
 * The 5-bit mask is exact for a 32-symbol alphabet, so the length guard in the loop is
 * unreachable today — 32 divides 256 and every masked byte lands inside the alphabet. It
 * is retained on purpose: shorten the alphabet and the guard becomes live rejection
 * sampling, where `byte % length` would silently bias the distribution instead.
```

## The form-key caveat — `components/tickets/TicketPurchaseForm.tsx:40`

Says the key "is only replaced once a reservation has been handed off to PayFast". The
key is **never** replaced. The component unmounts into `PayfastRedirectForm`, and a
browser Back from PayFast remounts it with a *new* UUID — so back-then-retry creates a
second reservation. With S1 fixed that second seat releases itself after the TTL; the
comment is still wrong and would justify a wrong conclusion.

Comment-only. Do not change the key's lifecycle — a key that survived Back would silently
replay the *first* reservation, and after S2's rules 1 and 2 that replay would 409 a buyer
who is legitimately retrying. Required content:

- must NOT contain `only replaced`
- must state that a Back-navigation remount produces a new key and therefore a second
  reservation, and that reservation expiry is what releases it

## Assertions

| id | proves | kind |
|----|--------|------|
| A35 | the status-route comment no longer says "6 digits" and states the real entropy | structural — comment, no runtime surface |
| A36 | the booking-ref comment no longer claims rejection sampling occurs | structural — comment, no runtime surface |
| A37 | the form comment no longer claims the key "is only replaced" | structural — comment, no runtime surface |
