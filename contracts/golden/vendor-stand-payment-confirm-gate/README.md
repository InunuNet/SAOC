# vendor-stand-payment-confirm-gate -- decision record

## The defect

`lib/vendor-stand-payment-notification.ts` (the vendor stand-payment ITN handler) flips a
`vendorStandOrders` document to `'paid'` on nothing but its own inbound HMAC signature
verification (step 1) and an amount match against the stored order (inside the `if (status ===
'paid')` branch). It never calls `paymentProvider.confirmNotification()` -- the gateway's own
out-of-band server-confirm round trip (PayFast's `/eng/query/validate`, Ozow's
`GetTransactionByReference`).

`lib/tickets-notification.ts`, the sibling TICKET settlement path, already closed exactly this
hole at its own step 8 (see that file's own extensive comment on why the round trip exists and
why it runs where it does). Confirmed by grep: `confirmNotification` appears as the interface
declaration (`lib/payments/types.ts:120`), both provider implementations
(`lib/payments/payfast.ts:296`, `lib/payments/ozow.ts:291`), and exactly ONE call site
(`lib/tickets-notification.ts:196`) anywhere in the repo -- the vendor stand-payment path has
none.

**Impact.** Signature verification alone proves a notification was signed with the shared
secret -- it does not prove the gateway itself processed a real payment. Anyone holding the
gateway passphrase (a materially lower bar than compromising PayFast/Ozow itself) can forge a
correctly-signed ITN and settle a vendor's stand order as `'paid'` with no money moving. This is
the "gap the sibling path already fixed but this one didn't" defect class, found by the
mandatory Codex GPT-5.5 cross-model review layer -- neither the browser layer nor the real-inbox
layer could see it, which is why the triad exists.

## Design intent -- mirror the ticket path's principle, not its literal code shape

The team lead's brief asked this contract to mirror `lib/tickets-notification.ts` and flag any
deliberate divergence. There is exactly one structural divergence, forced by a real difference
between the two files' shapes, and it is explained here in full.

**Ticket path structure:** `verifyNotification` -> log source IP -> resolve `reference` ->
non-transactional order **lookup** -> already-settled short-circuit -> amount match -> **confirm
(a plain `await`, no Firestore transaction open)** -> `mapStatus` -> call
`markOrderAndPositionPaidByPaymentId(...)`, which opens its OWN internal Firestore transaction
purely to re-check `status === 'reserved'` and write. The confirm call sits entirely outside any
Firestore transaction because the ticket path's read-then-decide-then-write is split across two
functions, with the transactional write function trusting a confirmation result computed before
it was ever invoked.

**Vendor path structure:** the settlement handler is ONE `db.runTransaction(async (transaction)
=> { ... })` callback that reads the order, applies every guard (cross-gateway, idempotency,
amount match), and writes the `'paid'` status, all inside that single callback -- there is no
separate lookup function and no separate transactional write function to split the confirm call
across.

**The judgement call:** rather than restructure the vendor path into a ticket-path-shaped
lookup/write split (a much larger, higher-risk change to a file three other missions have
already built on this session), this contract specifies the confirm call **inside** the existing
transaction callback, in the `if (status === 'paid')` branch, immediately after the amount-match
guard and immediately before the `transaction.update(standOrderRef, { status: 'paid', ... })`
write. This preserves the ticket path's actual governing principle -- **the gateway's own
out-of-band confirmation must gate the state transition, and an unconfirmed result must leave
the order untouched** -- without inventing a second, structurally divergent write path for the
same security control (a divergent second implementation of one security control is itself a
defect the team lead's brief explicitly warned against).

**Accepted cost of this choice, stated plainly:** a Firestore transaction can retry its callback
on write contention, so in the rare case of contention against the SAME order the confirm HTTP
call could in principle be issued more than once for one delivery. This is a real but low-stakes
cost (an extra idempotent read against the gateway's own status endpoint, not a double-write --
`A5` below proves the existing amount-match and already-settled guards still run BEFORE the
confirm call, so contention is the only path to a repeat call, not a design that fires it
unconditionally), and it is materially smaller than restructuring a shared, multiply-depended-on
file mid-mission. If a future mission needs to eliminate even that possibility, the ticket
path's lookup/write split is the model to follow -- this contract does not foreclose that, it
just does not attempt it here.

## Fail-closed semantics -- every unconfirmed reason, not a subset

`ConfirmResult` (`lib/payments/types.ts`) has three failure reasons: `'not-valid'`,
`'request-failed'`, `'not-configured'`. The fix must treat `confirmation.confirmed === false`
identically regardless of `reason` -- there is no reason value that means "trust the inbound
signature instead." `A3` proves the generic case (`'not-valid'`); `A4` proves the specific case
the team lead's brief called out by name -- Ozow's `confirmNotification()` returning
`{ confirmed: false, reason: 'not-configured' }` when `OZOW_SANDBOX_SITE_CODE` /
`OZOW_SANDBOX_API_KEY` are absent (`lib/payments/ozow.ts:56-62`) -- because a missing-config gap
is an operational mistake, not an attacker action, and it would be easy for an implementation to
reason "we can't even ask, so let the signature stand" and silently recreate the exact
vulnerability this contract exists to close. Both checks additionally prove the rejection is
per-attempt, not a poisoned order: a later, genuinely confirmed redelivery of the SAME
notification settles normally.

## HTTP response on a failed confirm

Unchanged from the file's existing (and ticket path's own documented) contract: **always 200**
(`acknowledge()`), regardless of confirm outcome. The file's own header comment already states
this: "we still return HTTP 200 so the gateway stops retrying, but a 200 response here never
implies the payment was accepted." Returning a non-200 on a failed confirm would make the
gateway retry the SAME forged (or misconfigured) notification indefinitely, which helps nobody
-- the correct operator signal is the `console.error` line already on that path, not the HTTP
status. `A3` and `A4` both assert the response stays `200` on the unconfirmed path.

