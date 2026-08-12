# Ticketing Security Hardening

**Contract:** `contracts/contract-ticketing-hardening.yaml` (37 assertions). Gated green
on two consecutive full runs, verified by the orchestrator.

**Status:** the nine defects below are fixed and covered by the contract. This is
**not deployed and not live anywhere** — there is no production domain, PayFast is
sandbox only, and (see [Standing blocker](#standing-blocker-firebase-auth-is-not-provisioned)
below) the door scanner cannot be exercised end to end in any environment today,
independently of these fixes.

This document explains *what was wrong, what changed, and how each fix is verified*.
It does not repeat the payment-plumbing design covered in
[docs/payfast-integration.md](payfast-integration.md) or the general ticketing flow in
[docs/ticketing.md](ticketing.md) — read those first for context.

---

## Standing blocker: Firebase Auth is not provisioned

Firebase Authentication has never been enabled on the `saoc-webapp` project —
`getAuth().listUsers()` and `getAuth().createUser()` both fail
`auth/configuration-not-found`. Consequently **no ID token and no admin session cookie
can be minted by anything**, in any environment, and `/admin/login` plus the door
scanner (`/admin/door` → `POST /api/admin/checkin`) are non-functional today, entirely
independent of every fix in this document. Logged in
`.agent/memory/project/needs-human.md` under "BLOCKER — Firebase Authentication is not
provisioned on `saoc-webapp`"; needs Brad to enable the Email/Password provider in the
Firebase console.

Because of this, the door-admission logic (F1 below) is verified by calling
`lib/checkin.ts` directly against real Firestore rather than through the authenticated
HTTP route — see F1's verification notes.

**Do not read anything in this document as evidence the door scanner works end to
end.** The admission *logic* is fixed and proven; the authenticated *path* to reach it
is not usable until Auth is provisioned.

---

## Round 1 — four confirmed defects

### F1 — Door scanner admitted unpaid and wrong-show tickets

**The defect.** The check-in route's only rule was "is this ticket already checked
in?". A ticket in `reserved` status — created the instant a checkout begins, before
PayFast confirms anything — opened the door, as did a paid ticket belonging to a
different show.

**The fix.** Admission logic was extracted into `lib/checkin.ts`
(`checkInByBookingRef`); `app/api/admin/checkin/route.ts` now does authentication only
and delegates entirely — it holds no admission logic of its own. The decision runs
inside one Firestore transaction (fresh read, decision, and write together), so:

- a ticket is admitted if and only if `showId` matches the pinned show and
  `status === 'paid'`
- an already-`checked-in` ticket is refused with `already-checked-in` and its original
  `checkedInAt` is never overwritten (checked *before* the paid check, so door staff are
  told "already checked in", not "unpaid")
- two concurrent scans of the same ticket admit exactly once — the loser re-runs
  against committed state inside the same transaction

**Verified by:** A1 (reserved ticket refused, nothing written), A2 (paid ticket for
this show admitted, regression guard), A3 (paid ticket for another show refused), A4
(concurrent double-scan admits once, `checkedInAt` never overwritten), A5 (no/forged
session cookie is 401 over real HTTP), A14 (structural: the route contains no admission
logic and delegates to `checkInByBookingRef`).

A1–A4 exercise `lib/checkin.ts` directly rather than through the authenticated route,
for the reason given under [Standing blocker](#standing-blocker-firebase-auth-is-not-provisioned)
above; A14 is what proves the route actually delegates to that logic.

@qa additionally probed the full state matrix beyond the contract — cancelled,
refunded, case-variant status, whitespace, absent/null status, null/absent/empty
`showId` — and every unenumerated state fails **closed** (refused, not admitted).

### F2 — Checkout capacity check was an unguarded read-then-write (TOCTOU race)

**The defect.** The capacity check read the sold count, then wrote a `reserved`
ticket, with no transaction between the two. @qa reproduced a live oversell: 5
concurrent checkouts for the last seat all returned 201, ending at 54 seats held
against a capacity of 50.

**The fix.** The count, an idempotency-key probe, and the reservation write now happen
inside one Firestore transaction (`reserveTicket` in
`app/api/tickets/checkout/route.ts`). Firestore requires all reads before any write, so
both reads happen up front and the decision is taken after. `getSoldCountsByTicketType`
(`lib/data/tickets.ts`) is the single counting path used by both the transactional
checkout and the public `/tickets` sold-out badges, so the two cannot drift apart.

**Verified by:** A6 (5-way concurrency at the boundary — exactly one 201, the rest
409), A7 (a normal checkout with seats free still succeeds and stores the
server-derived price — false-green guard for A6). @qa pushed this further to 20-way
concurrency: 49 held against capacity 50 gave exactly 1×201 and 19×409, ending at
exactly 50/50, with no off-by-one at or above the boundary.

### F3 — Checkout had no duplicate-POST protection, and booking references were guessable

**The defect.** A double-submitted form (network hiccup, impatient click) created two
separate `reserved` tickets. Booking references were `SAOC-2027-` + a 6-digit random
number — a 1,000,000-value space, walkable by brute force and small enough to collide
by birthday paradox after a few hundred sales.

**The fix.**

- Checkout now requires an `Idempotency-Key` header (validated as a UUID shape). A
  request replaying the same key with the *same* buyer email and ticket type gets back
  the original booking reference and a freshly re-signed PayFast payload (200, not
  201) instead of creating a second reservation.
- `generateBookingRef()` (`lib/booking-ref.ts`) now draws from `node:crypto`
  `randomBytes`: 12 Crockford base32 characters (no `I`, `L`, `O`, `U`, so a reference
  survives being read aloud or hand-copied) = 60 bits of entropy. The document id is
  derived from the reference itself, so a collision fails the Firestore `create()`
  outright instead of silently issuing a duplicate door code.

**Verified by:** A8 (5 concurrent POSTs sharing one key create exactly one ticket, all
return the same reference), A9 (two POSTs with different keys from the same buyer
create two tickets — guards against over-broad deduplication, e.g. keyed on email
alone), A10 (missing/malformed key is 400, writes nothing), A11 (16 live-issued
references match the golden format, none matches the old 6-digit form, all distinct,
and a heuristic self-tested against a counter fixture rules out a disguised sequential
counter), A17 (the real `/tickets` browser form sends a UUID key and is accepted).

@qa generated 20,000 references: all unique, all 32 alphabet symbols present at every
one of the 12 positions, position-1 frequencies within expected range of uniform.

### F4 — `SITE_URL` was missing from `apphosting.yaml`

**The defect.** The checkout route builds `notify_url` / `return_url` / `cancel_url`
from `SITE_URL`, falling back to `https://saoc.co.za` if unset. `apphosting.yaml` never
declared `SITE_URL`, so any deployed payment's PayFast ITN would have been delivered to
the old Joomla site at `saoc.co.za` — which is still live — and the ticket would sit
permanently `reserved`, with the buyer charged and no ticket ever issued.

**The fix.** `apphosting.yaml` now declares `SITE_URL` as a plain (non-secret) value,
`availability: [RUNTIME]` only — a `BUILD` entry would bake the origin into the bundle
and defeat the per-environment, per-request lookup `resolveSiteUrl()` already did.

**Verified by:** A12 (the YAML is parsed, not grepped — rejects a `secret:` field, a
trailing slash, a `BUILD` availability, and the forbidden `saoc.co.za` host), A13
(behavioural: a real checkout's three callback URLs are all built on `SITE_URL` at
request time, never the fallback — this was already green and must stay green).

---

## Round 2 — five defects @qa found past the round-1 assertions

@qa attacked the round-1 fixes adversarially, beyond what A1–A20 checked, and found
five further defects. `.agent/memory/scratch/harden-qa.md` (S1–S7) has full
reproductions; `.agent/memory/scratch/harden-brief-2.md` is the round-2 dev brief with
the pre-fix baseline for every new assertion.

### F5 — Abandoned checkouts consumed a seat permanently (S1, HIGH)

**Be honest about this one: it is a regression introduced by the F2 fix, not a
pre-existing bug.** Making the capacity count authoritative against `reserved` tickets
(F2) was the correct fix for the oversell — but with no release path, an ordinary
abandoned cart (buyer reaches PayFast, never pays) held its seat forever. Reproduced:
fill a type to capacity with reservations that are never paid, and it stays "sold out"
indefinitely. Adult capacity is 300 — normal cart-abandonment rate would exhaust it
long before real demand did, with zero revenue.

**The fix.** A `RESERVATION_TTL_MINUTES` constant (`lib/tickets-constants.ts`, currently
**30 minutes**) is written as an `expiresAt` Timestamp on every reservation. Expiry is
**lazy**: `getSoldCountsByTicketType` (`lib/data/tickets.ts`) simply stops counting a
`reserved` document once `expiresAt` has passed. There is no sweeper, no cron job, and
no status write — a background writer flipping `reserved → cancelled` would race a
genuine late ITN and is the more dangerous way to get this wrong.

Two things this deliberately does **not** do, both load-bearing:

- A `reserved` document with **no** `expiresAt` still counts toward capacity — fails
  closed, so a writer that forgets the field cannot silently release seats.
- **A `paid` ticket can never be expired by this**, regardless of how far in the past
  its `expiresAt` is (a payment that lands after the TTL still wins its seat — refusing
  a paying attendee is worse than an oversell of one). This is asserted independently of
  the release-path fix and must stay true forever.

**Verified by:** A21 (an expired hold releases its seat — 49 live + 1 day-old-expired
hold → next buyer 201), A22 (the converse regression guard: all-live holds still refuse
the next buyer at capacity), A23 (catastrophe guard: a `paid` ticket with a long-past
`expiresAt`, and a `checked-in` ticket with a long-past `expiresAt`, are never mutated
and still consume their seat), A24 (the real checkout route actually writes a future
`expiresAt` — without this, A21 could pass against a hand-built fixture while the real
writer still omitted the field).

### F6 — Idempotency key was bound to neither buyer nor payload (S2, MEDIUM)

**The defect.** `reserveTicket` matched a replay on the `Idempotency-Key` header
*alone*, ignoring the rest of the request body. Concretely: Bob POSTing Alice's key
with his own name and email got back **Alice's booking reference** — which is the door
code — and a live, freshly signed PayFast payload for a ticket type he didn't request
if he varied it. The same replay succeeded even after the ticket had been checked in.
The nil UUID (`00000000-0000-0000-0000-000000000000`) was accepted as a valid key,
meaning any client sending a constant key handed every subsequent caller the *first*
caller's door code.

**The fix.** The stored reservation now carries the buyer's email and ticket type. A
replay is only honoured if both match; a mismatch returns 409 with **no `bookingRef`
and no PayFast fields in the body** — echoing the reference back on refusal would be
the same leak in a different response. A replay is also refused (409, no live payload)
once the reservation is no longer payable — already `checked-in`, or past its
`expiresAt`. The nil and max (`ffffffff-…`) UUIDs are explicitly rejected at the header
check, before anything is read or written.

Buyer name is deliberately **not** part of the match — correcting a typo in your own
name on a retry is a legitimate replay, and the name is not a security boundary.

**Verified by:** A25 (different buyer, same key → 409, no leaked reference, original
attendee unchanged), A26 (same key, different ticket type, fetched live from Sanity so
a Studio rename can't turn this into a no-op → 409), A27 (replay against a checked-in
or expired reservation → 409 with no live payload), A28 (nil/max UUID → 400, no
Firestore write). A8, A9, and A17 (identical-payload replay, distinct keys, and the
real browser form) stay green — the fix narrows *when* a replay is honoured, it doesn't
break the honest case.

### F7 — Checkout could fail open on an unusable Sanity capacity or price (S3 corrected, S5)

**The defect, and a correction to @qa's original diagnosis.** @qa's first pass
attributed the fail-open to `alreadyHeld > undefined` on a *missing* capacity field.
Measured directly: GROQ projects a missing attribute as `null`, and `1 > null` is
`1 > 0` — an absent capacity already returned 409 (fails closed), not the reported
oversell. **The real mechanism is different**: Sanity does not enforce field types at
the API level, so `capacity: "50"` — a *string*, writable by the seed script or the raw
HTTP API — reaches the route unchanged, and `1 > "50"` is `false`: the checkout
returned 201 against an effectively unlimited ledger. `NaN` behaves the same way.
Separately, a blank `price` had no schema validation at all: `reserveTicket` committed
the reservation, then `amount.toFixed(2)` threw on `null` outside any `try/catch` — the
seat stayed held, the idempotency key was burned, and the buyer's retry replayed into
the identical crash, forever.

**The fix.** `isUsableAmount()` in the checkout route
(`typeof value === 'number' && Number.isFinite(value) && value >= 0`) is checked for
both `capacity` and `price`, **before `reserveTicket` runs** — no seat is held and no
key is burned on an unusable ticket type. The `typeof` check is load-bearing twice:
at runtime it is what actually rejects the string case, and at compile time
`Number.isFinite` alone does not narrow `unknown` to `number` (verified against `tsc
--strict`) — do not simplify this to `Number(value)` coercion, which turns
`Number("50")` back into `50` and reintroduces the defect. The Sanity schema's `price`
field now carries `Rule.required().min(0)`, matching `capacity`'s existing validation.
The schema's `capacity` field description no longer claims a blank value "fails
closed" — that was never a read-time guarantee, only a Studio-authoring nudge, and the
string case shows the read path can be driven open regardless.

**Verified by:** A29 (a ticket type with `capacity: "50"` cannot be sold, writes no
document; the absent-capacity case stays a green regression guard, per the correction
above), A30 (schema description no longer asserts the false "fails closed" claim), A31
(a blank-`price` ticket type commits zero Firestore documents), A32 (schema `price`
carries `Rule.required().min(0)`).

### F8 — A late PayFast ITN retry could resurrect a checked-in ticket (S4, MEDIUM)

See [The ITN write guard](#the-itn-write-guard-and-the-a15-re-pin-ceremony) below — this
is the one defect that required editing the hash-pinned ITN route, so it gets its own
section.

### F9 — Three source comments asserted things that were no longer true (S6, S7)

Not a behavioural defect on their own, but a comment documenting a security property
that has quietly rotted is how the next editor talks themselves into removing the
mitigation it justifies. Three corrected, code unchanged in every case:

- `app/api/tickets/status/route.ts` justified returning only `{ status }` on booking
  refs being "guessable enough (`SAOC-2027-` + 6 digits)". Refs are now 60-bit; the
  mitigation (status-only response) stays, the stale reasoning is replaced with the
  real entropy figure. Per-IP rate limiting on this endpoint remains explicitly
  deferred — only the comment changed.
- `lib/booking-ref.ts` claimed rejection sampling was occurring in the generation loop.
  `byte & 0x1f` always yields a value below 32, so the length-guard branch is
  unreachable for the current 32-symbol alphabet — the comment now says so and explains
  the guard is retained for a future alphabet of a different length, not deleted.
- `components/tickets/TicketPurchaseForm.tsx` claimed its idempotency key "is only
  replaced once a reservation has been handed off to PayFast" — it is never explicitly
  replaced; the component simply unmounts. A browser Back navigation from PayFast
  **remounts the form with a new key**, which takes a second reservation. The comment
  now records this; F5's reservation expiry is what actually releases the abandoned
  first seat. See [Operational notes](#operational-notes-for-a-future-maintainer)
  below.

**Verified by:** A35, A36, A37 — structural greps for the stale phrase's absence and
the corrected phrase's presence. All three are structural by necessity: a source
comment has no runtime surface to assert against behaviourally.

---

## The ITN write guard, and the A15 re-pin ceremony

`app/api/tickets/itn/route.ts` is a repeatedly hash-pinned payment security boundary
(contract assertion **A15**), specifically so that it cannot change without a
deliberate, recorded decision — not as a side effect of an unrelated refactor. **This
section exists so a future maintainer understands that touching this file again
requires the same ceremony.**

### The defect (S4)

The handler's fast-path check and its transactional write guard both tested only
`status === 'paid'` (equivalently, `!== 'paid'`). A ticket already `status: 'checked-in'`
passed every other gate — signature, source-IP allowlist, amount match, and PayFast's
own server-confirm callback all validate a genuine, already-processed payment — and the
transactional write set it back to `status: 'paid'`. `lib/checkin.ts` refuses
re-admission solely on `status === 'checked-in'`, so a resurrected `paid` ticket was
admissible again: **the same booking reference opened the door a second time.** No
attacker is required — PayFast retries ITN delivery until it receives HTTP 200, and a
lost acknowledgement delivered hours after the attendee has already walked in
reproduces this on its own.

### The fix

Both the fast-path check and the transactional write guard became **positive**
(`status !== 'reserved'`) rather than negative (`status !== 'paid'`). A positive guard
covers `checked-in`, `cancelled`, a missing status, and any status a future feature
adds, without anyone needing to remember to extend a denylist — the same fail-closed
shape `lib/checkin.ts` already uses. The non-`reserved`, non-`paid` case in the fast
path (a payment landing against a cancelled or malformed document) now logs via
`console.error` with `m_payment_id` and the observed status, so a fail-closed 200 that
silently drops a genuine payment is still reconcilable by an operator; the ordinary
`paid`-already duplicate-delivery case stays silent, since logging it would be pure
noise.

**Explicitly not done:** an expiry check inside the ITN write path. A payment that
lands after the reservation's TTL must still be honoured — refusing entry to someone
who paid is worse than an oversell of one. **Also explicitly not done:** an
env-overridable `PAYFAST_SANDBOX_VALIDATE_URL` test hook, which would have let the
write path be exercised end-to-end from the gate, at the cost of putting a
test-shaped environment variable inside a payment security boundary — anyone able to
set that env var could bypass PayFast's server confirmation entirely. Both rejections
are recorded in `contracts/golden/ticketing-hardening/itn-write-guard.golden.md`.

### Verification — and why it's structural, not behavioural

This is the one place in the whole stream where the fix cannot be proven by a live HTTP
round-trip: a gate-issued ITN dies at the source-IP allowlist (it isn't coming from a
DNS-resolved PayFast host) and, even past that, at the server-confirm callback (PayFast
only returns `VALID` for a payment it actually processed). So:

- **A33** diffs the live file byte-for-byte against
  `contracts/golden/ticketing-hardening/itn-route.expected.ts.txt`, an
  architect-authored file that *is* the specification — not retyped, not reflowed, not
  "improved" by `@dev`.
- **A15** checks the live file's sha256 against a pinned value.
- **A34** is a behavioural regression guard, explicitly honest that it cannot
  discriminate today: it replays a correctly signed duplicate ITN for a checked-in
  ticket and confirms the ticket stays `checked-in`. It is green both before and after
  this fix, for the same source-IP/server-confirm reason above — but it exists so that
  a *future* change which does let one booking reference open the door twice fails
  something.

### The re-pin itself

| | sha256 |
|---|---|
| old pin (round-1 contract authoring) | `6dcde6d5458d2903dd8ab50ad8146e28c7fd01ecb057b9dab14844747b18a3cb` |
| new pin (round-2) | `7c96726ab4bba28ec8ef027dd7747c39358d23bb27ca1dcac4328201df3b4d0f` |

Round 1 explicitly said none of its four fixes required editing this file, and none
did. S4 is a fifth defect, found by @qa attacking beyond the round-1 scope, and it is
*inside* this file — `lib/checkin.ts` already refuses correctly on its own, and no
other module writes ticket status, so there is nowhere else to fix it. Leaving a known
door-reuse defect in place purely to preserve a hash is not a security posture.

**Who computed the new hash, and how `@dev` used it:** `@architect`, from the expected
golden file, *before* any production code for round 2 was written. `@dev` never
re-pins — the only way to a green A15 was to make the live source byte-identical to a
file `@dev` did not author. A15 itself is otherwise unchanged: same id, same command,
not loosened, and it continues to catch every future unauthorised drift on this file.

---

## Operational notes for a future maintainer

**Reservations expire after 30 minutes.** `RESERVATION_TTL_MINUTES` in
`lib/tickets-constants.ts` — currently `30`. Change it there, not inline; it is read by
both the checkout route (writing `expiresAt`) and `lib/data/tickets.ts` (deciding
whether an expired `reserved` document still counts toward capacity). There is no
sweeper — expiry is evaluated lazily wherever the capacity count is read.

**Checkout requires an `Idempotency-Key` header.** `TicketPurchaseForm.tsx` generates
one UUID via `crypto.randomUUID()` when the component mounts and sends it on every
submission attempt from that mount. **A browser Back navigation from PayFast remounts
the form with a fresh key** — the old key is not reused — so a buyer who goes back and
retries takes a *second* reservation rather than replaying the first. This is
deliberate (see F9 above): reservation expiry (F5) is what releases the first,
abandoned seat 30 minutes later, rather than the form trying to manage key lifecycle
itself.

**This contract's checks are not safe to run concurrently with themselves.** Every
mutating check sweeps sentinel tickets (email domain `@harden-check.invalid`) on entry
as well as on exit, so two runs racing each other can delete each other's in-flight
fixtures. The suite takes an advisory, machine-local lock file for this reason — see the
contract's header comment in `contracts/contract-ticketing-hardening.yaml` for the full
reasoning, including the documented hazard that the lock cannot see mutations from
outside these scripts (a second checkout of the repo, another machine, a human in the
Firestore console).

---

## Files changed in this stream

- `lib/checkin.ts` — new; door-admission logic, extracted from the route
- `app/api/admin/checkin/route.ts` — now auth-only, delegates to `lib/checkin.ts`
- `lib/booking-ref.ts` — new; 60-bit Crockford base32 booking reference generator
- `lib/tickets-constants.ts` — added `RESERVATION_TTL_MINUTES`
- `lib/data/tickets.ts` — transactional counting, lazy reservation-expiry filtering
- `app/api/tickets/checkout/route.ts` — transactional capacity + idempotency,
  buyer/payload-bound key replay, capacity/price validation before reserving
- `app/api/tickets/itn/route.ts` — write guard changed from `!== 'paid'` to
  `!== 'reserved'` (hash-pinned, see above)
- `sanity/schemas/documents/ticketType.ts` — `price` validation added, `capacity`
  description corrected
- `apphosting.yaml` — `SITE_URL` declared, `RUNTIME` availability only
- `app/api/tickets/status/route.ts`, `lib/booking-ref.ts`,
  `components/tickets/TicketPurchaseForm.tsx` — comment corrections only (F9)

## Sources

- `contracts/contract-ticketing-hardening.yaml` — all 37 assertions
- `contracts/golden/ticketing-hardening/` — specification, especially
  `itn-write-guard.golden.md`
- `.agent/memory/scratch/harden-qa.md` — @qa's round-1 findings, S1–S7, with
  reproductions
- `.agent/memory/scratch/harden-brief-2.md` — round-2 dev brief and pre-fix baseline
- `.agent/memory/project/needs-human.md` — the Firebase Auth blocker
