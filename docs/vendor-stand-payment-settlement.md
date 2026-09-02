# Vendor stand-payment settlement — the ITN handler end to end

**Code:** `lib/vendor-stand-payment-notification.ts` (shared handler, called by the thin
per-gateway `payfast-itn`/`ozow-itn` routes — mirrors `lib/tickets-notification.ts`'s own
shared-handler-plus-thin-routes shape). Vendor-facing receipt: `lib/vendor-payment-confirmation.ts`
+ `emails/VendorPaymentConfirmation.tsx`.

**Contracts:**
- [`contracts/contract-vendor-stand-payment-confirm-gate.yaml`](../contracts/contract-vendor-stand-payment-confirm-gate.yaml)
  (A1-A14) — settlement hardening (F1-F8). Golden: [`contracts/golden/vendor-stand-payment-confirm-gate/README.md`](../contracts/golden/vendor-stand-payment-confirm-gate/README.md).
- [`contracts/contract-vendor-payment-confirmation.yaml`](../contracts/contract-vendor-payment-confirmation.yaml)
  (A1-A8) — the vendor receipt email. Golden: [`contracts/golden/vendor-payment-confirmation/README.md`](../contracts/golden/vendor-payment-confirmation/README.md).

**Status:** both contracts green (18 assertions total), `pnpm type-check` and `pnpm lint` clean,
and a Codex GPT-5.5 adversarial pass run against the completed implementation.

---

## Why this file exists

Codex GPT-5.5's cross-model review (mandatory per this project's QA chain — see
`.claude/rules/workflow.md`) found eight real defects in
`lib/vendor-stand-payment-notification.ts`, the ITN handler that settles a vendor's stand-booking
payment. One was a genuine security gap (F1); the rest were hardening found either directly by
Codex or, in two cases (F6, F7), by a second Codex pass against the fix for an earlier one. All
eight are fixed and gated. This document explains the settlement path as it stands today, not as
a defect list — see the golden READMEs above for the full defect-by-defect decision record if you
need the "why" behind a specific line.

---

## The settlement path, step by step

`POST` (the shared handler) does the following, in order, for every inbound gateway notification:

1. **Verify** (`paymentProvider.verifyNotification`) — authenticates the notification against the
   gateway's shared secret. Fails closed if the provider's own credentials are unset. On failure,
   logs and acknowledges 200 without touching any document (`lib/vendor-stand-payment-notification.ts:109-123`).
2. **Parse the reference** — strips the `VSO-` prefix to recover `vendorSubmissionId`
   (`parseVendorSubmissionIdFromStandOrderRef`, `lib/vendor-stand-orders.ts:47`). A reference with
   no `VSO-` prefix is not a stand-order notification at all (it's a ticket order arriving on the
   wrong route) and is ignored here.
3. **Translate the gateway status** (`paymentProvider.mapStatus`) — pure, offline.
4. **`settle()`** — a nested async function, described in full below.
5. **Fire notifications** (if `paidNotice` was populated) — strictly outside any transaction,
   described in "Notification behaviour" below.
6. **Always acknowledge HTTP 200** — unchanged from before this mission. A non-200 response would
   make the gateway retry a notification indefinitely; the correct operator signal is the
   `console.error` calls already on every rejection path, not the HTTP status.

### `settle()` — guard order

`settle()` (`lib/vendor-stand-payment-notification.ts:162-392`) runs a non-transactional
**pre-read** of the order document, then a series of guards, in this order, each a `return;` on
failure:

1. Order exists.
2. **Cross-gateway guard** — a PayFast notification can never settle an Ozow-created order, or
   vice versa.
3. **Idempotency guard** — `order.status !== 'pending'` short-circuits before any further work,
   including before the gateway confirm round trip (see F1 below) — a duplicate/replayed
   notification for an already-settled order costs nothing beyond this one Firestore read.
