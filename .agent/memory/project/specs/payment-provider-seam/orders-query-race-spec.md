# Spec: the `lib/orders.ts:274` order-lookup race

**Status:** specification only. No production code written by @architect. For @dev dispatch.
**Written:** 2026-08-19. **Mission:** payment-provider-seam. **Blocks:** F3 (live purchase must
not run against a nondeterministic suite).

---

## 1. What the race is

`app/api/tickets/itn/route.ts` reads the same order **twice, by two independent index queries**:

| # | Site | Query |
|---|------|-------|
| 1 | `findReservedOrderByPaymentId` — `lib/orders.ts:223` | `orders.where('m_payment_id','==',ref).limit(1).get()` |
| 2 | `markOrderAndPositionPaidByPaymentId` — `lib/orders.ts:274` | **the same query again**, milliseconds later |

Query 2 is redundant: query 1 already located the document, and its `DocumentSnapshot` carries the
id. The second query re-derives, from a separate index read, a fact the route already holds. Two
index reads of the same key at two moments **can disagree**, and against a freshly-written document
they demonstrably do.

The transaction that follows is not implicated. Its authoritative re-read (`transaction.get(orderRef)`),
its `status !== 'reserved'` idempotency guard and its two-document write are all correct and must
not be touched — they are what payfast-m1 A30/A31 proves. The defect is entirely in how `orderRef`
is *obtained*.

### Measured vs inferred — do not blur these

**Measured** (@qa, 5 runs, recorded in the mission checkpoint): every spurious A18 green logged
`order-not-found`. `order-not-found` is a `MarkOrderPaidOutcome` reason surfaced by the route's
step-10 log, **not** the step-5 "No order found for reference" line. So query 1 found the order and
query 2 did not, on the same document, in the same request.

**Inferred, and NOT yet measured:** the mechanism. The leading hypothesis is index-entry freshness
for a document written milliseconds earlier — the fixture writes the order, query 1 sees it, query 2
misses it. @dev's **first** task is to measure this, not to assume it. If measurement shows query 2
missing a document written *seconds* rather than milliseconds earlier, the production exposure is
materially larger than assessed below and this spec must come back to @architect.

Two candidates already **excluded**: the `tickets.where('orderId', ...)` query (its miss yields
`position-not-found`, a different reason code, and that is not what was logged), and a fixture field
mismatch (`buildReservationDocs` writes `m_payment_id` on both documents — verified at
`lib/checkout-reservation.ts:61,77` — so a miss would be total, not intermittent).

## 2. How it manifests

- **In the check suite (observed, and the reason this is blocking):** one flake, *two* polarities.
  A18 passed spuriously (the ticket stayed `reserved` because the write failed, which A18 read as
  "the IP gate rejected"); A19/A21 fail spuriously on the same mechanism. A suite that is a coin
  toss in both directions cannot be evidence for anything, and F3's live purchase must not be
  judged against it.
- **In production (assessed, not observed):** the window between reserving and the notification is
  minutes, not milliseconds, so the exposure is much smaller — but it is not zero, and the failure
  is severe and silent: the order stays `reserved`, the buyer is charged, no ticket is issued, and
  the route returns 200 so the gateway never retries. The existing net is
  `POST /api/admin/reconcile-orders`, which alerts on orders stranded `reserved` past expiry — i.e.
  detection is manual and after the fact.
- **Diagnosis is currently ambiguous by construction.** `order-not-found` is returned from two
  structurally different places — the pre-transaction query miss (`lib/orders.ts:275`) and the
  in-transaction `!orderDoc.exists`. One reason code, two causes; the log cannot tell an operator
  which fired. That ambiguity is part of why the A18 diagnosis took five runs.

## 3. What the fix must guarantee

**Recommended: C + A. Explicitly NOT B.**

**C — remove the redundant query (production, `lib/orders.ts`).**
`findReservedOrderByPaymentId` returns the located order's document id in its `'reserved'` result.
The route passes it to `markOrderAndPositionPaidByPaymentId`, which resolves the ref **by id**
(`orders.doc(id)`) instead of re-querying. A direct ref read is not index-dependent, so the
two-reads-disagree condition cannot arise for the order. The query survives only as a fallback for
callers that supply no id.
*Guarantee:* for a given notification the orders index is read **at most once**, and the ref the
transaction operates on is the same document query 1 found. Strictly less work, not more.

**A — make the fixture deterministic (test harness, `contracts/checks/payfast-m1/_itn-harness.mts`).**
`createOrderAndPosition` must not return until **both** queries the route will make
(`orders.where('m_payment_id')` and `tickets.where('orderId')`) are satisfiable, bounded (~5s), and
must fail **loudly** on timeout with a distinct `PRECONDITION:` message. C alone does not cover
`tickets.where('orderId')`, which is the next coin toss in waiting.
*Guarantee:* a suite failure is attributable to the route, never to fixture freshness — and if it
ever is fixture freshness, it says so instead of being read as a route defect.

**B — REJECTED, recorded so it is not reintroduced:** a bounded retry inside
`markOrderAndPositionPaidByPaymentId`. It adds latency to every genuinely-not-found notification
(including junk and hostile deliveries — cheap amplification), it *masks* the nondeterminism rather
than removing it, and it is a production change made to accommodate a test fixture. C removes the
same failure by deleting work rather than adding it.

**D — land at the same time (cheap, independent):** split the two `order-not-found` sites into
distinct reasons — the query miss stays `order-not-found`; the in-transaction
`!orderDoc.exists` becomes `order-vanished` (it existed at query time and was gone inside the
transaction, which is a genuinely different and much more alarming event). This is a
`MarkOrderPaidOutcome` union change, so `pnpm type-check` will enumerate every consumer.

**Out of scope:** the transaction body, the idempotency guard, the two-document write, the route's
step ordering, and anything under `lib/payments/`.

## 4. Assertions that would catch a regression

All four are **offline and deterministic** — `markOrderAndPositionPaidByPaymentId` already accepts
`deps.db`, and @architect verified on 2026-08-19 that a plain in-memory fake drives the real
function end to end with no Firestore and no network (that injection point is how the A30/A31 sweep
finding below was proved). There is no excuse for making any of these live-only.

- **R2 — the one that must be OBSERVED RED FIRST.** Fake db configured to reproduce the exact
  observed condition: `orders.where(...)` returns **empty** while the document is present **by ref**.
  Against today's code this returns `{ committed: false, reason: 'order-not-found' }`; after the fix
  it must commit. This reproduces the production failure deterministically, with no Firestore, and
  is the regression test proper.
- **R1 — the redundant read cannot come back.** Same fake db, counting calls. When the caller
  supplies an order id, `orders.where(...)` must be called **zero** times and the ref read exactly
  once. Asserts the property (one index read per notification), not the shape.
- **R3 — the fixture fails loudly, not silently.** Point `createOrderAndPosition` at a stub whose
  queries never become non-empty; require a non-zero exit carrying the distinct `PRECONDITION:`
  message. A fixture that gives up quietly and lets the route report `order-not-found` is how this
  defect stayed misattributed for five runs.
- **R4 — the two causes are distinguishable.** Drive both paths through the fake db (query miss vs
  document deleted between query and transaction) and require **different** reason values.
  Behavioural, via the returned outcome — not a grep for the string.

Standing rule, restated because it is what this whole item is about: each of R1–R4 must be seen
**red against unfixed code with the exit code recorded** before it is trusted. R2 red today is the
proof that the diagnosis in §1 is right; if R2 comes back **green** against unfixed code, stop —
the mechanism is not what §1 says it is, and that result is worth more than a finished fix.
