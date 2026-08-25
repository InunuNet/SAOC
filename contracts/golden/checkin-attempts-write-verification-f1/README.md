# checkin-attempts-write-verification F1 — golden

## What's being verified

Backlog defect (P2): does a real door scan actually produce a `checkinAttempts` document in
live Firestore? A paused mission (`prove-ticket-purchase-works-end-to-end-b`, M1 gate)
reported observing none after a live scan. Everything upstream of this mission has already
proven the *code path* is correct:

- `app/api/admin/checkin/route.ts`'s `audit()` closure is called and `await`ed on every
  outcome branch, including the terminal `admit` case.
- `lib/checkin-audit.ts`'s `recordCheckinAttempt()` never silently swallows a write failure —
  a rejection becomes `{ recorded: false, error }`, and the route's `logAuditWriteFailure()`
  logs it at `console.error` with full context (bookingRef, showId, outcome, error).
- `lib/checkin-audit-store.ts`'s Firestore adapter is a 6-line `.add()`-only wrapper; it goes
  through the Admin SDK, so Firestore security rules cannot be the failure mode.
- This is F7 of mission `ticketing-foundation`
  (`contracts/contract-ticketing-f7-checkin-audit.yaml`,
  `contracts/golden/ticketing-f7-checkin-audit/README.md`). That golden's own "What this
  contract does NOT prove" section (item 1) **already names this exact gap in its own words**:
  all 8 of F7's assertions run offline against a fabricated in-memory store; none of them prove
  a document actually lands in live Firestore on a real route call. It recommends closing the
  gap with a live check. **This mission is that live check — not a re-investigation from
  scratch, and not a rewrite of already-correct code.**

So F1's job is not "fix the write" (there is nothing wrong with it that source-reading turned
up) — it is to produce **empirical, repeatable, read-only proof** of what actually happens on
live Firestore, per the backlog's explicit instruction: *query Firestore directly, do not queue
a human scan.*

## The empirical method (no live scan, no side effects)

`lib/checkin.ts` (~line 93–96) sets `status: 'checked-in'` and a `checkedInAt` Firestore
`Timestamp` on a ticket position, in the **same transaction** as the admission decision, for
every real admit. That field is a durable, independent signal that "a real check-in happened,"
completely independent of whether the audit write succeeded — it does not depend on
`checkinAttempts` at all.

This gives a cross-reference that needs zero new scans and zero writes:

1. Query the `tickets` collection (Admin SDK, read-only) for every position where
   `status == 'checked-in'`.
2. For each one, query `checkinAttempts` (read-only) for a record with
   `outcome == 'admit'` and a matching `bookingRef` (preferred — the unique identifier of the
   exact ticket position check-in itself scans and admits by, `checkInByBookingRef()` in
   `route.ts`; a document's own `bookingRef` field on the `tickets` collection is the join key)
   — fall back to `orderId` only if `bookingRef` is absent on a legacy document. `orderId` must
   never be the primary join key: it is shared across every sibling position in the same
   multi-line-item order (`lib/checkout-reservation.ts`), so joining on it first would report a
   ticket as "verified" merely because some OTHER position in the same order had a genuine
   admit record — masking exactly the class of live-write failure this script exists to catch.
3. Report:
   - Every checked-in ticket WITH a matching audit record → the live write path works. This is
     the expected, common-case result, and closes F7's documented gap with real evidence
     instead of a source-only claim.
   - Any checked-in ticket WITHOUT a matching audit record → first hard proof of a live
     failure, with the exact `bookingRef`/`orderId`/`checkedInAt` of the affected ticket(s) —
     enough to actually debug it, unlike the original "no document observed" report which named
     no specific failing scan.

## Required deliverable: `scripts/verify-checkin-audit-write.ts`

Model on `scripts/scan-firestore-residue.ts` for the credential/Admin-SDK pattern: reads
`.env.local` directly (no `dotenv` package — see that script's own header comment about a prior
credential-corruption incident: `project_secret_corruption_class` memory), initializes
`firebase-admin` the same way `lib/firebase-admin.ts`'s `initAdmin()` does, and is **read-only
by construction** — it must never call `.set()`, `.update()`, `.delete()`, `.add()`, or run a
transaction/batch write against either collection. Only `.get()` / `.where()` / query reads.

Behaviour:

- Query `tickets` (or whatever the actual position-level collection is named per
  `lib/checkin.ts` — confirm the exact collection/subcollection path by reading that file, do
  not assume) for documents/positions where `status == 'checked-in'`.
- For each, look up `checkinAttempts` for a matching `outcome == 'admit'` record (by
  `bookingRef`, falling back to `orderId` only for a legacy document with no `bookingRef`).
- Print a clear summary: total checked-in tickets found, how many have a matching audit
  record, and — for any that don't — their `bookingRef`, `orderId`, and `checkedInAt`.
- **Exit code is the pass/fail signal**: exit `0` if every checked-in ticket has a matching
  audit record (including the trivial case of zero checked-in tickets — nothing to
  cross-reference is not a failure, print that explicitly rather than treating it as a pass by
  silence). Exit `1` if any checked-in ticket has no matching audit record — this is the
  live-failure case the backlog is asking about.
- Run with `pnpm exec tsx scripts/verify-checkin-audit-write.ts`, mirroring
  `scan-firestore-residue.ts`'s own run instructions. Support a `--fixture <path>` mode the same
  way that script does, so the script can also be exercised offline in the assertion below
  without live credentials.

## What this mission does NOT do

- Does not touch `app/api/admin/checkin/route.ts`, `lib/checkin-audit.ts`, or
  `lib/checkin-audit-store.ts` — investigation found nothing wrong in the current source, so
  there is no fix to make there. **If, and only if,** running the script against live Firestore
  in Phase 4 finds a real mismatch, @dev must stop, report the exact failing ticket(s) back
  through the chain, and NOT attempt a blind fix — the root cause would need its own
  investigation (this contract's assertions do not presuppose what a fix would look like).
- Does not queue or require a human to perform a live scan.
- Does not change `checkinAttempts`' schema, the F7 contract, or its golden README.

## Assertions summary (see contract-f1.yaml for exact commands)

- A1 — `scripts/verify-checkin-audit-write.ts` exists.
- A2 — Structural: the script is read-only by construction (no Firestore mutation method
  appears anywhere in the file).
- A3 — Structural regression-lock: `app/api/admin/checkin/route.ts` still `await`s the local
  `audit(...)` closure on every outcome branch, including `admit` — proves the wiring this
  mission found correct hasn't regressed by the time the gate runs.
- A4 — Structural regression-lock: `lib/checkin-audit.ts` still logs (never silently drops) a
  failed write — `logAuditWriteFailure` is still called wherever `recorded: false` is possible.
- A5 — Behavioural, offline via `--fixture`: given a fixture with one checked-in ticket and a
  matching `checkinAttempts` admit record, the script exits 0; given a fixture with a
  checked-in ticket and NO matching record, the script exits 1. Proves the script's own
  pass/fail logic is correct before anyone trusts its live output.
- A6 — Live, read-only: run the script against the real Firestore project with no flags. This
  is the actual empirical answer to the backlog's question. A hard pass/fail gate on the live
  run's exit code: FAILS ON any non-zero exit, including a credential/init failure — there is
  no special-casing for a missing live environment. If it fails, the mission is not done; the
  failing ticket(s) (or the credential/init error) are the lead for a follow-up investigation,
  and @dev must report them back through the chain rather than attempting a blind fix.
