# order-reconciliation — F1 goldens

Design record for the P1 backlog item "Stranded 'reserved' orders after a failed ITN: no
reconciliation, no alert" (`.agent/memory/project/backlog.md`). See
`.agent/memory/project/specs/order-reconciliation/contract-f1.yaml` for the scored contract.

## Scope decided here (Phase 1 — this contract)

**Detect + alert a human. Never auto-settle.**

1. **Detection**: `findStrandedOrders(now, deps?)` (new, `lib/reconciliation.ts`) queries
   `orders` for `status == 'reserved' AND expiresAt < now`. That is necessary but was NOT
   assumed sufficient on its own — an abandoned mid-checkout cart also matches "reserved", and
   is completely benign. The `expiresAt < now` half of the query is exactly what separates the
   two: a live checkout's `expiresAt` is still in the future. `check-detects-stranded-orders.mjs`
   (A2) proves both halves of that filter independently, with a paid-order-with-stale-expiry
   negative control too.

2. **Recovery — deliberately NOT built in this contract.** The mission brief asks whether
   reconciliation should ask PayFast about each stranded order rather than guessing from local
   state, and whether to auto-settle a gateway-confirmed order. Investigated and rejected for
   Phase 1:
   - The ITN handler's only tested PayFast round trip (`/eng/query/validate`,
     `app/api/tickets/itn/route.ts` step 4) requires the **exact ITN field set PayFast itself
     posted**, replayed back with a matching signature. It cannot be used to ask "was
     `m_payment_id X` ever paid?" for an order that never received an ITN at all —
     `G08QJQK278NY`, one of the three real stranded orders, is exactly that case. There is no
     `pf_payment_id` on file to query with either.
   - PayFast does publish a separate merchant "Transaction Query" API
     (`api.payfast.co.za`, header-based `merchant-id`/`version`/`timestamp`/`signature` auth —
     a genuinely different signing scheme from the passphrase-in-body one this codebase already
     has tested) that CAN look up a transaction, but only by `pf_payment_id`, and this codebase
     has never called it, tested it, or been issued credentials scoped for it.
   - Building an untested new external-payment-API integration inside a job that would then
     auto-write `status: 'paid'` from that response is exactly the risk profile this project's
     "secret corruption defect class" and "contract checks mutate live content" incidents
     warn about — a new, unverified trust boundary feeding a money-state write, shipped under
     one dev/QA pass. **Recommendation to Brad**: treat "verify + wire the PayFast transaction
     query API" as an explicit follow-on feature, gated on confirming the exact auth scheme and
     obtaining scoped credentials, BEFORE any auto-settle path is attempted. This contract
     ships flag-only reconciliation now, which is strictly safer than shipping nothing, and does
     not foreclose auto-settle later.
   - Structurally enforced, not just documented: `app/api/admin/reconcile-orders/route.ts`
     never imports `markOrderAndPositionPaidByPaymentId` (the only function in this codebase
     that can flip `status` to `'paid'`) or `pf_payment_id`/PayFast HTTP calls of any kind.
     `check-live-detect-and-mark.mjs` (A4) asserts `status`/`amount`/`gatewayPaymentId`/
     `purchasedAt` are unchanged after a real live run against the three known stranded orders.

3. **Alerting**: `sendReconciliationAlert()` (new, reuses `lib/email.ts`'s `sendEmail` +
   `resolveReplyTo()`) sends ONE real email, to a real recipient
   (`RECONCILIATION_ALERT_EMAIL` env var, default `info@saoc.co.za` — same default as
   `resolveReplyTo()`), listing every order that needs an alert. This directly answers the
   "alerts go to a log nobody reads" problem named in project memory
   (`feedback_...` / session notes) — the alert is an email in an inbox, not a `console.error`
   line.

4. **Where it runs**: a Next.js API route (`app/api/admin/reconcile-orders/route.ts`), NOT a
   Firebase Function. `functions/` is already known to interact badly with the Next.js build
   (excluded in `tsconfig.json`) — see `functions/src/index.ts`'s self-signup guard for the one
   thing that's forced to live there (an Auth trigger, which a Next.js route cannot be). A
   reconciliation job has no such constraint, so it belongs where the rest of the
   Firestore-Admin-SDK route handlers already live (`app/api/tickets/itn/route.ts` is the
   closest sibling in shape). Cloud Scheduler triggers it on a cadence (e.g. hourly) with a
   static bearer secret (`RECONCILIATION_CRON_SECRET`) in the `Authorization` header — same
   fail-closed-on-missing-secret posture as the ITN route's passphrase guard. Wiring the actual
   Cloud Scheduler job is an infra step for whoever deploys this, documented by @docs, not
   something a contract assertion can observe from inside this repo.

5. **Idempotency**: `reconciliationAlertedAt` (new field, `orders/{orderId}`) is set only AFTER
   a real alert email successfully sends (never before — if the send throws, nothing is marked,
   so the next run retries rather than silently marking-without-sending).
   `filterOrdersNeedingAlert(orders, now)` excludes any order alerted within
   `RE_ALERT_WINDOW_MS` of `now`, so back-to-back runs (e.g. every hour) don't spam one email
   per run for the same still-broken order — but an order alerted once and never fixed
   surfaces AGAIN once the window elapses, rather than being silenced forever after the first
   email. `check-detects-stranded-orders.mjs` (A2) proves both the exclusion and the
   re-inclusion halves against a fake store; `check-live-detect-and-mark.mjs` (A4) proves the
   exclusion half against real Firestore with a real write.

