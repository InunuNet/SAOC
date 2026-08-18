# Order Reconciliation

**Contract:** `.agent/memory/project/specs/order-reconciliation/contract-f1.yaml` (5
assertions). Gated green, and passed an independent Codex GPT-5.5 cross-model review in
addition to `@qa` — that review is what changed the alert-bookkeeping write from two
independent writes to one atomic per-order `WriteBatch` (see
[Why the alert stamp is one atomic WriteBatch](#why-the-alert-stamp-is-one-atomic-writebatch-per-order)
below).

This document covers `lib/reconciliation.ts`, `app/api/admin/reconcile-orders/route.ts`,
`emails/ReconciliationAlert.tsx`, and `firestore.indexes.json`. It assumes familiarity with the
order/position model in [docs/ticketing.md](ticketing.md) and the seat-release mechanics fixed
in [docs/ticketing-position-expiry-write.md](ticketing-position-expiry-write.md) — read that
first, since this feature depends on it (see [Sequencing](#sequencing-depends-on-ticketing-position-expiry-write)).

---

## The problem this solves

An order can get stuck `status: 'reserved'` forever if the PayFast ITN that's supposed to settle
it never arrives — a deploy window, a PayFast outage, a signature/passphrase change, or a 500 on
our own side. Nothing in this codebase previously noticed. Three real production orders
(`SAOC-2027-5KYDSBMT38KX`, `SAOC-2027-R06HZ12P06EY`, `SAOC-2027-G08QJQK278NY`) were found stuck
this way only because a human happened to stumble onto them — see the P1 backlog entry "Stranded
'reserved' orders after a failed ITN". A fourth (`SAOC-2027-7HHE9QN51RH4`) turned up during this
feature's own live verification.

## What this feature does — and deliberately does not do

`POST /api/admin/reconcile-orders`, Cloud Scheduler-triggered (e.g. hourly):

1. Queries `orders` for `status == 'reserved' AND expiresAt < now` (`findStrandedOrders`).
2. Filters out anything already alerted within the last 6 hours (`RE_ALERT_WINDOW_MS`,
   `filterOrdersNeedingAlert`) — so back-to-back runs don't spam one email per run for the same
   still-broken order. An order alerted once and never fixed surfaces again once the window
   elapses; it is a recurring reminder, not a one-shot silence.
3. Sends **one real email** via Resend (`sendReconciliationAlert`, reusing `lib/email.ts`) to a
   human, listing every order that needs review.
4. Only after that send succeeds, stamps `reconciliationAlertedAt` on the order and every one of
   its positions (`markOrdersAlerted`).

**It flags only. It never settles, cancels, or touches any payment/status field.** The route's
write scope is strictly the `reconciliationAlertedAt` field — `status`, `amount`,
`gatewayPaymentId`, and `purchasedAt` are never written by anything in this feature. This is
structurally enforced, not just a convention: `lib/reconciliation.ts` and the route never import
`markOrderAndPositionPaidByPaymentId` (the only function in this codebase that can flip an
order's `status` to `'paid'`) and make no PayFast HTTP call of any kind.

**Why not auto-settle a gateway-confirmed order?** Investigated and explicitly rejected for this
phase — see the golden README's "Recovery — deliberately NOT built in this contract" for the
full reasoning. In short: the ITN handler's PayFast round trip requires the exact ITN field set
PayFast itself posted, which doesn't exist for an order (like `G08QJQK278NY`) that never
received an ITN at all. PayFast's separate merchant Transaction Query API could answer that, but
this codebase has never called it, tested it, or been issued credentials scoped for it — building
an untested new external-payment integration that then auto-writes a money-state field is exactly
the risk profile this project's secret-corruption and fixture-leak incidents warn against.
**Recommendation on record for Brad**: treat "verify + wire the PayFast transaction query API"
as an explicit follow-on feature, gated on confirming its auth scheme and obtaining scoped
credentials, before any auto-settle path is attempted.

## Why the alert stamp is one atomic WriteBatch per order

`markOrdersAlerted` (`lib/reconciliation.ts`) originally wrote the order's stamp and each of its
positions' stamps as independent writes. Codex GPT-5.5's cross-model review flagged this: a
half-landed write (order stamp lands, a position stamp throws) suppresses re-alerting on that
order for the full 6-hour `RE_ALERT_WINDOW_MS`, while the un-stamped position — read by
`stillHoldsSeat` in `lib/data/tickets.ts`, which reads the `tickets` collection, not `orders` —
releases its seat anyway. That's a silent oversell: a stranded-but-still-possibly-paid buyer's
seat gets resold, and the one signal that would have surfaced the problem is suppressed for six
hours.

The fix: every order's stamp and every one of its positions' stamps commit as a single
`WriteBatch` — all or none. Failure is isolated **per order**, not across the whole call: each
order gets its own batch, all committed via `Promise.allSettled`, so one order's batch failing
never blocks or corrupts another's, and every failed order is named individually in the
aggregated error the route logs.

Batching (not a transaction) is deliberate: the position query happens once, up front, outside
the atomic unit. A position created between that read and the batch commit is a race the *next*
reconciliation run picks up — not a partial-write hazard, since nothing inside the batch depends
on a read happening inside it.

## Design constraints — deliberate, not incidental

- **Per-order isolation.** `Promise.allSettled`, not `Promise.all` — a bare `Promise.all` only
  ever surfaces the *first* rejection reason, so a second or third order's failure could go
  unnoticed. `allSettled` lets every order's batch run to completion independently; every
  failure is named by order id in the thrown aggregate error.
- **Fails closed on a missing secret, before parsing any header.** `POST
  /api/admin/reconcile-orders` checks `process.env.RECONCILIATION_CRON_SECRET` first — an unset
  secret is treated as "reject", never as "no auth required", same posture as the ITN route's
  passphrase guard. The provided bearer token is then compared with
  `crypto.timingSafeEqual` (via `constantTimeEqual` in `lib/recovery-token.ts`), not `===`.
- **Requires a deployed Firestore composite index.** The detection query
  (`status == 'reserved'` + `expiresAt < now`) is a composite query and needs an index on
  `orders(status, expiresAt)`. `firebase.json` had no `firestore` key at all before this
  feature — `firestore.indexes.json` was added and wired in, and deployed to `saoc-webapp`
  under the project's standing deploy authorization. Without it, the query fails with
  `FAILED_PRECONDITION`, not a defect in `findStrandedOrders` itself.

## Sequencing: depends on ticketing-position-expiry-write

This feature's own negative control — "an expired-but-unalerted reservation must still release
its seat, and an alerted-but-not-yet-6-hours-old one must not" — is what surfaced
`ticketing-position-expiry-write`'s bug in the first place: every reserved position was already
holding its seat forever, regardless of alert status, because positions never carried
`expiresAt` at all. That fix shipped first; this feature's alert-stamp write on positions
(`reconciliationAlertedAt`) only has an observable effect in production because `stillHoldsSeat`
can now read a real `expiresAt` off the position to compare against.

## Verification

- **A1** (`pnpm exec next build`) — compiles.
- **A2** — `findStrandedOrders`/`filterOrdersNeedingAlert` against a fake, in-memory
  Firestore-shaped store: detects a reserved+expired order; does **not** detect a
  reserved-but-not-yet-expired order (an ordinary in-progress checkout — the negative control
  that proves this isn't just "every reserved order"); does not detect a paid order with a stale
  old `expiresAt`; excludes an order alerted moments ago; re-includes one alerted long enough ago.
- **A3** — read-only, against real Firestore: dynamically discovers stranded orders by running
  the actual composite query (no hardcoded ref list, so it can't go stale — a prior version
  hardcoded three refs transcribed from the backlog with the `SAOC-2027-` prefix accidentally
  dropped, which failed on a stale fixture rather than a real defect), then asserts every
  returned document genuinely has `status == 'reserved'` and `expiresAt` strictly before the
  query's own `now`.
- **A4** — against real Firestore: proves detection finds the four known stranded orders,
  `markOrdersAlerted` writes `reconciliationAlertedAt`, a second run correctly skips them
  (idempotency), and `status`/`amount`/`gatewayPaymentId`/`purchasedAt` are unchanged before and
  after — the assertion that directly proves the "never auto-settle" scope decision, not just
  states it. The write half is leashed to a hardcoded 4-order allowlist
  (`assertAllowlistedForWrite`), which hard-fails the check outright rather than writing to any
  id outside it — see the golden README's "A3 is dynamic; A4's write leash is not (on purpose)"
  for why a manually-maintained allowlist is the correct tradeoff for the one script in this
  contract permitted to mutate live data.
- **A5** — real HTTP against a real, running server with every relevant secret (including
  `RECONCILIATION_CRON_SECRET`) scrubbed from the environment: no `Authorization` header, and a
  wrong bearer secret, both get a real 401 from the route's own JSON body (not a framework
  fallback page) — proof the request reached the real handler and the handler refused before
  touching Firestore or Resend.

No automated check ever sends a real email — see the golden README's "Why the automated gate
never sends a real email" for why that's deliberate (a re-runnable gate cannot depend on how
many times it happens to run). Manual verification (deploy, set the secret, curl the route twice,
confirm one email and no duplicate) is documented step-by-step there.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `RECONCILIATION_CRON_SECRET` | Yes | Bearer secret Cloud Scheduler sends as `Authorization: Bearer <value>`. Missing/empty fails closed (401) — see `.env.local.example`. |
| `RECONCILIATION_ALERT_EMAIL` | No | Alert recipient. Defaults to `info@saoc.co.za` (same default as `lib/email.ts`'s `resolveReplyTo()`) if unset. |

## Infra: Cloud Scheduler wiring

This runs as a Next.js API route, not a Firebase Function — `functions/` is already known to
interact badly with the Next.js build (excluded in `tsconfig.json`; see
`functions/src/index.ts`'s self-signup guard for the one thing forced to live there instead).
Wiring the actual Cloud Scheduler job (target URL, cadence — e.g. hourly, the `Authorization`
header with the cron secret) is an infra step for whoever deploys this; it isn't something a
contract assertion can observe from inside this repo.

## Known open items

- **Four stranded positions predate this feature and are not resolved by it.** This feature
  alerts on `SAOC-2027-5KYDSBMT38KX`, `SAOC-2027-7HHE9QN51RH4`, `SAOC-2027-G08QJQK278NY`, and
  `SAOC-2027-R06HZ12P06EY` — the same four positions
  [docs/ticketing-position-expiry-write.md](ticketing-position-expiry-write.md#known-open-item-four-stranded-positions-still-need-a-backfill)
  documents as still holding their seats indefinitely. Alerting is not backfilling: these four
  need a separate, deliberate resolution (backfill `expiresAt`, or another decision) by a human,
  not an automated write from either feature.
- **`app/api/admin/reconcile-orders/route.ts` reports all attempted order ids in `alertedNow`
  even when the bookkeeping write partially failed.** The route sends the alert email first,
  then calls `markOrdersAlerted`. If that write throws (logged, not fatal — see the route's own
  comment), the response still returns every order id that was *attempted* under `alertedNow`,
  not only the ones whose `reconciliationAlertedAt` stamp actually landed. The rationale in the
  code is that a duplicate alert email next run is far preferable to a silently-dropped one — but
  it means `alertedNow` in the response JSON is not, on its own, proof that the Firestore write
  succeeded for every id it lists. A caller that needs that guarantee should re-check
  `reconciliationAlertedAt` directly rather than trusting the response body alone.

## Files changed

- `lib/reconciliation.ts` — new; `findStrandedOrders`, `filterOrdersNeedingAlert`,
  `markOrdersAlerted`, `sendReconciliationAlert`
- `app/api/admin/reconcile-orders/route.ts` — new; auth, wiring, response shape
- `emails/ReconciliationAlert.tsx` — new; the alert email template
- `firestore.indexes.json` — new; composite index on `orders(status, expiresAt)`
- `firebase.json` — added the `firestore` key pointing at `firestore.indexes.json`

## Sources

- `.agent/memory/project/specs/order-reconciliation/contract-f1.yaml` — the scored contract,
  all 5 assertions
- `.agent/memory/project/specs/order-reconciliation/goldens/README.md` — full design record,
  the recovery scope decision, the A3/A4 dynamic-vs-leashed distinction, and the manual
  verification steps
- `.agent/memory/project/backlog.md` — "P1 — Stranded 'reserved' orders after a failed ITN"