4. **Attempt-identity guard (F3)** — described in its own section below.
5. Then, branching on the mapped status:
   - `'paid'` — amount-match guard, then the gateway confirm round trip (F1), then a Firestore
     transaction that **re-verifies every guard above** and performs the write.
   - `'failed'`/`'cancelled'` — its own separate Firestore transaction, re-verifying gateway/
     status/attempt-identity and writing the terminal status. No confirm call on this branch (see
     "F1 — gateway confirm" below for why).
   - anything else — logged as non-actionable, order left `'pending'`.

The **pre-read guards decide whether it's worth attempting a settlement at all**; the
**transaction guards are the actual correctness guarantee**, since state can change between the
pre-read and the transaction (e.g. a concurrent duplicate delivery already settled the order).
This split is deliberate — see "F6 — why confirm moved outside the transaction" below for why.

---

## F1 — the gateway confirm gate, and why it runs where it does

**The gap this closes.** Before this mission, the vendor path flipped an order to `'paid'` on
nothing but its own inbound signature verification (step 1) and an amount match. It never called
`paymentProvider.confirmNotification()` — the gateway's own out-of-band server-confirm round trip
(PayFast's `/eng/query/validate`, Ozow's `GetTransactionByReference`). Signature verification
proves a notification was signed with the shared secret; it does not prove the gateway itself
processed a real payment. Anyone holding the gateway passphrase (a materially lower bar than
compromising PayFast/Ozow itself) could forge a correctly-signed ITN and settle a vendor's stand
order with no money moving. `lib/tickets-notification.ts` (the sibling ticket path) already closed
this exact hole at its own step 8 (`lib/tickets-notification.ts:196`) — the vendor path simply
never had it.