## A4 mutates live Firestore — on purpose, on a leash

`check-live-detect-and-mark.mjs` (A4) is the one script in this contract permitted to write to
live Firestore. That is a deliberate, disclosed exception, not an oversight — reviewed against
this project's own `contract_checks_mutate_live_content` incident memory (a prior contract
check's sentinel corruption sat on the deployed site for three days before anyone noticed,
because the write wasn't leashed and the residue alert went to a log nobody read).

The design that makes this acceptable:

- **Detection runs the real, unrestricted query.** `findStrandedOrders()` is called with no
  filtering — this is the only way to actually prove the query's WHERE conditions are correct
  against whatever the live dataset contains. If it surfaces stranded orders beyond the three
  known ones, that's logged as informational only; nothing is done with them.
- **The write is leashed to a hardcoded, 3-order allowlist.** `ALLOWED_ORDER_IDS` is built
  solely from resolving the hardcoded `KNOWN_BOOKING_REFS` (`5KYDSBMT38KX`, `R06HZ12P06EY`,
  `G08QJQK278NY`) — never from `findStrandedOrders()`'s own output. `assertAllowlistedForWrite()`
  runs immediately before the one `markOrdersAlerted()` call and HARD-FAILS the entire script
  (a real assertion failure, not a warning) if it is ever asked to write an id outside that
  list. This means a future edit to the filtering logic upstream of the write — a bug, a
  refactor, an accidental loosening — cannot silently widen the blast radius; the guard sits
  between "computed what to write" and "actually writing" regardless of how that computation
  changed.
- **The field itself is additive and disclosed.** `reconciliationAlertedAt` is exactly the field
  this feature is supposed to write in production once shipped, on exactly the kind of order
  it's supposed to write it on — this is not fixture data leaking into a field a real page
  trusts, which is what made the prior incident dangerous.
- **The three target orders are real known sandbox test data** ("Thabo E2E Test" — see
  backlog.md), not live customer records, and money-state fields are asserted unchanged in the
  same run.

**Do not widen `ALLOWED_ORDER_IDS` or remove `assertAllowlistedForWrite()` without re-reading
this section.** If this contract is ever extended to run against a dataset where the three
known refs no longer exist, the correct fix is to update `KNOWN_BOOKING_REFS` /
`ALLOWED_ORDER_IDS` explicitly and deliberately — never to relax the guard itself.

## Why the automated gate never sends a real email

`check-live-detect-and-mark.mjs` (A4) calls `findStrandedOrders` / `filterOrdersNeedingAlert` /
`markOrdersAlerted` directly against live Firestore (proving detection and the idempotent
bookkeeping write against the three real stranded orders), but never calls
`sendReconciliationAlert` / `lib/email.ts` / Resend. An automated contract gate that can be
re-run at any time must never have a side effect whose correctness depends on how many times it
happened to run — a live email landing in a real inbox on every gate re-run would either spam
`info@saoc.co.za` or (if suppressed) leave the actual send path unproven. This mirrors the F8
comp-tickets contract's own precedent
(`contracts/checks/ticketing-f8-comp-tickets/check-http-comp-fails-closed.sh`'s header comment):
the positive, fully-live, real-credential HTTP path is deferred to a human-run manual step, not
because it's unimportant, but because only a human can judge "yes, send this real email now."

## Manual verification step (not gated — run once, by a human, after @dev's implementation)

1. Deploy to the dev Firebase App Hosting backend (standing deploy authorization —
   see project memory).
2. Set `RECONCILIATION_CRON_SECRET` in the deployed environment's secrets.
3. `curl -X POST -H "Authorization: Bearer $RECONCILIATION_CRON_SECRET" https://<dev-host>/api/admin/reconcile-orders`
4. Confirm one email arrives at the configured recipient, listing the three known stranded
   orders (or fewer, if `reconciliationAlertedAt` was already set by A4's most recent run and
   the re-alert window hasn't elapsed — check the response JSON's `skippedRecentlyAlerted`).
5. Run the same `curl` again immediately — confirm the response JSON shows `alertedNow: []` and
   the just-alerted order IDs in `skippedRecentlyAlerted` (no second email).
6. Re-run `verify_stranded_orders_live.py` (A3) — the three orders must still show
   `status == 'reserved'` (never auto-settled).

## Files in this directory

- `check-detects-stranded-orders.mjs` (A2) — fake-store unit proof of the detection + re-alert
  filter logic.
- `verify_stranded_orders_live.py` (A3) — read-only, confirms the three real stranded orders
  match the query's exact WHERE conditions against live, production-shaped Firestore data.
- `check-live-detect-and-mark.mjs` (A4) — the one script permitted to write to live Firestore;
  writes only `reconciliationAlertedAt`; proves idempotency and the no-money-state-mutation
  guarantee against the three real orders.
- `check-route-auth-fails-closed.sh` (A5) — real HTTP against a real, credential-scrubbed
  Next.js server; proves the route fails closed with 401 before it could reach Firestore or
  Resend.
