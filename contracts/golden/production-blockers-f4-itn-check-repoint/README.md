# F4 — repointing the seven stale payfast-m1 ITN checks

## Verifying the analyst's diagnosis (I checked, did not take it on trust)

Read `app/api/tickets/itn/route.ts` and `lib/orders.ts` directly.

- `route.ts:13` imports `findReservedOrderByPaymentId, markOrderAndPositionPaidByPaymentId`
  from `@/lib/orders`.
- `route.ts:147-163` calls `findReservedOrderByPaymentId(mPaymentId)` — a read-only,
  non-transactional lookup against the `orders` collection
  (`lib/orders.ts:215-234`, query at line 221: `db.collection('orders').where('m_payment_id', ...)`).
  If it returns `not-found`, the route logs exactly `"No order found for m_payment_id —
  rejecting ITN"` (`route.ts:159-160`) and acknowledges. Confirmed.
- `route.ts:248` calls `markOrderAndPositionPaidByPaymentId(...)`. The real transaction is
  `lib/orders.ts:280` (`db.runTransaction(async (transaction) => {...})`), inside which
  `transaction.get(orderRef)` (line 281) precedes `transaction.get(positionRef)` (line 294)
  and both `transaction.update(orderRef, ...)` (line 300) and
  `transaction.update(positionRef, ...)` (line 305). Confirmed: the transaction moved out
  of the route entirely.
- `app/api/tickets/checkout/route.ts:473` creates `orderRef = orders.doc()` and
  `lib/checkout-reservation.ts:61,77` sets `m_payment_id: input.bookingRef` on both the
  order and the position it builds. Confirmed: checkout already writes the `orders`
  document the ITN route now expects.

The diagnosis holds. This is a fixture/check-script staleness problem, not a production
defect. The analyst's file:line citations were all accurate on inspection.

## Fixture strategy: reuse `buildReservationDocs`, don't hand-roll a second shape

Two production-shaped candidates existed:

