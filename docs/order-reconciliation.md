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
our own side. Nothing in this codebase previously noticed. This risk is real and this feature's
detection/alert mechanism is real and correctly shipped — but the four order ids originally cited
as evidence of it (`SAOC-2027-5KYDSBMT38KX`, `SAOC-2027-R06HZ12P06EY`, `SAOC-2027-G08QJQK278NY`,
`SAOC-2027-7HHE9QN51RH4`) are **E2E test fixtures** (`buyerEmail: e2e-test@example.com`),
confirmed directly in live Firestore 2026-08-19, not real customer orders — the original P1
backlog entry ("Stranded 'reserved' orders after a failed ITN") overstated this as a confirmed
live-customer incident, and has been corrected. See
`.agent/memory/project/specs/ticketing-capacity-reconciliation-hold/WITHDRAWN.md` for the full
correction and why it matters: the sibling seat-hold feature that assumed these were real
paid-but-stranded orders was withdrawn as a result.

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

## reconciliationAlertedAt on positions

`markOrdersAlerted` writes `reconciliationAlertedAt` onto every `tickets/{id}` position sharing
an alerted order's `orderId`, not just the order document — added for, and gated by, this
contract's own A3/A4 (per-order atomic `WriteBatch`, see
[above](#why-the-alert-stamp-is-one-atomic-writebatch-per-order)). **DELIBERATELY WRITTEN BUT
CURRENTLY UNREAD.** It was originally the substrate for a companion feature
(`ticketing-capacity-reconciliation-hold`) that would have made `stillHoldsSeat`
(`lib/data/tickets.ts`) hold a seat once its position carried this stamp. That feature was
withdrawn 2026-08-19 before shipping — @qa found no field this system records can distinguish a
genuinely-paid, ITN-failed order from an ordinary abandoned cart (`gatewayPaymentId`/
`pf_payment_id` are only ever written in the same transaction that flips `status` to `'paid'`,
so a `reserved` document structurally cannot carry one either way), so using this stamp as a
seat-hold trigger would have permanently stranded a seat for every abandoned cart, not just the
rare genuine ITN failure. See
`.agent/memory/project/specs/ticketing-capacity-reconciliation-hold/WITHDRAWN.md` for the full
reasoning. **`stillHoldsSeat` does not read this field.** The write itself was kept — it remains
a legitimate, disclosed, atomically-correct per-position record that a human was alerted about
that seat, and is the natural substrate for a future, human-gated manual-settle admin action
(proposed to Brad, not built). If you are reading this because you're about to remove the write
as apparently-dead code: it isn't — read WITHDRAWN.md's "For the next reader" first.

## Response shape: `alertedNow` vs. `alertBookkeepingFailed`

Fixed by `reconcile-response-accuracy` F1 (`.agent/memory/project/specs/reconcile-response-accuracy/`),
which closes a defect that shipped with the original feature (see "Known open items, resolved"
below for what the bug used to be).

The route's success path (`needingAlert.length > 0`) returns:

```json
{
  "alertedNow": ["SAOC-2027-..."],
  "alertBookkeepingFailed": [],
  "skippedRecentlyAlerted": ["SAOC-2027-..."],
  "strandedCount": 4
}
```

- **`alertedNow`** — order ids whose `reconciliationAlertedAt` stamp is *proven* to have
  committed (order doc + every one of its position docs, atomically — see
  [above](#why-the-alert-stamp-is-one-atomic-writebatch-per-order)). It no longer means "the
  route attempted to alert this order"; it means the write landed.
- **`alertBookkeepingFailed`** — order ids whose stamp write failed to commit, even though the
  alert email for them already sent successfully. **Always present in the body, even when
  empty** (`[]` on full success) — never omitted. This is deliberate: an omitted field is itself
  an ambiguous response a caller would have to special-case, on top of the field it's meant to
  disambiguate.

Both fields are computed by `markOrdersAlertedForResponse` (`lib/reconciliation.ts`), which
wraps `markOrdersAlerted` and splits its outcome structurally off `MarkOrdersAlertedError`'s
`failedOrderIds` — never by regex-parsing the error's free-text `.message`. Any thrown value
`markOrdersAlertedForResponse` doesn't recognize (i.e. not a `MarkOrdersAlertedError`) hits a
**conservative fallback**: `alertedNow` is empty and every attempted id is reported in
`alertBookkeepingFailed`. An unrecognized failure is never read as "probably fine" — full
per-scenario proof is in
`.agent/memory/project/specs/reconcile-response-accuracy/goldens/check-response-splits-partial-failure.mjs`.

`reconcileStatusFor` (`lib/reconciliation.ts`) maps the result to an HTTP status:

| Condition | Status |
|---|---|
| `sendReconciliationAlert` itself throws (no alert sent at all) | 502, unchanged from before this fix |
| Alert sent; every order's stamp committed | 200, `alertBookkeepingFailed: []` |
| Alert sent; ≥1 order's stamp failed to commit | **207 Multi-Status** |

### MUST READ before wiring this into Cloud Scheduler or any monitoring integration

**JavaScript `fetch`'s `res.ok` is `true` for the entire 200-299 range, which includes 207.**
Any cron wrapper, on-call check, or dashboard that only checks `res.ok` (or an equivalent
"2xx = success" shortcut in another HTTP client) will silently treat a 207
partial-bookkeeping-failure run exactly like a clean 200 — reintroducing the same blindness this
fix exists to close, just one layer further up the stack. **Any real integration of this
endpoint MUST parse the response body's `alertBookkeepingFailed` array and treat a nonempty
array as needing attention, regardless of what the HTTP status class says.** 207 is still the
correct status to send — it's honest, and it lets stricter monitoring that inspects the exact
code distinguish this case from 200 — but it is not sufficient on its own for a caller that only
checks `res.ok`. See "Infra: Cloud Scheduler wiring" below — whoever wires the real job must
implement the body check, not just alert on non-2xx.

### `MarkOrdersAlertedError.message` is a load-bearing string — do not edit casually

`MarkOrdersAlertedError` (`lib/reconciliation.ts`) is deliberately byte-identical, in its
`.message` text, to the plain `Error` it replaced. This is not incidental: `order-reconciliation`'s
own shipped check, `check-partial-failure-atomicity.mjs`, asserts on that exact message text
(`String(thrown.message).includes(FAILING_ORDER_ID)`). If you edit the wording of that message,
you will break that check in the sibling `order-reconciliation` contract, not this one — the two
features share this one string as an accidental interface. Structured data (which order ids
failed) belongs on `MarkOrdersAlertedError.failedOrderIds`, not parsed from the message; only the
message *text itself* is the coupling to watch.

### Known inconsistency, decision already made, not yet implemented

The `needingAlert.length === 0` early return in `route.ts` (no stranded orders currently need
alerting) returns `{ alertedNow: [], skippedRecentlyAlerted, strandedCount }` **without** an
`alertBookkeepingFailed` field — `markOrdersAlertedForResponse` is never called on that path, so
there's nothing to report yet. This isn't a contract violation, but it breaks the "always
present, never omitted" shape the rest of this section establishes, and a caller doing a blind
`body.alertBookkeepingFailed.length` lookup needs a defensive `?? []` for this one branch only.

**Decision (recorded in `.agent/memory/project/specs/reconcile-response-accuracy/goldens/README.md`
§3a): add `alertBookkeepingFailed: []` to that branch too**, for response-shape uniformity — this
is the one branch where "nothing failed" is unambiguously, trivially true (no write was even
attempted). Not yet applied to `route.ts`; that pass was scoped to "check script and golden
only." Flagging here for whoever next edits `route.ts`.

## Known open items

- **Four stranded positions predate this feature and are not resolved by it.** This feature
  alerts on `SAOC-2027-5KYDSBMT38KX`, `SAOC-2027-7HHE9QN51RH4`, `SAOC-2027-G08QJQK278NY`, and
  `SAOC-2027-R06HZ12P06EY` — E2E test fixtures (see "The problem this solves" above), not real
  customer orders, but the same four positions
  [docs/ticketing-position-expiry-write.md](ticketing-position-expiry-write.md#known-open-item-four-stranded-positions-still-need-a-backfill)
  documents as still holding their seats indefinitely under the real mechanism this bug class
  describes. Alerting is not backfilling: these four need a separate, deliberate resolution
  (backfill `expiresAt`, delete the fixtures, or another decision) by a human, not an automated
  write from either feature.

### Resolved: `alertedNow` used to report attempted ids, not proven-committed ids

Previously, `app/api/admin/reconcile-orders/route.ts` reported every order id it *attempted* to
alert in `alertedNow`, regardless of whether the `reconciliationAlertedAt` write actually
committed — a caller could not distinguish "alerted all four" from "alerted none, all four
threw," both rendered as a success-shaped body. Fixed by `reconcile-response-accuracy` F1; see
"Response shape" above for the current behavior and the caller warning that goes with it.

## Files changed

- `lib/reconciliation.ts` — `findStrandedOrders`, `filterOrdersNeedingAlert`,
  `markOrdersAlerted`, `sendReconciliationAlert`, and (added by `reconcile-response-accuracy` F1)
  `MarkOrdersAlertedError`, `markOrdersAlertedForResponse`, `reconcileStatusFor`
- `app/api/admin/reconcile-orders/route.ts` — auth, wiring, response shape
- `emails/ReconciliationAlert.tsx` — the alert email template
- `firestore.indexes.json` — composite index on `orders(status, expiresAt)`
- `firebase.json` — added the `firestore` key pointing at `firestore.indexes.json`

## Sources

- `.agent/memory/project/specs/order-reconciliation/contract-f1.yaml` — the scored contract,
  all 5 assertions
- `.agent/memory/project/specs/order-reconciliation/goldens/README.md` — full design record,
  the recovery scope decision, the A3/A4 dynamic-vs-leashed distinction, and the manual
  verification steps
- `.agent/memory/project/specs/reconcile-response-accuracy/contract-f1.yaml` — the response-shape
  fix contract
- `.agent/memory/project/specs/reconcile-response-accuracy/goldens/README.md` — full design
  record for the response-shape fix, including the §3a decided-but-not-yet-implemented item and
  the Codex/`@qa`-raised caller warning
- `.agent/memory/project/backlog.md` — "P1 — Stranded 'reserved' orders after a failed ITN"