**Where it runs.** Since F6 (below), `confirmNotification()` runs exactly once, non-transactionally,
after the amount-match guard and before any Firestore transaction is opened
(`lib/vendor-stand-payment-notification.ts:268`) — mirroring the ticket path's own step 8
placement, not its literal lookup/write-split code shape (the vendor path is architecturally one
transactional settlement function; splitting it into a ticket-path-shaped lookup/write pair was
judged a much larger, higher-risk change to a file several other missions depend on, for no
additional security benefit — see the golden README's "Design intent").

**Fail-closed, for every reason.** `ConfirmResult` has three failure reasons —
`'not-valid'`, `'request-failed'`, `'not-configured'` — and all three are treated identically:
none of them means "trust the inbound signature instead." This matters most for
`'not-configured'` (Ozow's real shape when `OZOW_SANDBOX_SITE_CODE`/`OZOW_SANDBOX_API_KEY` are
absent, `lib/payments/ozow.ts:56-62`) — a missing-config gap is an operational mistake, not an
attacker action, and it would be easy for an implementation to reason "we can't even ask, so let
the signature stand," silently recreating the exact vulnerability this gate closes.

**Scope.** The confirm gate only applies to the `'paid'` write path. Failing or cancelling an
order carries no money-settlement risk, so there is no vulnerability there for a server-confirm
round trip to close — the `'failed'`/`'cancelled'` branch has no confirm call and never has.

**What it always returns.** Regardless of confirm outcome, the handler always acknowledges HTTP
200 — a non-200 response on a failed confirm would make the gateway retry the same forged (or
misconfigured) notification indefinitely.

---

## F3 — the attempt-identity guard (the money-loss defect)

**The problem.** A vendor can re-initiate payment (e.g. after abandoning a checkout) more than
once for the same submission. Before this fix, every attempt for one submission shared the
identical `VSO-{vendorSubmissionId}` reference. A stale, late-delivered terminal notification
(`failed`/`cancelled`) from an abandoned attempt could overwrite a freshly re-initiated attempt's
order state; the genuine `'paid'` notification for the current attempt then hit the
not-`'pending'` guard and was silently ignored — **the vendor pays, the order never settles, no
email fires, no alert is raised.**

**The fix.** Every payment attempt mints a fresh, unguessable `attemptId`
(`app/api/vendors/stand-payment/initiate/route.ts:192`, `crypto.randomBytes(8).toString('hex')` —
16 hex characters, 64 bits of entropy) and threads it through the reference handed to the
gateway: `VSO-{vendorSubmissionId}::{attemptId}` (`buildVendorStandOrderReference`,
`lib/vendor-stand-orders.ts:35`). The reference round-trips byte-for-byte through both PayFast and
Ozow, so the settlement handler can compare the notification's embedded `attemptId` against the
order document's own stored `attemptId` and reject anything that doesn't match — gating **both**
the `'paid'` and the `'failed'`/`'cancelled'` branches (gating only the paid path would leave the
stale-terminal-notification poisoning path open, which is the whole defect).

**The rule, precisely.** `order.attemptId` presence is the *only* signal that decides whether the
guard applies. Once an order carries an `attemptId`, a notification with **no parseable suffix at
all** is rejected exactly the same as one whose suffix disagrees — there is no fallback-accept for
a bare, no-suffix reference. (An earlier draft of this fix used
`notificationAttemptId && notificationAttemptId !== order.attemptId`, which short-circuited and
silently admitted any suffix-less reference even against an order that had a real `attemptId` —
i.e. the exact bare `VSO-{vendorSubmissionId}` reference an attacker could construct from nothing
but the public vendorSubmissionId. Fixed before landing; see the golden README's "F3" for the full
account.)

**Migration window.** An order written by the pre-fix initiate route carries no `attemptId`. For
that narrow, time-boxed window — orders created before the fix deployed and not yet settled by the
time it did — a notification against such an order has nothing to compare, so it is accepted
unconditionally: today's exact pre-fix behaviour, not a new gap. Every order created *after*
deploy is immediately covered. This is stated explicitly in the code's own comments
(`lib/vendor-stand-payment-notification.ts:215-227`) so a future reader doesn't mistake the
carve-out for an oversight.

---

## F6 — why the gateway confirm call moved outside the transaction

**The defect, introduced by F1's own fix.** F1 originally placed
`paymentProvider.confirmNotification()` **inside** `db.runTransaction(...)`. Firestore replays a
transaction callback from scratch on write contention, discarding every prior attempt's reads and
writes and applying only the final, successfully-committing attempt's. `confirmNotification()` is
a real external network call, not a Firestore operation — Firestore's retry machinery has no way
to undo it once it has run. The failure sequence: a genuinely valid payment arrives; the first
transaction attempt calls confirm and it genuinely succeeds; before that attempt can commit,
Firestore discards it on contention and replays the callback; the second (committing) attempt
calls confirm *again*, and this time the gateway has a transient hiccup
(`{ confirmed: false, reason: 'request-failed' }`); nothing commits; the handler still
acknowledges HTTP 200, so the gateway believes the notification was handled and never retries. The
vendor's genuine payment is now permanently lost — stuck `'pending'` forever, zero emails, zero
alert. This is the exact failure shape F3 exists to prevent, reintroduced by F1's own fix, for an
unrelated root cause (retry-duplication of an external call, not stale-attempt correlation).

**The fix.** `confirmNotification()` now runs exactly once, entirely outside and before any
Firestore transaction — mirroring `lib/tickets-notification.ts`'s own step 5-8 shape (a
non-transactional lookup and confirm, followed by a transactional write that re-verifies state).
A Firestore retry can no longer re-invoke confirm at all, because confirm no longer runs inside
the retried section. The settlement transaction re-verifies every guard at write time — the actual
correctness guarantee, since state can change between the pre-read and the transaction (e.g. a
concurrent duplicate delivery already settled the order) — the pre-read is purely an optimisation
deciding whether confirming is even worth attempting, the same relationship
`lib/orders.ts`'s `markOrderAndPositionPaidByPaymentId` already has between its own lookup and
write functions.

**Result: two transaction blocks, not one.** The `'paid'` branch has its own
`db.runTransaction(...)` (`lib/vendor-stand-payment-notification.ts:284`); the `'failed'`/
`'cancelled'` branch has its own, separate one (`lib/vendor-stand-payment-notification.ts:366`),
for the same read-then-write atomicity. This is a real structural change from the pre-F6 single-
transaction shape — if you're writing a check or reading this file for the first time, don't
assume "exactly one `db.runTransaction`" as an invariant.