1. **`createOrderWithPosition`** (`lib/orders.ts`, F8's comp-ticket primitive). Writes
   both docs via `transaction.set()`, in a shape close to but not identical to what
   checkout writes (no `recoveryToken`/`recoveryTokenExpiresAt` on the order, for
   instance — those are checkout-specific fields `buildReservationDocs` adds).
2. **`buildReservationDocs`** (`lib/checkout-reservation.ts`, F10's own checkout
   primitive) — **the actual function checkout calls to build the docs it writes**. Pure
   (no Firestore import, no `Date.now()`), so a check script can call it directly and get
   back exactly the two plain objects checkout would produce, then write them itself.

**Decision: use `buildReservationDocs`.** It is the single closest-to-the-metal
production shape available — anyone who later changes what checkout writes changes this
function, and the fixture inherits that change for free instead of silently drifting out
of sync again (which is the entire reason this feature exists: A18-A21/A30 drifted
because their fixture, `createTicketDoc`, never tracked what the real write path
produces). `createOrderWithPosition` is a reasonable second choice and remains available
if a future feature needs the F8 comp-ticket shape specifically, but for ITN fixtures —
which must look like a genuine checkout reservation, not a comp — `buildReservationDocs`
is the more honest model.

### Where the new helper lives

`createOrderAndPosition()` goes in **`contracts/checks/payfast-m1/_itn-harness.mts`**, a
`.mts` file always executed via `pnpm exec tsx` — safe to statically import
`@/lib/checkout-reservation` (a `.ts` module) because tsx's loader resolves the `@/*`
alias project-wide for every module in that process, including nested dynamic imports.

It deliberately does **not** go in the shared, cross-suite
`contracts/checks/ticketing-hardening/_shared.mjs`. That file backs multiple check
suites, some of which may run under plain `node` without tsx's TS-loader/path-alias
support — adding a hard TS import there risks breaking checks this feature has no reason
to touch. `_itn-harness.mts` already exists as the payfast-m1-local seam for exactly this
kind of local addition (see its own header comment on why it dynamically imports
`_shared.mjs` rather than the reverse).

`createOrderAndPosition(fields)`:
- Requires `fields.attendeeEmail` to satisfy `isSentinelEmail` (same guard as
  `createTicketDoc`, reused from `_shared.mjs`).
- Defaults `showId` to `NATIONAL_SHOW_ID`, `ticketType` to `TARGET_TICKET_TYPE`,
  `attendeeName` to `'Harden Check'`, `amount` to `0` — same defaults `createTicketDoc`
  already used, so existing call sites need to add only the fields they actually
  override (unchanged diff shape).
- Generates `orderRef = db().collection('orders').doc()` and
  `positionRef = db().collection('tickets').doc(bookingRef)` — the position keyed by
  `bookingRef`, matching production's own `tickets.doc(bookingRef)` convention.
- Calls `buildReservationDocs({ orderId: orderRef.id, bookingRef, ... })` to get
  `{ order, position }`.
- Calls `recordFixtureCreated('orders', orderRef.id)` and
  `recordFixtureCreated('tickets', positionRef.id)` **before** each corresponding
  Firestore write (same "manifest before write" ordering `createTicketDoc` already
  follows, so a kill mid-fixture is still crash-recoverable).
- Writes both docs with plain `.set()` (not a transaction — fixture setup is allowed to
  bypass the atomicity the production path enforces, exactly as `createTicketDoc`
  already bypasses the HTTP route on purpose).
- **Returns `positionRef`** (not an object) — the same return shape `createTicketDoc`
  had, so `readTicketById(ref.id)` at every call site keeps working with a rename-only
  diff (`createTicketDoc` -> `createOrderAndPosition`, plus whatever new fields the
  script wants to set, e.g. `showId` if a check ever needs a non-default one).

`m_payment_id` is no longer a separate fixture parameter: `buildReservationDocs` always
sets it to `input.bookingRef` on both documents, which is what every existing call site
already passed anyway (`m_payment_id: bookingRef`). This removes one way the fixture
could accidentally diverge from what checkout guarantees (an order and its position
always share `m_payment_id`, always equal to the booking reference).

## Residue gap this feature would otherwise reopen

`_shared.mjs`'s `sweepSentinels()` and `assertNoResidue()` (lines ~191-227) only ever
query the `tickets` collection, filtered on `attendeeEmail`. They have no knowledge of
`orders` at all. `createOrderAndPosition`'s order document carries the sentinel marker on
`buyerEmail`, not `attendeeEmail` (per `buildReservationDocs`'s own field mapping:
`buyerEmail: input.attendeeEmail`).

Left as-is, this produces a silent residue leak with the exact shape the project has
already been burned by once
([[project_contract_checks_mutate_live_content]] — sentinel corruption sat on the
deployed site for three days because residue alerts went to a log nobody reads):

- `recordFixtureCreated('orders', orderRef.id)` correctly writes a manifest entry.
- `withCleanup`'s `finally` block calls `sweepSentinels()` — which never looks at
  `orders`, so the order document survives.
- `assertNoResidue()` — also `tickets`-only — reports clean anyway.
- Because `assertNoResidue()` reported clean, `withCleanup` proceeds to
  `clearManifestEntries(currentRunRecordedIds)`, which removes the `orders` manifest
  entry **even though the document was never deleted**. The crash-recovery preflight
  sweep (`sweepManifestFromPriorRun`, which IS collection-agnostic) now has no record of
  it either. The stray `orders` document becomes permanently untracked.

**Fix scoped into this feature (A4):** extend `sweepSentinels()` and `assertNoResidue()`
in `_shared.mjs` to also query `orders`, filtered on `buyerEmail`, using the same
batch-delete / poll-and-reassert pattern already used for `tickets`. This is
infrastructure shared by every check suite that imports `_shared.mjs`, but the change is
purely additive (a second collection added to an existing sweep loop) and the residue
risk it closes is a direct, mechanical consequence of this feature's own fixture change —
not scope creep. Left unfixed, this feature would introduce a new residue class the
existing safety net cannot see.

## The AST-scoping bug this design catches

Naively "repointing" `check-paid-write-inside-transaction-scope.mjs` and
`check-server-confirm-fetch-outside-transaction-scope.mjs` by only swapping their
`ROUTE_PATH` default from `route.ts` to `lib/orders.ts` would produce a check that
**silently targets the wrong transaction.**

`_ast-shared.mjs`'s `findRunTransactionCallback(root)` walks `root` and returns the
**first** `<anything>.runTransaction(async (transaction) => {...})` call it finds. In
`route.ts` there was only one, so "first" and "correct" were the same call. `lib/orders.ts`
has **two**: `createOrderWithPosition`'s (around line 119, F8's comp-ticket write) and
`markOrderAndPositionPaidByPaymentId`'s (line 280, the one these checks actually care
about) — and `createOrderWithPosition`'s appears **earlier** in the file. An unscoped
repoint would have these checks silently validate the wrong function's transaction,
report green, and prove nothing about the paid-write path they're named for.

