# Reservation Release Path Verification

**Contract:** `.agent/memory/project/specs/verify-reservation-release-path/contract-f1.yaml` and
`contract-f2.yaml` (automated real-Firestore checks + structural proof). Both passed full QA and
Codex GPT-5.5 cross-model review.

This document covers what the reservation release mechanism actually is, why `reconcile-orders` is
alert-only (not a release mechanism), and a critical lesson about test fixtures that reuse real
content documents.

---

## The release mechanism is lazy-on-read, not a sweeper

An abandoned checkout holds its reserved seat for 30 minutes (set by `RESERVATION_TTL_MINUTES` in
`app/api/tickets/checkout/route.ts`). When that window expires, the seat is released.

**Release happens in-memory during read, not via a background job.**

`lib/data/tickets.ts`'s `stillHoldsSeat()` — called from `getSoldCountsByTicketType()` — is the
sole arbiter of whether a position still holds its seat:

```typescript
function stillHoldsSeat(data: FirebaseFirestore.DocumentData): boolean {
  if (data['status'] !== RESERVED_STATUS) return true;  // Paid orders always held
  const expiresAt = data['expiresAt'];
  if (!(expiresAt instanceof Timestamp)) return true;   // Defensive: treat missing as held
  return expiresAt.toMillis() > Date.now();             // Release = lazy exclusion
}
```

When a checkout flow or `/tickets` page calls `getSoldCountsByTicketType()`, every reserved
position whose `expiresAt` is in the past is silently excluded from the count. The position
document is never deleted, never updated, and its `status` is never changed by anything related to
expiry. It simply stops counting.

The next buyer for that ticket type will see the seat as available and can purchase it through
the normal checkout flow.

**Why lazy-on-read, not a sweeper?** A background job flipping `reserved -> cancelled` would race
with an ITN arrival settling the same position to `paid` — exactly the data loss scenario the
project's secret-corruption and fixture-leak incidents warn against. Lazy exclusion is race-free:
an ITN can land at any time; if it arrives after expiry but before the position is ever read
again, it still wins its seat because `stillHoldsSeat()` checks status before expiry.

---

## `reconcile-orders` is alert-only, not a release mechanism

`POST /api/admin/reconcile-orders` (Cloud Scheduler-triggered) is a detection + alerting service,
not a release mechanism. See [docs/order-reconciliation.md](order-reconciliation.md) for the full
design; the key points relevant here:

1. **It only writes bookkeeping fields.** The route's sole Firestore write is `reconciliationAlertedAt`
   on the order and its positions — never `status`, `amount`, `gatewayPaymentId`, or `purchasedAt`.