---

## F7 — the reference's length, and why it matters only for Ozow

F3's `VSO-{vendorSubmissionId}::{attemptId}` reference is mapped directly into Ozow's
`TransactionReference` field, documented in this repo's own `lib/payments/ozow.ts` comments as
`String(50)`. With `attemptId` minted as a full `crypto.randomUUID()` (36 characters), the built
reference for a real 20-character Firestore auto-id was 62 characters — 12 over Ozow's cap, for
every normal vendor payment, the instant `activeGateway === 'ozow'`. PayFast is the currently
active gateway (see `docs/payment-gateway-selection.md`) and documents no comparably tight limit,
so nothing observably broke in production — but the Ozow switch is a live, pending decision, and
this defect would have fired the instant it flipped, with no warning.

**Fix:** `attemptId` is now 16 hex characters (`randomBytes(8)`, 64 bits of entropy) rather than a
UUID — deliberately *not* a truncated UUID, since slicing a v4 UUID string crosses its fixed
version/variant nibbles and yields less real entropy than the character count suggests. The full
reference is now 42 characters, comfortably under Ozow's 50-char cap (A13 requires at least 5
characters of margin, i.e. a built reference of at most 45 characters).

**Known, pre-existing, out of scope:** Ozow's `BankReference` field (fed the same reference via
`deriveOzowBankReference`, documented `String(20)`) already exceeds its cap at 24 characters even
with the *pre-F3* base reference (`VSO-` + a 20-character id), independent of anything F3 or this
mission added. This is a real gap, logged here rather than silently folded into F7's fix, and is
not something this mission introduced or closed.

---

## F8 — redaction on the verification-failure path

`console.error` on a failed-verification notification (`lib/vendor-stand-payment-notification.ts:117-121`)
now redacts `verification.reference` through the same `redactEmailAddresses()` helper F5 (below)
already uses, before logging it. At that point in the handler, `reference` is entirely
attacker-controlled — read straight off an unsigned or malformed notification's wire field, before
any signature check has passed — and can carry anything, including a real or fabricated email
address. This is a different fix *site* from F5 (a much earlier point in the handler, on
unauthenticated input) but reuses the exact same redaction logic rather than inventing a second
way of doing the same thing.

---

## Notification behaviour

If `settle()` populates `paidNotice` (only on the branch that performs the paid-transition write,
never on a re-verified duplicate), two emails fire, both strictly **outside** any transaction:

1. **Admin notice** — `sendVendorPaymentAdminNoticeEmail()`, recipients resolved via
   `getVendorAdminNotifyRecipients()` (`ADMIN_EMAIL_ALLOWLIST`).
2. **Vendor receipt** (F1, mission `vendor-payment-confirmation`) — `sendVendorPaymentConfirmationEmail()`,
   sent to the vendor's own `contactEmail`, captured from the *submission* document (not the
   order — see `docs/vendor-flow-notifications.md`'s "Vendor payment confirmation receipt" section
   for why). Skipped, with a non-PII log line naming only `vendorSubmissionId`, if `contactEmail`
   is missing or blank — this never suppresses the admin notice, which has nothing to do with
   whether a vendor address exists.

**F2 — concurrency and a timeout, both required.** Both sends are built as promises and awaited
together via `Promise.allSettled`, each individually bounded by a 5000ms
(`EMAIL_SEND_TIMEOUT_MS`) timeout (`withTimeout()`,
`lib/vendor-stand-payment-notification.ts:50-66`). Before this fix, the two sends were sequential
and fully awaited with no bound — a hung first send (a stalled TCP connection, a provider that
accepts the connection but never answers) meant the second send was never even attempted, and the
gateway's 200 ack never returned, *after* Firestore had already committed the order `'paid'` — the
gateway would then retry against an already-settled order. A timeout alone would still leave the
sends sequential (a slow-but-not-hung first send delays the second's own start by up to the full
timeout window); concurrency alone bounds nothing (two simultaneous hangs still sum to zero
forward progress). Both together give the property actually needed: a send that never resolves
must not prevent the other send, and must not prevent the 200 ack. 5000ms was chosen as a fresh
judgement call (no existing per-call timeout convention exists elsewhere in this repo) — long
enough to essentially never fire against a merely-slow-but-working send, short enough to stay well
inside any documented gateway webhook-response expectation.