**Fix:** add `findFunctionDeclarationBody(sourceFile, functionName)` to `_ast-shared.mjs`
— locates the named top-level `FunctionDeclaration` (`export async function
markOrderAndPositionPaidByPaymentId(...)`) and returns its body. Both checks first
resolve `markOrderAndPositionPaidByPaymentId`'s body via this helper, then call
`findRunTransactionCallback` (unchanged, already generic about its root) **scoped to that
subtree**, never to the whole file.

The self-test for the new helper must include a decoy fixture with two sibling
functions — one shaped like `createOrderWithPosition` (its own `db.runTransaction`,
appearing first in source order) and one shaped like
`markOrderAndPositionPaidByPaymentId` (appearing second) — and assert the helper resolves
to the second one by name, not the first one by position. Without this decoy in the
self-test, a regression that silently reverts to "first in file" would pass every
existing self-test unnoticed, which is exactly the failure mode being designed against.

### Identifier genericity (A30/A31)

The old `firstArgIsIdentifier(node, 'docRef')` hardcoding also doesn't survive the move:
`lib/orders.ts` names its refs `orderRef` and `positionRef`, never `docRef`, and updates
**two** of them in the same transaction (order status and position status, both to
`'paid'`). The rewritten judge function must check, for **every** `transaction.update(<ident>,
...)` call found in the scoped callback body, that a `transaction.get(<ident>)` call with
the **same identifier text** occurs earlier in the same callback — not a single
hardcoded name. The bare-write bypass regex (`docRef.update(`) generalises to
`\b\w+Ref\.update\(` — catches `orderRef.update(`, `positionRef.update(`, or any future
`*Ref.update(` escape hatch, following the file's own naming convention rather than one
literal name.

## A32, restated as a two-file claim

Before F10, "the server-confirm fetch is outside the transaction" was a single-file,
single-function claim. It no longer can be: the fetch (`route.ts:208-227`) and the
transaction (`lib/orders.ts:280`) are now in different files, called from different
functions. Structurally, "different file, different function, called as an ordinary
awaited statement rather than passed in as a closure" already implies the fetch cannot be
a lexical descendant of the transaction callback — that part of the original claim is now
true by construction, not by anything this check discovers.

What the rewritten check still needs to *prove*, because it is not free:

1. **In `route.ts`**: the real `fetch(PAYFAST_SANDBOX_VALIDATE_URL, ...)` call occurs
   **before** the call site `markOrderAndPositionPaidByPaymentId(...)` in source order —
   i.e. the paid-write is provably gated behind a successful server-confirm, not just
   coincidentally ordered that way today. (Confirmed by inspection: fetch at
   `route.ts:209`, call at `route.ts:248`.)
2. **In `lib/orders.ts`**: `markOrderAndPositionPaidByPaymentId`'s own transaction body
   (found via the same `findFunctionDeclarationBody` + `findRunTransactionCallback`
   scoping as A30/A31) contains **zero** `fetch(PAYFAST_SANDBOX_VALIDATE_URL, ...)`
   calls — defending against a future edit that moves the network round-trip inside the
   Firestore transaction (which would violate the route's own documented constraint that
   transactions must not wrap external network calls).

Both files are parsed independently; there is no cross-file AST linkage attempted (the
TypeScript compiler API parses one `SourceFile` at a time and this check does not need a
type-checker/program to prove either claim) — each file's source-order/scope claim
stands on its own, and together they cover what the original single-file claim covered.

