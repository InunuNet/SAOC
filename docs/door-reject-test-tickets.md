# Door Rejection of Test Tickets

**Spec:** `contracts/golden/door-reject-test-tickets/README.md` (golden input:
`contracts/golden/door-reject-test-tickets/truth-table.json`).
**Check:** `contracts/checks/door-reject-test-tickets/admission.test.mjs`.
**Contract:** `contracts/door-reject-test-tickets.yaml` (16 assertions).

This document covers the door check-in change that refuses test-mode tickets once payments go
live. It assumes familiarity with the check-in flow in `app/api/admin/checkin/route.ts` and the
ticketing test-mode flag in `lib/ticketing-test-mode.ts`.

---

## The problem this solves

While ticketing runs in test mode, the committee issues test tickets. These carry real-looking QR
codes, so a test ticket scanned at the door looks the same as a genuine one. Once
`TICKETING_PAYMENTS_LIVE` is switched on, nothing at the door would distinguish the two. This
feature makes the door refuse any ticket that was not explicitly issued in live mode.

## What it does

### Provenance on every new order and ticket

Every order and every ticket (position) created by the ticketing code now carries an
`issuedInTestMode` boolean. It is set from `isIssuanceTestMode()` (`lib/ticket-issuance-mode.ts`) at creation time:

- `lib/checkout-reservation.ts`: `buildReservationDocs()` and `buildMultiReservationDocs()`. Each
  captures one value per creation operation, so every item in a multi-item cart shares it.
- `lib/orders.ts`: `createOrderWithPosition()`, used by the admin comp route as well as other
  creation paths. Comp tickets are not exempt.

The field is typed as optional on `Order` and `Ticket` in `types/index.ts`, because documents
created before this change have no marker. Creation output always includes the boolean. Stored
data is not coerced on read.

Caller-supplied or request-supplied markers are ignored. The server derives the value.

### The live-mode rule

`lib/checkin-test-ticket-guard.ts` exports `decideTestTicketAdmission()`, a pure function. The
check-in service calls it with the raw stored marker and `liveMode: !isTicketingTestMode()`:

| `issuedInTestMode` | Test mode | Live mode |
| --- | --- | --- |
| `true` | allow | reject |
| `false` | allow | allow |
| missing, `null`, or any non-boolean | allow | reject |

Only the exact value `false` is admitted in live mode. Missing, `null`, `true`, strings, numbers,
objects and arrays are all rejected, so the rule fails closed. The full truth table is the
executable golden in `truth-table.json`.

The guard runs inside the check-in transaction in `lib/checkin.ts`, after the not-found and
wrong-show checks and before the already-checked-in and unpaid checks. A test ticket is therefore
refused in live mode even if it has already been used or is unpaid.

### The refusal

A live-mode test ticket gets:

- HTTP `403`
- Body: `{"success":false,"code":"test_ticket","error":"Test ticket — not valid for entry"}`

The refusal is recorded as one refusal audit entry through the existing audit path. No ticket or
order write happens. `checkedInAt` is not changed, and the scanner counter is not incremented.

Other refusals now also return a `code` field. This is additive. Authentication responses are
unchanged.

### Test mode is unchanged

In test mode the guard always allows. Every existing check-in rule behaves as before. No launch
constant, banner, payment adapter or environment setting is changed by this feature.

## Legacy documents

Production holds orders and tickets created before this change (48 orders, 64 tickets at the
2026-10-29 audit) with no `issuedInTestMode` marker. The 17 paid orders among them were settled
through the Ozow sandbox. The door admits only the literal boolean `false` once live, so an
untagged document means test and is refused. Missing, `null`, `0`, `"false"`, `{}` and `[]` all
refuse. The prod-shaped goldens are in `contracts/golden/door-reject-test-tickets/legacy-untagged.json`.

Do not backfill. Absent is the safe state: the guard never reads a default, so the only way to be
admitted is for the server to have written `false` at creation. A go-live cutoff timestamp was
considered and rejected: it needs a hand-set date, and a wrong date either admits sandbox tickets
or refuses real ones.

## Gateway coupling

The stamp is no longer derived from `isTicketingTestMode()` alone. `isIssuanceTestMode()` returns
`isTicketingTestMode() || PAYMENT_GATEWAYS_SANDBOX_ONLY`, so a new order or ticket is stamped
`false` only when both the launch constant and the sandbox-only flag are flipped. Flipping the
launch constant alone is safe: tickets stay stamped as test and the door refuses them.
`PAYMENT_GATEWAYS_SANDBOX_ONLY` is flipped in the go-live commit together with the payment
adapters, and `contracts/checks/door-reject-test-tickets/gateway-coupling.sh` fails if it is
`false` while `lib/payments/ozow.ts` or `payfast.ts` still show a sandbox marker. The door itself
keeps `liveMode: !isTicketingTestMode()`, so committee testing is unchanged.

## Consequences

- **Flipping the launch switch refuses every older ticket.** When `TICKETING_PAYMENTS_LIVE` is
  flipped, every ticket issued before launch has no live marker and is refused at the door. This
  is intended. Any legitimate pre-launch ticket, for example a comp, must be re-issued after
  launch.
- **Seed fixtures are refused in live mode.** `scripts/seed-door-test-tickets.ts` writes its
  `DOOR-QR-*` fixture tickets without an `issuedInTestMode` marker, so those fixtures are refused
  in live mode. Synthetic data without a marker is intentionally invalid in live mode.
- **Settlement never relabels provenance.** Payment notifications update existing reservations.
  They do not stamp new provenance on them, and missing provenance is never backfilled to `false`.

## Files touched

- `lib/checkin-test-ticket-guard.ts` (new): `decideTestTicketAdmission()`
- `lib/checkin.ts`: guard call in `admit()`, `test_ticket` refusal entry
- `lib/checkin-audit.ts`: `test_ticket` audit outcome
- `app/api/admin/checkin/route.ts`: refusal-to-outcome mapping, `code` in refusal responses
- `lib/ticket-issuance-mode.ts` (new): `isIssuanceTestMode()`, `PAYMENT_GATEWAYS_SANDBOX_ONLY`
- `lib/checkout-reservation.ts`: provenance on order and positions
- `lib/orders.ts`: provenance in `createOrderWithPosition()`, replay keeps the original record
- `types/index.ts`: optional `issuedInTestMode` on `Order` and `Ticket`

## Running the tests

```bash
node --test contracts/checks/door-reject-test-tickets/admission.test.mjs
```

There is no unit-test package script in this checkout. The check transpiles the real source in
memory with the installed TypeScript. It makes no network calls and needs no Firestore emulator.

## Limits

The tests are offline. They do not prove deployed Firestore behaviour, concurrency, camera
scanning, or browser layout. Re-run the door scanner against a sandbox ticket in the deployed
environment before launch. See the launch checklist in `docs/launch-checklist.md`.