**F4 — blank identity no longer settles silently.** If the submission is missing
`businessName`/`contactPersonName`, settlement is unchanged (money already moved; refusing to
settle would be worse) but the skip is now logged, naming only `vendorSubmissionId`.

**F5 — caught mailer errors are redacted before logging.** Both `onError` handlers (admin notice,
vendor receipt) run any caught error message through `redactEmailAddresses()` before logging —
a provider validation error can otherwise embed the offending recipient's real email address at
runtime. This is a best-effort, email-shaped-pattern redaction, not a general PII scrubber; it
will not catch a phone number, physical address, or a name in a differently-shaped error message.

**Idempotency, unchanged.** The existing `order.status !== 'pending'` early-return remains the
sole mechanism making the settlement write *and* both downstream emails idempotent against a
duplicate/replayed notification — no new idempotency logic was written for any of F1-F8.

---

## `vendorStandOrders` — the `attemptId` field

The `vendorStandOrders` Firestore document now carries an `attemptId: string` field (F3, minted
per payment attempt at `/api/vendors/stand-payment/initiate`, never reused across re-initiates).
Documents written before this mission have no `attemptId` — see the "F3" migration-window
paragraph above for exactly how the settlement handler treats that case.

---

## What these contracts do NOT prove

Carried forward honestly from the golden READMEs — do not treat any of these as closed:

- **Reachability or credential validity of the real gateway endpoints.** Every behavioural check
  runs against the harness's fake `PaymentProvider`. Nothing here proves PayFast's sandbox
  `/eng/query/validate` or Ozow's `GetTransactionByReference` is reachable in production, or that
  the configured credentials are valid at runtime.
- **`SITE_URL` holding the correct deployed value.** Checks prove links are built *from*
  `SITE_URL`/`resolveSiteUrl()`, never a hardcoded literal — they cannot and do not prove the
  variable's runtime value is correct. On 2026-09-01, a `hosted.app` link shipped in a live vendor
  email this way, past a green gate and a clean Codex pass, because `SITE_URL` itself was wrong in
  the deployed environment — the variable really was being used correctly; only its value was
  wrong. Only reading a delivered email, or a runtime assertion against the actual resolved
  environment value, can catch that class of defect.
- **At-most-once delivery.** A crash between the Firestore commit (`'paid'`) and the email-send
  attempts loses those side effects permanently — there is no durable outbox recording "this order
  settled, the notification emails still need to go out." This is the same pattern every other
  Firestore-write-then-best-effort-email path in this repo already runs under, including
  `lib/tickets-notification.ts`'s own confirmation email. Known, logged as P1 backlog, repo-wide —
  deliberately not fixed as part of this work.
- **Production Firestore transaction-contention behaviour.** F6's "confirm could in principle
  repeat on a retried transaction" cost (now eliminated by moving confirm outside the transaction)
  was a code-shape argument, not something the harness's in-memory Firestore stub can reproduce
  under real contention — the harness's `simulateTransactionRetries()` control (added for A12)
  simulates a replay explicitly rather than reproducing genuine contention.
- **Ozow's confirm is not configured in this environment** — it fails closed by design (A4 proves
  the `'not-configured'` reason is treated identically to any other unconfirmed reason), but this
  means F1's gate has never been exercised against a real, live Ozow confirm response in this
  environment, only against the fixture and (for PayFast, the active gateway) whatever
  `lib/payments/payfast.ts`'s own confirm implementation does against the real sandbox.
- **`BankReference`'s pre-existing 20-char overflow** (see F7 above) is real, predates this
  mission, and is not fixed here.