Env var convention: keep `ITN_ROUTE_PATH_OVERRIDE` for `route.ts`, add
`ORDERS_LIB_PATH_OVERRIDE` (unset in every committed run, same manual-proof-only
convention as the existing override) for `lib/orders.ts`.

## Pinning judgement: does `lib/orders.ts` need a pin?

**Yes.** `app/api/tickets/itn/route.ts` carries a `shasum -a 256 -c` pin in five
contracts (`contract-payfast-m1-lock-cleanup-fix.yaml:69`,
`contract-ticketing-f1-show-collision.yaml:116`,
`contract-ticketing-f10-itn-repin.yaml:248`, `contract-ticketing-hardening.yaml:253`,
`contract-ticketing-m1-m2.yaml:330`) precisely because it was, in full, the payment
security boundary — any edit had to go through a deliberate re-pin ceremony (see
`contracts/golden/ticketing-f10-itn-repin/README.md` "The re-pin mechanism").

F10 relocated a materially security-relevant slice of that boundary — the atomic paid
write, the idempotency guard, and the resurrection defence that A30/A31 exist to prove —
into `lib/orders.ts`, which today carries **no pin at all**. That file can be edited
freely, with no gate forcing review, even though an edit to
`markOrderAndPositionPaidByPaymentId` could silently reintroduce a double-write, break
the idempotency guard, or let a checked-in ticket resurrect — exactly the failure modes
the route's pin existed to prevent. The protection partly moved; the pin did not move
with it. That is a real gap, not a hypothetical one: this very feature exists because a
similar architectural move (F10 moving the transaction) went unnoticed by the checks that
should have caught it.

**Decision:** pin `lib/orders.ts` in full (not just the one function — there is no
existing mechanism in this project for pinning a function body independent of its file,
and `createOrderWithPosition` in the same file is also money-relevant: it is the
reservation write the whole two-write model rests on). Added as **A12** in this
contract's own assertions, using the same `shasum -a 256 -c` mechanism as the route's
pin. `contracts/golden/production-blockers-f4-itn-check-repoint/orders-lib.golden.sha256`
holds `47c2e83c920a00b12953657c667250690a595049537188728ef9a5588301002b`, the file's sha256
as read for this contract (`shasum -a 256 lib/orders.ts`, 2026-08-18).

This is added as a **new, standalone pin in this contract only** — not retrofitted onto
the five contracts that pin `route.ts`. Editing those five contracts is out of this
feature's declared scope (check scripts and fixtures for payfast-m1 specifically), and
retrofitting a second pinned file into an unrelated contract's own ceremony is exactly
the kind of scope creep the hard constraints warn against. **Recommended follow-up, not
executed here:** a future feature should add the equivalent `lib/orders.ts` pin to
whichever of those five contracts are still active gates, so a future legitimate edit to
either file goes through one paired re-pin ceremony instead of two independent ones
drifting apart.

## Anti-drift recommendation (not built — a recommendation only)

This staleness existed from F10's merge (`d00604f`) until today, unnoticed, because the
*behavioural* half of payfast-m1 is LOCAL-ONLY and credential-gated (needs
`PAYFAST_SANDBOX_*` / `FIREBASE_ADMIN_*` from `.env.local`) and therefore rarely runs. The
*structural* half — the two AST checks — needed no credentials at all and could have run
in CI on every commit touching either file, and would have caught the wrong-file
targeting the day F10 merged.

Recommend: wire the credential-free structural checks
(`check-paid-write-inside-transaction-scope.mjs`,
`check-server-confirm-fetch-outside-transaction-scope.mjs`) into a CI job that triggers
specifically on any diff touching `app/api/tickets/itn/route.ts` or `lib/orders.ts` —
independent of whether the rest of the payfast-m1 suite can run (it usually can't in CI,
for lack of credentials). A path-scoped CI trigger costs nothing to run, needs no
secrets, and would have turned this feature's entire diagnosis into a red CI check on the
F10 PR itself rather than a discovery made months later by a dedicated audit. This is a
recommendation for the CI configuration, not something built as part of F4.