2. **This is structurally enforced, not just documented.** The route and `lib/reconciliation.ts`
   never import `markOrderAndPositionPaidByPaymentId` (the only function capable of flipping an
   order's status) and never delete/update a `tickets/` position directly.

3. **Why not auto-settle stranded orders?** A PayFast ITN that never arrived has no record in the
   PayFast API to query — we would need PayFast's separate Transaction Query API, which this
   codebase has never called or tested. Building an untested external-payment integration that
   then auto-writes a money-state field is exactly the risk profile the project's audit-alerting
   incidents warn against. Instead, reconcile-orders alerts a human who can manually investigate
   and settle if needed.

---

## Verification: proof it works end to end

The release mechanism's correctness rests on three properties:

1. **Lazy exclusion works:** `stillHoldsSeat()` excludes expired-reserved positions from the count
   (proven by `ticketing-position-expiry-write` F4, run in isolation).

2. **The exclusion is reachable from the real checkout route:** A buyer can actually purchase a
   freed seat through `POST /api/tickets/checkout` (**this is what this contract proves**).

3. **Paid seats are immune to expiry:** A position with `status: 'paid'` is never released,
   regardless of how old its `expiresAt` timestamp is (also proven here as a negative control).

**F1 contract proof:**

- **A2 (real HTTP checkout succeeds):** Fills `exhibitor` ticket type to capacity-1 with ordinary
  (unexpired) reservations, adds one already-expired reserved position, confirms the count is
  still capacity-1, then sends a real `POST /api/tickets/checkout` request for the same type
  through the running dev server and asserts HTTP 201. The freed seat is proven resellable
  through the production checkout path.

- **A3 (paid orders immune to expiry):** Creates a position with `status: 'paid'` and `expiresAt`
  24 hours in the past, confirms `getSoldCountsByTicketType` still counts it as held. Proves the
  branch order in `stillHoldsSeat()` — checking status before expiry — holds against real data.

- **A4 (reconcile-orders structurally alert-only):** Grep-based proof that the reconciliation
  route and `lib/reconciliation.ts` never import the status-flipping settle function and never
  delete or overwrite a `tickets/` position directly.

See `.agent/memory/project/specs/verify-reservation-release-path/goldens/README.md` for the full
decision record and test-design rationale.

---

## Test fixtures: never toggle real content for testing

**Incident:** During verification, a Sanity document (`ticketType-exhibitor`, the actual Exhibitor
admission product) got toggled `active: true` temporarily for test fixtures. It briefly leaked
onto the live `/tickets` page as a fake R0 product. Three problems:

1. Real content documents can always be edited by humans — toggling a flag for testing makes it
   impossible to distinguish "is this flag set correctly for production?" from "is it set for a
   test?"

2. When the test runs or the environment changes, the fixture state drifts. There is no script to
   converge it back.

3. If a test teardown fails, the real product is left toggled, potentially affecting live traffic.

**Solution: dedicated, permanently-excluded fixture documents + idempotent seed script.**

A new fixture document (`ticketType-qa-fixture`, slug `qa-fixture-ticket`) was created with:

- **Double exclusion:** `category: 'qa-fixture-only'` (custom category that can never match any
  page query) + `demo: true` (secondary exclusion flag). Either one is sufficient; both exist so
  a single stray field cannot enable the fixture.

- **Idempotent seed script:** `scripts/seed-qa-fixture-ticket-type.ts` runs
  `client.createIfNotExists()` on first run, then on every run: compares the fixture's current
  state against the canonical shape defined in the script, and uses `client.patch().set().unset()`
  to converge any stray fields. The script derives the list of stray fields from the ticketType
  schema itself, so newly-added optional schema fields are unset automatically.

- **Non-destructive to real documents:** The fixture's `_id` (`ticketType-qa-fixture`) is
  exclusively owned by this script. Real products have their own ids. A full `.set()` patch is
  safe for the fixture but would be unsafe for a real editorial doc.

**Lesson:** Never toggle a real product's `active`/`category` flags for testing. Use a dedicated,
permanently-excluded fixture document with a schema-aware seed script that fully converges its
state on every run. This way, the fixture can never drift or leak, regardless of environment or
test outcome.

---

## Files changed

No production code was changed — this was a verification contract. Changes were limited to:

- `.agent/memory/project/specs/verify-reservation-release-path/goldens/` — real-Firestore checks
- `scripts/seed-qa-fixture-ticket-type.ts` — new idempotent seed script for the QA fixture
- `contracts/checks/ticketing-hardening/_shared.mjs` — fixed stale `postCheckout()` shape (F2)

---

## Sources

- `.agent/memory/project/specs/verify-reservation-release-path/contract-f1.yaml` — F1 contract,
  all 4 assertions (lazy-release proof, negative control, reconcile-orders structural proof)
- `.agent/memory/project/specs/verify-reservation-release-path/contract-f2.yaml` — F2 contract,
  fixes stale helper shape that was blocking F1 verification
- `.agent/memory/project/specs/verify-reservation-release-path/goldens/README.md` — full decision
  record: why lazy-on-read, why reconcile-orders is not the release mechanism, test-design
  rationale for A2 (real HTTP proof) and A3 (negative control)
- `.agent/memory/project/specs/verify-reservation-release-path/goldens/README-f2.md` — F2
  decision record: the stale `postCheckout()` shape issue
- [docs/order-reconciliation.md](order-reconciliation.md) — reconcile-orders design and alert-only
  scope decision
- [docs/ticketing-position-expiry-write.md](ticketing-position-expiry-write.md) — the initial
  proof that expired positions are excluded from counts (in isolation)