## Idempotency guard -- unchanged, and proven unchanged

The existing `if (order?.status !== 'pending') return;` early-return is untouched by this
contract's design and remains the sole mechanism making both the settlement write AND both
downstream emails (vendor receipt, admin notice -- wired by the separate, concurrently-landing
`vendor-payment-confirmation` mission) idempotent against a duplicate/replayed ITN. `A5` proves
this directly: `confirmNotification()` is never called a second time for a duplicate delivery
against an already-settled order, because the existing idempotency short-circuit exits before
the confirm call is ever reached -- the same reasoning that already protects the two email
sends is what protects the gateway from an unnecessary repeat server-confirm round trip.

## Interaction with the concurrent `vendor-payment-confirmation` mission (F1, vendor receipt email)

That mission wires a SECOND email (the vendor's own payment receipt) into the same `if
(paidNotice) { ... }` block this file already fires the admin notice from -- both sends are
downstream of the SAME `paidNotice` variable, which is only ever assigned inside the `if (status
=== 'paid')` branch, after (in this contract's design) the confirm gate has already passed. **No
sequencing is required between the two missions': placing the confirm gate before `paidNotice`
is assigned makes it impossible for either email to fire on an unconfirmed notification, for
free** -- this was verified directly: as of this contract's RED-verification pass (2026-09-02),
`lib/vendor-stand-payment-notification.ts` already carries the vendor-payment-confirmation
mission's two-email wiring (both `sendVendorPaymentAdminNoticeEmail` and
`sendVendorPaymentConfirmationEmail` inside one `if (paidNotice)` block), and `A3`/`A4` assert
BOTH sends stay at zero on an unconfirmed notification, not just the admin one. Whoever
implements this contract does not need to re-open or re-sequence that mission's work.

## What these checks CANNOT prove

- **Reachability / credential validity of the real gateway endpoints.** Every behavioural check
  here runs against the harness's fake `PaymentProvider` (`contracts/harness/route-runner/
  fixture-payments.mjs`), with `confirmNotification()`'s result fully controlled by the check.
  Nothing here proves PayFast's sandbox `/eng/query/validate` endpoint or Ozow's real
  `GetTransactionByReference` endpoint is reachable in production, or that
  `OZOW_SANDBOX_API_KEY`/PayFast's merchant credentials are valid at runtime. That is exactly
  the class of thing `lib/payments/ozow.ts`'s own F2b decision record
  (`contracts/golden/ozow-m1-f2b/README.md`) already flags as an evidence-based inference, not
  a captured live response.
- **The real adapters' own `confirmNotification()` implementations.** `payfast.ts:296` and
  `ozow.ts:291` are exercised elsewhere (their own contracts); this contract only proves the
  SETTLEMENT HANDLER calls whichever adapter it is given and honours the result. A bug inside
  either adapter's own confirm logic is out of this contract's scope.
- **Production behaviour under real Firestore transaction contention.** The "confirm call could
  in principle repeat on a retried transaction" cost noted above is a code-shape argument, not
  something the in-memory `fixture-firestore.mjs` transaction stub can reproduce (it does not
  simulate contention/retries).
- **The `failed`/`cancelled` status branch, for F1's confirmNotification() gate specifically.**
  F1 deliberately scopes the `confirmNotification()` gate to the `'paid'` write path only --
  failing or cancelling an order carries no money-settlement risk, so there is no vulnerability
  there for a server-confirm round trip to close, and adding one would only spend an extra
  gateway round trip for no security benefit. `A2`'s wiring discriminator only inspects the `if
  (status === 'paid') { ... }` block; it makes no claim about the other branches. F3's
  attempt-identity check (below) is a SEPARATE control and DOES apply to the failed/cancelled
  branch -- the two features are not in tension; F1 answers "was this notification really
  confirmed by the gateway" (paid path only), F3 answers "does this notification belong to the
  CURRENT payment attempt" (both paths).

---

# F2-F5 -- four more defects, same file, folded in 2026-09-02

Found by a Codex GPT-5.5 adversarial pass the team lead ran against @dev's completed
vendor-receipt implementation (contract-vendor-payment-confirmation.yaml, A1-A8, green on disk
at the time these four were found). That contract is UNCHANGED by this expansion and stays
green -- these four features are specced strictly ON TOP of its two-email `if (paidNotice)`
wiring. Folded into THIS contract (not a new parallel one) so one @dev pass edits
`lib/vendor-stand-payment-notification.ts` once; two agents editing that file concurrently
already caused a problem earlier this session.

## F2 -- a hung send can block its sibling and the gateway's 200 ack

**The defect.** The two downstream sends inside `if (paidNotice) { ... }` are sequential and
fully `await`ed. `deliverConfirmationEmailAfterCommit()` catches a REJECTION but bounds nothing
-- if the FIRST send (the admin notice) never resolves (a stalled TCP connection, a provider
that accepts the connection but never answers -- a real HTTP failure mode, not a hypothetical
one), the vendor receipt is never even attempted, and the 200 ack never returns, AFTER Firestore
has already committed the order 'paid'. The gateway then retries against an already-settled
order.

**Choosing the timeout value.** `EMAIL_SEND_TIMEOUT_MS = 5000`. This project has no existing
per-call timeout convention to match (grepped -- none exists anywhere in `lib/`/`app/`), so this
is a fresh judgement call, stated plainly as such rather than presented as house style. 5
seconds is chosen because: (a) it is comfortably longer than Resend's typical response latency
under normal conditions (low hundreds of ms to low seconds), so it will essentially never fire
against a merely-slow-but-working send; (b) it is comfortably shorter than any documented
PayFast/Ozow webhook-response expectation (gateways generally expect an ITN handler to
acknowledge within single-digit-to-low-double-digit seconds before treating the delivery as
failed and queuing a retry) -- with the two sends now CONCURRENT rather than sequential (see
below), the worst-case added latency before the 200 ack is one timeout window (~5s), not two
sends' worth. If real production telemetry later shows this value is wrong in either direction,
it is a one-constant change, not a redesign.

**Why both concurrency AND a timeout, not just one.** A timeout alone still leaves the two sends
sequential -- a slow-but-not-hung admin notice would still delay the vendor receipt's own start
by up to the full timeout window before it even begins. Concurrency alone does not bound
anything -- two simultaneous hangs still sum to zero forward progress with no ceiling on either.
Both together are required for the property the team lead asked for: "a send that never resolves
must not prevent the other send, and must not prevent the 200."

**A9 (F5)'s redaction still applies inside `withTimeout()`'s own thrown Error** -- a timeout
firing produces `new Error('email send timed out after 5000ms')`, which contains no PII by
construction, so F5's redaction helper is a no-op on it, not a special case to carve out.

## F3 -- stale terminal ITN can poison a fresh attempt (the money-loss one)

See the F3 feature entry in the contract YAML for the full defect description and the chosen
design (attach a per-attempt identifier, threaded through the gateway-echoed `reference` field,
compared before EITHER the paid or the failed/cancelled branch treats a notification as
authoritative).

**F3 migration window, explicit and time-boxed.** An order document written by the CURRENT
(pre-fix) initiate route carries no `attemptId`. For that narrow window -- orders created before
the fix deploys, not yet settled by the time it does -- a notification against such an order has
nothing to compare, so it must be accepted unconditionally, i.e. today's exact behaviour. This is
NOT a silent reintroduction of the vulnerability: it is bounded to orders that are already
mid-flight at deploy time, it is the SAME behaviour production has run under until now (not a
regression), and every order created AFTER deploy is immediately covered. State this window
explicitly in code comments at the fallback branch, so a future reader does not mistake it for an
oversight.

**The carve-out is keyed on `order.attemptId`, never on `notification.reference`'s shape.**
@dev's first pass at this feature implemented the guard as "reject only when the notification's
suffix parses AND mismatches" -- `if (order?.attemptId) { const notificationAttemptId =
parseAttemptIdFromStandOrderRef(notification.reference); if (notificationAttemptId &&
notificationAttemptId !== order.attemptId) { reject } }`. Because
`parseAttemptIdFromStandOrderRef` returns `null` for a bare, no-suffix reference, the
`notificationAttemptId &&` guard short-circuited and silently ADMITTED any notification with no
suffix at all, even against an order that HAD a real `attemptId` -- i.e. exactly the bare
`VSO-{vendorSubmissionId}` reference an attacker could construct from nothing but the public
vendorSubmissionId (visible in the vendor's own approval email/URL). This widened the intended
migration-window carve-out (orders with no `attemptId` stored) into a PERMANENT one (any
notification with no suffix, regardless of the order's own state) -- silently, because six of
this contract's own checks (A3, A4, A5, A6, A8, A9) happened to hardcode bare
`VSO-{vendorSubmissionId}` references in their own ITN payloads (a leftover from before F3
existed), so the permissive shape passed all of them. Those six checks were fixed to capture the
REAL minted reference via the harness's `initiateCalls` log (the same implementation-agnostic
technique A7 already used) instead of hardcoding a pre-F3 shape, and A11 was added specifically
to isolate and RED-verify the missing-suffix case A7 does not cover. The corrected rule: the ONLY
signal that determines whether the migration-window carve-out applies is whether `order.attemptId`
is present on the ORDER document -- not whether the inbound notification's reference happens to
parse. Once an order has an `attemptId`, EVERY notification against it -- suffix present and
matching, suffix present and mismatching, or suffix ABSENT entirely -- is judged against that
`attemptId`, and only an exact match is accepted.

**Why `reference`, not a gateway custom field.** PayFast's `custom_str1..5` and Ozow's
`OptionalField1..5` would also work, but would require both `lib/payments/payfast.ts` and
`lib/payments/ozow.ts`'s `initiate()`/`InitiateInput` to grow a new passthrough parameter and
both adapters' outbound field builders to carry it -- real surface, real risk, on files this
mission does not otherwise need to touch. `reference` already round-trips byte-for-byte through
both adapters into `notification.reference` with ZERO adapter changes, because that generic
round trip is the entire reason `ProviderNotification.reference` exists. Embedding the attempt id
in the one field already guaranteed to survive the trip is the minimal-surface fix.

**A7 does not hard-code this mechanism.** It captures whatever `reference` string the REAL
initiate route mints per attempt (via the harness's `initiateCalls` log) and replays those exact
captured values, so the check remains valid evidence of the END-TO-END property regardless of
whether @dev implements attempt-id-in-reference exactly as specced above or a different
correlator with the same effect.

## F4 -- blank identity settles silently

Straightforward: settlement behaviour is UNCHANGED (money already moved; refusing to settle
would be worse), only the silence is fixed. Coordinated with
`contract-vendor-payment-confirmation.yaml`'s A5 (the static no-PII discriminator on the two
sender modules) -- this feature's new log line follows the SAME "name the id, never the PII"
shape that file's sibling `else` branch (missing-contactEmail, line ~274-279) already
demonstrates in this very file; A8 is the equivalent BEHAVIOURAL proof for this caller, which a
static check on the sender modules alone cannot provide.

## F5 -- email address can leak via a caught error's message

**What redaction is not.** The specified `redactEmailAddresses()` helper is a best-effort
log-hygiene control using a reasonably permissive email-shaped pattern -- it is NOT a general PII
scrubber. It will not catch a phone number, a physical address, or a name embedded in a
differently-shaped error message. A9 only asserts the specific, realistic shape this defect was
found with (a provider validation error naming the offending recipient address) -- it is not
proof that every conceivable PII shape a future error message might carry is caught. If a future
incident surfaces a different leaking shape, that is a new, narrower fix, not evidence this one
was wrong.

**Why A5 (the existing static check) cannot cover this.** A5 inspects the literal source text of
`lib/vendor-payment-confirmation.ts` and `lib/vendor-payment-admin-notice.ts` for `console.*`
calls -- it is a STRUCTURAL check on two files that (correctly) contain zero logging calls at
all. The leak this feature closes happens in a THIRD file
(`lib/vendor-stand-payment-notification.ts`, the caller), and the PII is not a literal string
anywhere in that file's source -- it is interpolated into `error.message` at RUNTIME by whatever
threw. No static check, however written, can observe a value that does not exist until the code
runs; A9's behavioural proof (throwing a fixture error whose message embeds a real address, then
inspecting what actually reaches `console.error`) is the only check shape that can prove this
property.

## F6 -- a defect IN F1's OWN fix: transaction retry can lose a genuine settlement

**The defect.** F1 placed `paymentProvider.confirmNotification(notification)` INSIDE the
`db.runTransaction(...)` callback. Firestore replays that callback from scratch on write
contention -- it discards every prior attempt's reads and writes and applies only the FINAL,
successfully-committing attempt's. `confirmNotification()` is a real external network call, not
a Firestore operation; Firestore's retry machinery has no way to undo it once it has run.
Sequence: a genuinely valid payment arrives; the first transaction attempt calls
`confirmNotification()` and it genuinely confirms (the real-world payment DID happen); before
that attempt can commit, Firestore discards it on contention and replays the callback; the
second (committing) attempt calls `confirmNotification()` AGAIN, and this time the gateway's
confirm endpoint has a transient hiccup (`{ confirmed: false, reason: 'request-failed' }`);
that second attempt returns before the write, so nothing commits; the handler still
acknowledges HTTP 200, so the gateway believes its notification was handled and never retries.
The vendor's genuine payment is now permanently lost -- stuck 'pending' forever, zero emails,
zero alert. This is the exact failure shape F3 exists to prevent, reintroduced by F1's own fix
for an unrelated root cause (retry-duplication of an external call, not stale-attempt
correlation).

**Two fixes were originally judged acceptable; the team lead mandated (a).** (a): move
`confirmNotification()` outside the transaction, called exactly once, mirroring
`lib/tickets-notification.ts`'s own step 8 placement (confirm sits after the amount/settled
short-circuits, before any transactional write; the transaction itself only re-verifies state
at write time, the same pattern `markOrderAndPositionPaidByPaymentId` already uses). This
eliminates the replay-duplication risk structurally -- a Firestore retry can no longer
re-invoke confirm at all, because confirm no longer runs inside the retried section. F1's
original placement inside the transaction was chosen specifically to avoid restructuring this
file (see "Design intent" above) -- but F2 and F3 have since substantially restructured it
anyway (concurrent email sends, the attempt-identity guard), so that original argument carried
less weight than it did when F1 was written. (b), NOT implemented: keep confirm inside the
transaction, but stop acking 200 on a confirm failure so the gateway redelivers. @dev
implemented (a); `lib/vendor-stand-payment-notification.ts`'s `settle()` now performs a
non-transactional pre-read (guards + confirm, exactly once) followed by a `db.runTransaction`
that re-verifies every guard and writes.

**A12 was rewritten 2026-09-02 -- the first version encoded the rejected fix's topology as a
requirement.** The original A12 asserted `confirmNotificationCalls.length === 2` ("once per
simulated transaction attempt") as an unconditional SETUP precondition, written to be
implementation-agnostic between (a) and (b) before the team lead had chosen between them. Once
(a) was mandated and correctly implemented, confirm is called EXACTLY ONCE per delivery (it no
longer lives inside the retried section at all) -- so the check failed on its own setup
assertion while the real security property held (order settled 'paid', HTTP 200, confirm called
once, verified live by @dev). That was a false negative in the check, not a defect in the code.

The rewritten A12 asserts the PROPERTY, not a topology: (1) confirmNotification() is called
EXACTLY ONCE per delivery, even under a simulated transaction retry -- now a genuine,
LOAD-BEARING requirement specific to fix (a), since it is what structurally closes off F6; a
future edit that moves confirm back inside `db.runTransaction(...)` (even one that looks like a
harmless simplification) is caught here, by name, rather than waiting for another Codex pass to
rediscover it. (2) THE CRUX, unchanged and non-negotiable -- a genuine payment must never be
left both unsettled and acknowledged 200. (3) despite the retry actually occurring (the
confirm-free write transaction still replays under simulated contention -- the check does not
stop simulating retries just because confirm moved outside them), the order must still converge
correctly: settles 'paid', HTTP 200, both emails fire exactly once.

**How the RED evidence was captured, both for the harness addition and for the rewritten
check.** The route-runner harness's fake Firestore (`fixture-firestore.mjs`) originally called
its `runTransaction` callback exactly once -- it could not reproduce a defect whose failure mode
depends on the callback running MORE than once. This contract added
`simulateTransactionRetries(count)`: a one-shot control that makes the NEXT `runTransaction`
call replay the callback `count` extra times first, with each replayed attempt's Firestore
writes staged into a throwaway buffer and discarded (matching real Firestore semantics), while
any non-Firestore side effect the callback performs -- critically, `confirmNotification()` under
the REJECTED fix (b)'s topology -- still runs for real on every attempt, exactly as it does
against a real Firestore backend. Paired with `fixture-payments.mjs`'s
`setConfirmNotificationResultSequence()`, which lets each successive `confirmNotification()`
call within one check see a DIFFERENT `ConfirmResult`, A12 can reproduce F6's exact sequence
regardless of which topology is under test -- under fix (a) only the sequence's first entry is
ever consumed (one call); under the rejected fix (b)'s topology both entries would be consumed
(two calls), reproducing the original defect.

To prove the REWRITTEN check genuinely catches a reintroduction of F6 (not merely satisfied by
construction against the current code), it was run against two states of
`lib/vendor-stand-payment-notification.ts`, both captured live on 2026-09-02:
- **GREEN, exit 0**, against the current, correctly-landed implementation (confirm outside the
  transaction, called once).
- **RED, exit 1, 6 failures**, against a DELIBERATELY REVERTED implementation -- confirm moved
  back inside `db.runTransaction(...)`, matching the pre-F6 (defective) topology exactly. The
  two most direct failures: `"confirmNotification() must be called EXACTLY ONCE per delivery...
  got 2 call(s)"` and `"a genuine payment must never be BOTH left unsettled AND acknowledged
  200... Got order status \"pending\" with HTTP 200"` -- naming exactly the topology
  regression and the silent-loss combination F6 exists to prevent.

The revert was applied and reverted as a controlled, temporary edit to `lib/` for this
verification only (backed up and restored byte-for-byte, confirmed via checksum before and
after) -- @dev's landed implementation was never at risk and is unchanged.

## F7 -- a defect IN F3's OWN fix: the widened reference overflows Ozow's field length

**The defect.** F3 widened the stand-order reference to
`VSO-{vendorSubmissionId}::{attemptId}`, with `attemptId` minted as a full
`crypto.randomUUID()` (36 characters including hyphens) in the initiate route. For a real
Firestore auto-generated document id (always exactly 20 characters -- `vendorSubmissionId` is
the `vendorSubmissions` doc id, created via `.add()`), the built reference is `VSO-` (4) + 20 +
`::` (2) + 36 = **62 characters**. `lib/payments/ozow.ts` maps this reference directly into
`TransactionReference`, a field that file's OWN pre-existing comment
(`deriveOzowBankReference`'s doc comment) already documents as `String(50)` -- written back when
the only reference in play was the 22-character ticket booking ref. F3's 62-character reference
breaches that cap by 12 characters, for every normal approved vendor submission, the moment
`activeGateway === 'ozow'`. Ozow either refuses the initiate outright or truncates the value --
and a truncated reference then fails F3's OWN attempt-identity match on the resulting
notification, turning a real payment into a rejected notification.

**Why this is silent today.** PayFast is the currently active gateway
(`docs/payment-gateway-selection.md`), and PayFast documents no comparably tight limit on
`m_payment_id` in this repo's own adapter comments, so nothing observably breaks in production
right now. But the Ozow switch is a live, pending decision -- this defect fires the instant it
flips, with no warning, because nothing before A13 asserted a length bound on this reference
against either adapter's documented field limits.

**The fix, and the margin.** Shorten the attempt correlator so the full reference fits
comfortably under Ozow's 50-char cap, with real headroom (A13 requires at least 5 characters of
margin, i.e. a built reference of at most 45 characters for a real 20-character
vendorSubmissionId) -- a zero-margin fix would be exactly as fragile as the bug it replaces, the
first time the id format grows by even one field. A shortened random token (e.g. a
hex-encoded `crypto.randomBytes(n)` of a length @dev chooses and justifies for adequate
collision resistance at this project's realistic concurrent-attempt volumes -- a national vendor
show, not a high-throughput system) is the natural replacement for the full UUID; the base
`VSO-{vendorSubmissionId}` shape and the `::` separator are unaffected.

**BankReference -- flagged, explicitly out of THIS scope.** Ozow's `BankReference` field is fed
the SAME full reference via `deriveOzowBankReference`, which only strips the ticket path's
`BOOKING_REF_PREFIX` and does nothing for a `VSO-` reference. That field is documented as
`String(20)` -- and even the PRE-F3 base reference (`VSO-{20-char id}` = 24 characters) already
exceeds it, independent of anything F3 or this contract added. This is a real, pre-existing gap
that predates F3 and is not a regression this contract introduces; A13 does not assert it, and
it is logged here rather than silently folded into this fix so it is not lost. Fixing it
properly likely means extending `deriveOzowBankReference` to also strip the `VSO-` shape (or a
parallel helper), which touches shared Ozow field-mapping logic beyond this contract's declared
scope (lib/vendor-stand-orders.ts and the initiate route only) -- a separate backlog item, not
this one.

## F8 -- unredacted attacker-controlled reference logged on verification failure

**The defect.** `lib/vendor-stand-payment-notification.ts:114`'s verification-failure
`console.error` call logs `verification.reference` verbatim. At this point in the handler, that
reference is entirely ATTACKER-CONTROLLED -- read straight off an unsigned or malformed
notification's wire field, before any parsing, any signature check having passed, or any
relationship to a real order. An attacker can put anything there, including a real or
fabricated email address (e.g. `m_payment_id=alice@example.com`), and it reaches production
logs unredacted.

**Why this is a different fix site from F5.** F5's `redactEmailAddresses()` helper already
exists and is proven (A9) to be applied to the two `onError` handlers' caught mailer-error
messages -- but that is a LATER, narrower code path (a failure sending an email about an
already-settled, already-authenticated order). F8's leak happens much EARLIER, on the very
first line of the handler, before `vendorSubmissionId` is even resolved, on input that has not
been authenticated at all. The fix reuses the exact same helper (no new redaction logic, no
second way of doing the same thing) -- only the call site changes.

**Confidence and cost.** Codex rated this Low/Medium confidence relative to F6 and F7 (a
narrower blast radius, and arguably less severe than a money-loss or a broken-gateway defect),
but it is a genuine, cheaply-fixed log-hygiene gap on unauthenticated input, and the existing
helper makes the fix a one-line change at the call site -- there is no reason to leave it open
just because it is the smallest of the three.

## Known accepted limitation -- at-most-once delivery, explicitly out of scope

Codex's pass also flagged that a crash between the Firestore commit (order -> 'paid') and the
email-send attempts loses those side effects PERMANENTLY -- there is no durable outbox / retry
queue recording "this order settled, the notification emails still need to go out." This is
real. It is also the SAME pattern this entire repo already runs under everywhere a Firestore
write is followed by a best-effort `deliverConfirmationEmailAfterCommit` send, including
`lib/tickets-notification.ts`'s own confirmation email. Fixing it here would mean either (a)
inventing a durable-outbox pattern nowhere else in the codebase uses, scoped to one settlement
path while every sibling path keeps the same gap, or (b) a repo-wide durable-delivery mission --
neither is in scope for a P0 gate-and-log-hygiene fix on one file. Brad's call: logged as
backlog, not fixed here. Not silently forgotten -- this paragraph is that record.

## Files (F2-F5 additions)

| File | Role |
|---|---|
| `contracts/checks/vendor-stand-payment-confirm-gate/check-hung-send-does-not-block-sibling-or-ack.mjs` | A6 (F2) -- a permanently-hung send does not block its sibling send or the 200 ack, in both directions, proven against the check's own 9000ms outer watchdog (racing the real POST call, since simply awaiting a hung call would itself hang the check forever pre-fix). |
| `contracts/checks/vendor-stand-payment-confirm-gate/check-stale-terminal-itn-does-not-poison-fresh-attempt.mjs` | A7 (F3) -- the full money-loss sequence: stale terminal notification from an abandoned attempt must not poison a re-initiated attempt; the genuine payment for the current attempt must still settle. Implementation-agnostic (captures real minted references, does not assume a field name). Isolates the PARSEABLE-BUT-MISMATCHED-suffix case only -- see A11 for the missing-suffix case. |
| `contracts/checks/vendor-stand-payment-confirm-gate/check-blank-identity-logs-and-settles.mjs` | A8 (F4) -- settlement with blank businessName/contactPersonName still settles + sends zero emails (unchanged) but now logs the skip, naming only vendorSubmissionId. |
| `contracts/checks/vendor-stand-payment-confirm-gate/check-error-message-redaction.mjs` | A9 (F5) -- a caught mailer error's message embedding a real email address never reaches `console.error` verbatim, in both onError handlers, while a redacted failure log line still exists. |
| `contracts/checks/vendor-stand-payment-confirm-gate/check-missing-suffix-notification-rejected.mjs` | A11 (F3) -- the STRICT half of the attempt-identity guard: a notification whose `reference` carries NO attempt suffix at all (the bare pre-F3 `VSO-{vendorSubmissionId}` shape, trivially attacker-constructible from the public vendorSubmissionId) against an order that HAS a real attemptId must be REJECTED, not fallback-accepted -- distinct from A7, which only exercises a suffix that parses but mismatches. Added 2026-09-02 after @dev's first F3 pass left exactly this case open (see "F3 migration window" below for why the loophole existed and why it is now closed). |
| `contracts/harness/route-runner/fixture-vendor-payment-confirmation.mjs` | Extended with `setVendorPaymentConfirmationShouldHang()` (F2) and `setVendorPaymentConfirmationRejectMessage()` (F5) -- backward compatible, both default to today's existing behaviour, verified against `contract-vendor-payment-confirmation.yaml`'s own checks after the edit. |
| `contracts/harness/route-runner/fixture-vendor-payment-admin-notice.mjs` | Same two additions, symmetric: `setVendorPaymentAdminNoticeShouldHang()` / `setVendorPaymentAdminNoticeRejectMessage()`. |

## Files (F6-F8 additions, 2026-09-02)

| File | Role |
|---|---|
| `contracts/checks/vendor-stand-payment-confirm-gate/check-transaction-retry-does-not-lose-settlement.mjs` | A12 (F6) -- a genuine payment whose confirmation is duplicated by a simulated Firestore transaction retry, with the retried attempt reporting a transient confirm failure, must never be both left unsettled and acknowledged 200. Implementation-agnostic between this feature's two allowed fixes. |
| `contracts/checks/vendor-stand-payment-confirm-gate/check-attempt-reference-fits-ozow-field-limit.mjs` | A13 (F7) -- the real per-attempt reference minted for a production-length (20-char) vendorSubmissionId must stay within Ozow's documented 50-char TransactionReference cap, with 5 characters of margin. |
| `contracts/checks/vendor-stand-payment-confirm-gate/check-verification-failure-reference-redaction.mjs` | A14 (F8) -- an attacker-controlled reference on a notification that fails signature verification must never leak an embedded email address to `console.error` verbatim. |
| `contracts/harness/route-runner/fixture-firestore.mjs` | Extended with `simulateTransactionRetries(count)` -- a one-shot control that makes the NEXT `runTransaction()` call replay its callback `count` extra times, discarding each replayed attempt's Firestore writes while still letting non-Firestore side effects (e.g. `confirmNotification()` calls) run for real, before the final committing attempt whose writes apply exactly as the pre-F6 fixture always did. Backward compatible -- defaults to 0 extra retries (today's exact original behaviour) for every check that predates this addition. |
| `contracts/harness/route-runner/fixture-payments.mjs` | Extended with `setConfirmNotificationResultSequence(values)` -- lets each successive `confirmNotification()` call within ONE check see a DIFFERENT `ConfirmResult` (index-based, last value repeats once exhausted). `null`/unset (the default) falls back to the pre-existing static `confirmNotificationResult`/`setConfirmNotificationResult()` path unchanged -- backward compatible. |

## Files (F1)

| File | Role |
|---|---|
| `contracts/contract-vendor-stand-payment-confirm-gate.yaml` | This contract. |
| `contracts/checks/vendor-stand-payment-confirm-gate/check-confirm-gate-wiring.mjs` | A2 -- source-level discriminator: confirm called, before the write, unconfirmed result returns before the write. Self-tested against 3 known-bad fixtures + 1 positive control. |
| `contracts/checks/vendor-stand-payment-confirm-gate/check-unconfirmed-blocks-settlement.mjs` | A3 -- behavioural crux: unconfirmed does not settle + zero emails; genuinely confirmed redelivery settles normally; further duplicate stays at zero additional emails. |
| `contracts/checks/vendor-stand-payment-confirm-gate/check-not-configured-fails-closed.mjs` | A4 -- `reason: 'not-configured'` (the real Ozow guard shape) fails closed exactly like any other unconfirmed reason. |
| `contracts/checks/vendor-stand-payment-confirm-gate/check-confirm-call-ordering.mjs` | A5 -- confirmNotification() is never called when an earlier guard (amount mismatch, already-settled duplicate) has already rejected the notification. Passes vacuously pre-fix (0 calls because confirm is never called at all) -- documented, not hidden; becomes load-bearing once A2's fix lands. |
| `contracts/harness/route-runner/fixture-payments.mjs` | Extended (not authored) with `setConfirmNotificationResult()` / `confirmNotificationCalls` -- backward compatible, default unchanged (`{ confirmed: true }`), verified against the existing `vendor-payment-confirmation` mission's own checks after the edit. |
