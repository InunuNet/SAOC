# ITN write guard — golden (round 2, S4) AND the record of the A15 re-pin

Closes **S4 (MEDIUM, pre-existing)**: a late ITN resurrects a checked-in ticket.

`app/api/tickets/itn/route.ts:140` short-circuits only on `status === 'paid'`. A
`checked-in` ticket passes every gate — signature, source IP, amount match, PayFast
server-confirm, `payment_status: COMPLETE` — and the transactional write at :217 checks
only `!== 'paid'`, so it sets the ticket back to `paid`. `lib/checkin.ts:88` refuses
re-admission solely on `status === 'checked-in'`, so the same booking reference opens the
door a second time. No attacker is required: PayFast retries ITN delivery until it sees a
200, and a lost acknowledgement hours later reproduces it.

## The change is specified byte-for-byte

`contracts/golden/ticketing-hardening/itn-route.expected.ts.txt` **is** the intended file.
Copy it verbatim to `app/api/tickets/itn/route.ts`. Do not retype it, do not reflow it,
do not "improve" the comments — A15 pins its sha256 and A33 diffs against it.

Three hunks, nothing else in the file moves:

1. A `RESERVED_STATUS = 'reserved'` constant beside `PAID_STATUS`, with the reason.
2. The non-transactional fast path becomes `currentStatus !== RESERVED_STATUS → acknowledge()`,
   and **logs** when it short-circuits on a status that is neither `reserved` nor `paid`.
3. The transactional write guard becomes `!== RESERVED_STATUS → no-op`.

### Why hunk 2 logs

Turning the fast path into a positive `reserved`-only guard means a genuine payment
against a malformed or cancelled document is now silently ignored, and the 200 stops
PayFast retrying — money in, no ticket. That is the right posture (fail closed on the
write) but it must be reconcilable, so the non-`paid` case is a `console.error` carrying
`m_payment_id` and the observed status. The `paid` case stays silent: it is the ordinary
duplicate-delivery path and logging it would be noise.

### Why the guard is positive, not a longer negative list

`!== 'reserved'` covers `checked-in`, `cancelled`, `refunded`, a missing status field and
any status a future feature adds, without anyone remembering to extend a denylist. This
is the same fail-closed shape `lib/checkin.ts` already uses and that @qa could not break.

## Explicitly NOT done: an expiry check in the ITN

A payment that lands after the reservation TTL still flips the ticket to `paid`. See
`reservation-expiry.golden.md` — taking money and refusing entry is worse than an
oversell of one. Do not add `expiresAt` handling here.

## Explicitly NOT done: making the PayFast validate URL overridable

The only way to drive this handler's write path end-to-end from the gate is to point
`PAYFAST_SANDBOX_VALIDATE_URL` at a stub that returns `VALID`. That would put a
test-shaped environment variable inside a payment security boundary: anyone able to set
an env var could bypass server confirmation entirely. **Rejected.** The cost is that S4
is verified structurally (A15/A33) rather than behaviourally; that cost is worth paying.

---

# A15 RE-PIN — deliberate, dated, and recorded here

A15 pins this file's sha256 precisely so that it cannot change without a decision. This
is that decision.

| | sha256 |
|---|---|
| **old pin** (round-1 contract authoring, 2026-08-11) | `6dcde6d5458d2903dd8ab50ad8146e28c7fd01ecb057b9dab14844747b18a3cb` |
| **new pin** (round-2, 2026-08-11) | `7c96726ab4bba28ec8ef027dd7747c39358d23bb27ca1dcac4328201df3b4d0f` |

**Why the boundary moved.** The round-1 contract said "none of these four fixes requires
editing it", and none did. S4 is a fifth defect, it is *in* this file, and it cannot be
fixed anywhere else: `lib/checkin.ts` already refuses correctly, and no other module
writes ticket status. The alternative — leaving a known door-reuse defect in place to
preserve a hash — is not a security posture.

**Who computed the new hash.** @architect, from the expected-file golden, *before* any
production code was written. @dev never re-pins. The new value is the hash of
`itn-route.expected.ts.txt` as committed in this round; @dev's only route to a green A15
is to make the source byte-identical to a file they did not author.

**A15 is unchanged in every other respect** — same id, same command, same purpose. It is
not loosened, not deleted, and it continues to catch every future unauthorised drift.

## Assertions

| id | proves | kind |
|----|--------|------|
| A15 | the live file hashes to the new pin | structural — the pin itself |
| A33 | the live file is byte-identical to the expected golden, with a readable diff on failure | structural by necessity — see "NOT done" above; there is no way to obtain a genuine PayFast `VALID` confirmation inside the gate, so the write path cannot be reached over HTTP |
| A34 | after a replayed ITN POST, a checked-in ticket is still `checked-in`, its `checkedInAt` is unchanged, and the door still refuses re-admission | behavioural — **regression guard only.** Honest caveat: this is green before the fix too, because a gate-issued ITN dies at the source-IP and server-confirm gates and therefore never reaches the write either way. It cannot discriminate. A33 is what proves S4 is fixed; A34 exists so that a future change which *does* make the door admit twice fails something. |
