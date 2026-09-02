# Vendor payment confirmation — decision record

## Status (2026-09-02, fifth architect pass — A2 rewritten for F6's two-transaction topology)

F6 (mission vendor-stand-payment-confirm-gate, mandated by the team lead) moved
`paymentProvider.confirmNotification()` OUTSIDE and BEFORE `db.runTransaction(...)` — a real
security fix: with confirm running inside the retried transaction callback, a Firestore
contention retry could genuinely confirm a payment on a discarded attempt and then see a
transient failure on the committing retry, silently and permanently losing a real settlement
while still acking HTTP 200. That restructuring gives the `'paid'` branch its own
`db.runTransaction(...)` block nested inside `if (status === 'paid')`, and the
`'failed'`/`'cancelled'` branch its own SEPARATE `db.runTransaction(...)` block for the same
read-then-write atomicity — TWO transaction blocks where A2 previously hardcoded an assumption
of exactly one. `@dev` could find no topology satisfying the OLD A2's literal "one transaction,
zero reads after it closes" wording without either putting `confirmNotification()` back inside a
transaction (reintroducing the exact defect F6 fixes) or writing dead code purely to satisfy a
regex, and correctly stopped and escalated rather than gaming the check.

**A2 rewritten to assert the INTENT, not the retired shape.** The two real properties A2 exists
to protect are unchanged and were NOT weakened:

1. Both email sends fire from inside the SAME `if (paidNotice)` block, each wrapped in
   `deliverConfirmationEmailAfterCommit`, strictly outside any transaction — kept exactly as
   strict as before, now checked against ALL `db.runTransaction(...)` blocks in the file rather
   than only the first one found.
2. The anti-stale-read property — `contactEmail` (and the rest of `PaidNotice`) must never be
   re-fetched via a post-commit re-read of `submissionRef` — re-scoped from "no
   `transaction.get`/`.get()` of `submissionRef` OR `standOrderRef` anywhere after the file's
   FIRST transaction block closes" to "no read of `submissionRef` anywhere OUTSIDE a
   transaction, after the SETTLEMENT transaction (the one that actually contains the
   `submissionRef` read and populates `paidNotice`) closes." This still forbids exactly the
   real defect (a bare, non-transactional re-read for notification data) while no longer
   flagging the file's own second, legitimate, entirely unrelated failed/cancelled transaction
   for merely existing.

**A2 deliberately no longer constrains transaction COUNT.** The old "`db.runTransaction`
appears in exactly one place, nothing reads `submissionRef`/`standOrderRef` after it closes"
rule was true only of the pre-F6 single-transaction topology and would reject the correct,
mandated F6 shape. Do not restore it — any future check-writer against this file must locate
"the settlement transaction" by CONTENT (does it contain `transaction.get(submissionRef)`?),
never by position ("the first/only transaction block"), and must never treat "how many
`db.runTransaction` blocks exist" as a proxy for correctness on its own.

**A latent bug found and fixed while rewriting, unrelated to the topology change itself:**
`findCallSites`'s original (and this rewrite's first draft's) lazy `[\s\S]*?` regex, used to
locate each `deliverConfirmationEmailAfterCommit(() => ... fnName(` call site, can match
STARTING at one wrapper and lazily consume forward across that wrapper's own closing paren into
a SECOND, unrelated wrapper further down the file, before finally reaching the target function
name — collapsing both functions' detected call-site index onto the position of the FIRST
wrapper. This silently blinded requirement (e)'s block-identity check the first time an actual
two-block RED mutation was attempted in this pass (see below) — the check passed GREEN against
a file where the vendor send had genuinely been moved into a second, separately-gated
`if (paidNotice)` block, because both functions' "call site" resolved to the SAME index. Fixed
by replacing the lazy match with `findCallSites`/`findWrappedCallSpans`, both PAREN-MATCHED
(brace/paren-depth counting, not regex laziness) so each wrapped call is scoped to its own body.
Re-verified after the fix: the same mutation now correctly fails with
`"...are gated by TWO SEPARATE `if (paidNotice)` blocks..."`. This bug was latent in the
ORIGINAL (pre-rewrite) A2 too — it never surfaced there because the pre-F6 topology never
actually produced two nearby wrapped calls with a genuine block split to test against.

**RED-mutation re-verification against the real file, per the team lead's explicit request,
captured exit codes:**

- **Defect (i) — a send moved outside the `if (paidNotice)` block** (relocated the vendor
  receipt's construction AND call site into a second, separately-gated `if (paidNotice)` block
  instead of sharing the admin notice's block): **RED, exit 1**, `"sendVendorPaymentAdminNoticeEmail
  and sendVendorPaymentConfirmationEmail are gated by TWO SEPARATE `if (paidNotice)` blocks, not
  the same one -- they must share a single block"`. Reverted from backup, `md5`/`diff` confirmed
  byte-identical (`483f1a1841e15276690491847e0ff5f5`), re-ran: **GREEN, exit 0.**
- **Defect (ii) — a post-commit re-read of the submission used to source the receipt's
  recipient** (added a fresh, non-transactional `await submissionRef.get()` immediately before
  the `if (paidNotice)` block): **RED, exit 1**, `"a read of submissionRef occurs after the
  settlement transaction closes, outside of any transaction -- contactEmail must come from the
  in-transaction read, never a post-commit re-fetch"`. Reverted from backup, `md5`/`diff`
  confirmed byte-identical, re-ran: **GREEN, exit 0.**

**Full A1-A8 sweep after the rewrite, all exit 0** (A3's recipient-independence property
specifically re-confirmed against `@dev`'s F6-restructured file, not just A2's own structural
check):

```
A1 pnpm type-check          exit 0
A2 wiring discriminator     exit 0
A3 settlement/recipients    exit 0
A4 failure isolation        exit 0
A5 no-PII-in-logs           exit 0
A6 links use SITE_URL       exit 0
A7 pnpm lint                exit 0 (0 errors, 96 pre-existing warnings unrelated to this feature)
A8 missing contactEmail     exit 0
```

`lib/vendor-stand-payment-notification.ts` confirmed byte-identical to `@dev`'s F6/F8-landed
state (`md5` `483f1a1841e15276690491847e0ff5f5`) before and after every mutation in this pass —
only `contracts/checks/vendor-payment-confirmation/check-notification-wiring.mjs` and this
README were edited.

## Status (2026-09-02, fourth architect pass — F3 reference-shape fix)

`@dev` landed F3 (mission vendor-stand-payment-confirm-gate) between the third architect pass
and this one: `lib/vendor-stand-payment-notification.ts` gained an attempt-identity guard — a
notification's `reference` must carry F3's per-attempt suffix once the order has an
`attemptId`; a bare `VSO-{vendorSubmissionId}` reference (no attempt suffix) is now REJECTED
instead of silently accepted as a fallback (F3's own A11 gates this; it was previously an
attacker-constructible bypass). This broke three of this contract's checks, which had all
hardcoded a bare `VSO-{id}` / `VSO-${vendorSubmissionId}` literal as the ITN `reference` — not
because the checks' properties were wrong, but because their FIXTURES assumed a reference shape
F3 correctly retired. **The production code was right; the fixtures were stale.**

**Fixed by capturing the REAL minted reference from the route-runner harness's
`fixture-payments.mjs` `initiateCalls` log** (`initiateCalls.at(-1)?.reference`, throwing if
absent) instead of hardcoding a literal — the same pattern the sibling
`vendor-stand-payment-confirm-gate` contract's six checks already used to absorb this same F3
change. No special-casing, no bypass of the new guard: every scenario now genuinely drives a
real `initiate` call first and uses whatever reference shape that call actually produces,
whatever it is.

- **A3** (`check-settlement-sends-both-emails.mjs`) — `seedPendingOrder` now captures and
  returns `initiateCalls.at(-1)?.reference`; both the settlement scenario and the
  stale-order-email scenario's ITN calls use the captured reference instead of hardcoded
  `'VSO-sub-both-emails'` / `'VSO-sub-stale-email'`.
- **A4** (`check-failure-isolation.mjs`) — `seedPendingOrder` likewise captures/returns the real
  reference; both Scenario A (`referenceA`) and Scenario B (`referenceB`) call sites use it
  instead of hardcoded `'VSO-sub-vendor-fails'` / `'VSO-sub-admin-fails'`.
- **A8** (`check-missing-contact-email.mjs`) — `runScenario` now captures `reference` from
  `initiateCalls` right after `initiatePost` succeeds and passes it to the ITN payload instead
  of the hardcoded `` `VSO-${vendorSubmissionId}` `` template literal, for both the empty-string
  and whitespace-only scenarios.

**Each fix was re-verified against its OWN original RED mutation, live against the real file,
with captured exit codes — not just re-run for a bare PASS:**

- **A3** — the real `contactEmail` capture line was mutated to a hardcoded
  `'attacker@evil.example'` (the recipient-swap defect this check exists to catch): **RED,
  exit 1**, both the base recipient-correctness assertion and the stale-order-email
  source-of-truth assertion cited the injected attacker address by name. Reverted from backup,
  `md5`/`diff` confirmed byte-identical, re-ran: **GREEN, exit 0.**
- **A4** — no live-mutation RED-verify existed for this check before this pass (flagged as an
  open gap in the third-pass Status section below). Closed here: the real file's two
  independently-wrapped sends were mutated into a SINGLE `deliverConfirmationEmailAfterCommit`
  call where the vendor receipt is awaited INSIDE the admin-notice's own wrapped function,
  before the admin send is even attempted — exactly the coupling A4 exists to forbid ("one
  failing email must never take the other down"). Result: **RED, exit 1, 3 failures** — "vendor
  receipt... got 2 attempt(s)" (Scenario A's own send plus the leaked cross-scenario retry),
  "admin notice... got 0 admin notice(s), expected 1" (proving the coupling: a rejecting vendor
  send now genuinely prevented the admin send from ever being attempted), and a symmetric
  Scenario B failure. Reverted from backup, `md5`/`diff` confirmed byte-identical, re-ran:
  **GREEN, exit 0.**
- **A8** — re-ran ITS OWN already-documented guard-widening mutation (see the third-pass Status
  section below) against the reference-fixed check: real capture guard widened from
  `if (submission?.businessName && submission.contactPersonName)` to also require
  `submission.contactEmail?.trim()`. Result: **RED, exit 1, 4 failures** (both scenarios' admin
  notice-count and error-log-count assertions), identical failure shape to the third-pass
  finding. Reverted from backup, `md5`/`diff` confirmed byte-identical, re-ran: **GREEN,
  exit 0.**

**Full A1-A8 sweep after all three fixes, all exit 0:**

```
A1 pnpm type-check          exit 0
A2 wiring discriminator     exit 0
A3 settlement/recipients    exit 0
A4 failure isolation        exit 0
A5 no-PII-in-logs           exit 0
A6 links use SITE_URL       exit 0
A7 pnpm lint                exit 0 (0 errors, 96 pre-existing warnings unrelated to this feature)
A8 missing contactEmail     exit 0
```

`lib/vendor-stand-payment-notification.ts` confirmed byte-identical to `@dev`'s F3-landed state
(`md5` `960b3aebf4381c90ab86380ad9b95f8b`) before and after every mutation in this pass — this
architect pass touched only files under `contracts/`.

**Note for whoever next writes or edits a check against this route:** every ITN/notification
`reference` this contract's fixtures construct MUST come from the real
`initiateCalls.at(-1)?.reference` captured after a genuine `initiate` call — never a hardcoded
`VSO-{id}` (or any other guessed) literal. F3's per-attempt suffix means a hand-built reference
string will not match what the real code accepts, and re-hardcoding it here would silently
reintroduce this exact defect class the next time an upstream feature changes the reference
shape again. This mirrors the sibling `vendor-stand-payment-confirm-gate` contract's own
established pattern — see its checks for the reference implementation.

## Status (2026-09-02, third architect pass — A8 closed)

The team lead flagged that A8's feature text ("A8 proves this branch behaviourally") existed
without a corresponding check script or `assertions.checks` entry — a real gap, since the
missing-contactEmail branch was implemented but ungated. Fixed:

- `contracts/checks/vendor-payment-confirmation/check-missing-contact-email.mjs` rewritten to
  cover BOTH an empty-string contactEmail AND a whitespace-only contactEmail (the case most
  likely broken by a future refactor, since `@dev`'s real capture is
  `submission.contactEmail?.trim() || null` — dropping the `.trim()` alone would silently pass a
  whitespace value through as truthy). Reuses the existing A3/A4 fixtures, no new fixtures added.
- Added `containsSubmittedPii()`, self-tested inline against three known-bad synthetic log lines
  and one known-clean line, coordinating with A5's own definition of "submitted PII"
  (businessName/contactPersonName/contactEmail) rather than reimplementing a separate one — see
  the check's own header comment for the full coordination note (A8 cannot hold A5's "zero
  console.* calls" rule, since `lib/vendor-stand-payment-notification.ts` legitimately logs for
  many unrelated reasons; A8 instead scans the ONE missing-contactEmail log line's arguments for
  an absence of PII values).
- `A8` is confirmed present in `contracts/contract-vendor-payment-confirmation.yaml`'s
  `assertions.checks` list (`python3 -c "import yaml; ..."` confirms all eight ids A1-A8 parse
  correctly from the file).
- **Live mutation RED-verified against the real file**, per the team lead's explicit request for
  a captured exit code, not just a fixture self-test: backed up
  `lib/vendor-stand-payment-notification.ts` (md5 `999a8390926754fdce41a27ac1963587`), changed
  the real capture guard from `if (submission?.businessName && submission.contactPersonName)` to
  `if (submission?.businessName && submission.contactPersonName &&
  submission.contactEmail?.trim())` — the exact regression the team lead named — ran A8:
  **exit code 1, 4 failures** (both scenarios' admin-notice-count and error-log-count
  assertions). Restored from backup, verified byte-identical via `md5` (same hash) and an empty
  `diff`, re-ran A8: **exit code 0, GREEN.**

All eight assertions (A1-A8) re-confirmed GREEN after this pass, `lib/vendor-stand-payment-
notification.ts` left byte-identical to `@dev`'s implementation (confirmed via `md5`/`diff`
before and after every mutation in this and the prior pass).

## Status (2026-09-02, second architect pass)

The team lead read the real `lib/vendor-stand-payment-notification.ts` directly and corrected
three assumptions in this contract's first draft (full corrections in "Ground truth corrections"
below). While this contract was being revised, `@dev` implemented the feature concurrently —
`lib/vendor-payment-confirmation.ts`, `emails/VendorPaymentConfirmation.tsx`, and the
`lib/vendor-stand-payment-notification.ts` edit all already exist and match the corrected spec
closely. All eight assertions (A1-A8, including the two added for the corrections — A8, and the
stale-order-email scenario folded into A3) were re-run against the real implementation after
revision:

```
A1 pnpm type-check         PASS
A2 wiring discriminator    PASS
A3 settlement/recipients   PASS
A4 failure isolation       PASS
A5 no-PII-in-logs          PASS
A6 links use SITE_URL      PASS
A7 pnpm lint                PASS (0 errors, 96 pre-existing warnings unrelated to this feature)
A8 missing contactEmail    PASS
```

Each assertion's `description` field in the contract still records the RED evidence observed
against the pre-implementation file — that is provenance proving the checks weren't vacuously
green from the start, not a claim that they are currently failing.

Source: the team lead's direct message (2026-09-02), which verified the gap in source before
dispatching — `lib/vendor-stand-payment-notification.ts`'s `if (paidNotice)` block (~line 203)
fires exactly ONE email, `sendVendorPaymentAdminNoticeEmail`, to the admin allowlist. The vendor
who just paid gets nothing. Also consulted: `lib/vendor-stand-payment-notice.ts` +
`emails/VendorStandPaymentReady.tsx` (the BEFORE-payment "pay now" email — same injectable-fake
mailer pattern, same absolute no-PII-in-logs rule); `lib/vendor-payment-admin-notice.ts` +
`emails/VendorPaymentAdminNotice.tsx` (the admin notice this sits beside);
`docs/vendor-flow-notifications.md`; `contracts/contract-vendor-flow-notifications.yaml` +
`contracts/golden/vendor-flow-notifications/README.md` (the contract style this mirrors,
including its own two accepted limitations); `app/api/vendors/stand-payment/initiate/route.ts`
(the `vendorStandOrders` document's real write shape).

## What this feature is

One new file pair, one edit. Zero new Firestore collections, zero new Firestore reads.

**New sender:** `lib/vendor-payment-confirmation.ts` + `emails/VendorPaymentConfirmation.tsx` —
a receipt sent to the vendor's own `contactEmail` when their stand payment settles, confirming
the business name, booth size, amount paid, and the `standOrderRef` they can quote to the show
office.

**One edit:** `lib/vendor-stand-payment-notification.ts` fires this new send ALONGSIDE the
existing admin notice, both independently wrapped in the real
`lib/confirmation-email.ts` `deliverConfirmationEmailAfterCommit`, both strictly outside the
settlement transaction.

## Ground truth corrections (2026-09-02, team lead's direct read of the real file)

This contract's first draft assumed `contactEmail` should be sourced from the `vendorStandOrders`
document (`order.contactEmail`, written once at initiate time), reasoning that the doc already
carries it and no second read would be needed. **The team lead read the real
`lib/vendor-stand-payment-notification.ts` directly and corrected this**, with three concrete
findings that changed what the goldens assert:

1. **`PaidNotice` (line ~45 in the pre-feature file) carries only `businessName`,
   `contactPersonName`, `standOrderRef` — never an email address.** `contactEmail` must be added
   to the EXISTING `transaction.get(submissionRef)` read (line ~165), not a second fetch, and —
   the more important correction — **not `order.contactEmail` at all.** `order.contactEmail` is
   a snapshot copied once at `/api/vendors/stand-payment/initiate` time; if the vendor's contact
   details change between initiating payment and the gateway actually settling it (a real gap —
   PayFast/Ozow settlement can take minutes to days), `order.contactEmail` is stale while
   `submission.contactEmail` is current. The receipt must go to the vendor's CURRENT address.
   `boothSize` and `amount`, by contrast, genuinely have no submission-side counterpart — they
   are order-time-only fields chosen at initiate — so `order` remains their only correct source;
   there is no staleness question for those two. `A3`'s stale-order-email scenario proves this
   sourcing decision behaviourally (seeds a stale `order.contactEmail`, then changes the
   submission's `contactEmail` before settling, and asserts the receipt uses the FRESH
   submission value) — a naive "add contactEmail to the order cast and read it from there"
   implementation would have shipped the SAME defect class as the 2026-09-01 hosted.app
   incident: technically working, silently wrong under a real-world timing gap.
2. **The existing capture guard (`if (submission?.businessName && submission.contactPersonName)`)
   must NOT be widened to require `contactEmail` too** — a submission with a missing/blank
   `contactEmail` must still let the admin notice fire (it has nothing to do with whether a
   vendor address exists); only the vendor receipt is skipped, with one non-PII error naming the
   submission id. `A8` proves this behaviourally.
3. **The vendor send must live inside the SAME `if (paidNotice) { ... }` block as the admin
   send**, not a second, independently-gated block — `A2`'s wiring discriminator was revised to
   enforce this structurally (brace-matched block-identity check), plus that
   `transaction.get(submissionRef)` appears exactly once in the file and no read of
   `submissionRef`/`standOrderRef` occurs after the transaction closes (rules out a "just
   re-fetch it after commit" mistake).

## Zero new Firestore round-trips, despite the correction

Even with `contactEmail` sourced from `submission` rather than `order`, this feature still adds
**zero new Firestore reads**: the EXISTING `transaction.get(submissionRef)` read (line ~165,
already there for `businessName`/`contactPersonName`) is simply widened to also capture
`contactEmail`, and the EXISTING `transaction.get(standOrderRef)` read (already there for the
gateway/idempotency/amount checks) is widened to also capture `boothSize`. No second fetch, no
new failure surface, no new step in Firestore's read-before-write-in-one-transaction ordering.

## What the receipt does NOT carry, and why

The team lead asked to flag any field a proper receipt ought to have but doesn't exist in the
data today. Checked directly against `app/api/vendors/stand-payment/initiate/route.ts`'s write
and `lib/vendor-stand-pricing.ts`:

- **No invoice number.** Nothing in `vendorStandOrders` or anywhere in the vendor-payment path
  mints a sequential/human-readable invoice number. `standOrderRef` (`VSO-<vendorSubmissionId>`)
  is the only stable reference and is what this receipt uses — it identifies the order but is
  not an invoice number in the accounting sense.
- **No VAT line/VAT number.** No `vatNumber`, `vatAmount`, or `vatRate` field exists anywhere in
  the vendor stand-payment or pricing surfaces (`lib/vendor-stand-pricing.ts`'s six confirmed
  prices are flat rand figures with no tax breakdown recorded). If SAOC needs to show VAT on
  vendor receipts, that is a pricing-model change (a new field on the order doc, plus a
  decision on whether SAOC's stand fees are VAT-inclusive/exclusive/exempt) — out of scope here,
  and NOT invented as a silent placeholder.
- **No payment method/last-4 card digits.** The gateway notification
  (`notification.gatewayPaymentId`) is the only payment-identifying data captured; the ITN
  payload from PayFast/Ozow does not reliably carry a card-brand/last-4 in the shape this
  project parses (`lib/payments/*`), so none is rendered.
- **The tier (early-bird vs regular) is available** (`order.tier`) but deliberately NOT surfaced
  on the receipt — the amount actually paid is what matters to a receipt; whether it reflects an
  early-bird discount is a pricing-page concern, not a payment-confirmation concern. Not adding
  it is a minimal-scope call, easy to revisit if wanted.

## Recipients — correctness and independence

The vendor receipt sends to `input.contactEmail` — sourced from the `vendorStandOrders`
document's own `contactEmail` field (itself copied from the vendor's submission at initiate
time), NEVER from `getVendorAdminNotifyRecipients()`. `lib/vendor-payment-confirmation.ts` does
not import `lib/vendor-admin-notify-recipients.ts` at all — there is no path by which an admin
address could end up in this module's `to:`. The admin notice continues, entirely unchanged, to
resolve its own recipients via the real `getVendorAdminNotifyRecipients()` inside
`lib/vendor-payment-admin-notice.ts`. `A3` proves this behaviourally, not just structurally: it
independently re-resolves the real admin allowlist and asserts the vendor's `contactEmail` never
appears in it (test-setup sanity), that the vendor receipt's captured `contactEmail` exactly
equals the seeded vendor address, and that the admin notice's own input object never carries
that address as a field.

## Idempotency — the highest-value property here

Both sends are gated by the SAME `if (paidNotice)` block the existing admin notice already uses,
and `paidNotice` is populated ONLY on the branch that actually performs the paid-transition
write, inside a transaction that has its own `if (order?.status !== 'pending') return;` early
return for anything already settled. `paidNotice` is reset to `null` at the top of every
transaction attempt (a load-bearing existing property, fixed the night before this mission per
the team lead's message) — so a duplicate/replayed ITN for an already-`'paid'` order takes the
early-return branch, never reaches the `paidNotice = {...}` assignment, and the
`if (paidNotice)` block after the transaction resolves to a no-op for BOTH emails. No new
idempotency logic was written for this feature — it inherits the existing guard entirely. `A3`
proves this is real, not assumed: it drives a genuine settlement, then TWO further duplicate
ITNs (one replaying the exact same payload object, one a fresh object with identical field
values, to rule out an "identical object reference" shortcut), and asserts zero additional sends
of either email after the first.

## Failure isolation — neither email can take the other down

`A4` proves, via the real route-runner harness, that a rejecting vendor-receipt mailer still
lets the gateway acknowledge 200, still lets the order settle to `'paid'`, and still lets the
independent admin notice fire — and the symmetric case, where a rejecting admin-notice mailer
does not suppress the vendor's own receipt. This is the same "money is more important than a
delivery receipt" property `lib/confirmation-email.ts`'s `deliverConfirmationEmailAfterCommit`
already generically guarantees (proven once by ticketing-foundation F10/F11) — `A4`'s job is
only to prove this feature's TWO new/edited call sites didn't reintroduce a coupling between
them, not to re-prove the wrapper itself.

## The link judgement call

The spec text (via the team lead) didn't name a specific link target, only that "every link ...
resolves to beta.saoc.co.za." A payment receipt with zero links reads as incomplete, so this
feature includes exactly ONE: `${siteUrl}/national-show` — the existing, real show-overview
page. Considered and rejected: a per-order "view my booking" deep link (no such page exists in
this repository — same "don't invent a 404" reasoning `contracts/golden/vendor-flow-
notifications/README.md`'s "review-link judgement call" already documents for the admin-notice
links); a link back to the payment-initiate flow (meaningless post-payment, and the payment
token is already single-use/spent by this point per M3's token design). `${siteUrl}/national-show`
is the smallest true thing to link to — real, public, no auth required, no 404 risk.

## What this contract does NOT prove

- **A real Resend delivery.** Every check is offline/credential-free, fixture mailers only, same
  posture as every prior vendor-email contract in this project.
- **That `SITE_URL` itself holds the correct runtime value.** `A6` proves the link is built FROM
  a `siteUrl`/`resolveSiteUrl()` variable, never a hardcoded literal — it is a source-text check
  and cannot and does not prove the variable's deployed VALUE is correct. On 2026-09-01, a
  `hosted.app` URL shipped in this project's vendor emails precisely because `SITE_URL` itself
  was wrong in the deployed environment, while every check of A6's shape stayed green throughout
  — the variable really was being used correctly; only its value was wrong. **Only reading a
  delivered email, or a runtime assertion against the actual resolved
  `process.env.SITE_URL` value in the deployed environment, can catch that class of defect.**
  Flagged explicitly here rather than silently omitted, per the team lead's instruction.
- **A3/A4/A8 have now been observed to pass** (see "Status" above — `@dev` implemented
  concurrently with this contract's revision). **A3 was additionally proven to CATCH a real,
  live mutation**, per this project's "mutate, confirm RED, revert, confirm clean" standing
  instruction: `lib/vendor-stand-payment-notification.ts`'s real `contactEmail` capture line was
  changed from `submission.contactEmail?.trim() || null` to a hardcoded
  `'attacker@evil.example'` (exactly the recipient-swap defect class the team lead named as the
  property that "actually earns its keep"). `A3` went RED with both expected failures (the
  base recipient-correctness assertion, AND the stale-order-email source-of-truth assertion,
  both citing the injected attacker address by name); `A2` correctly stayed GREEN against the
  same mutation (it is a structural check and this is not a structural defect — a useful
  confirmation that A2 and A3 are covering genuinely different failure modes, not duplicating
  each other). The file was then restored from a pre-mutation backup and verified byte-identical
  via `md5` (`999a8390926754fdce41a27ac1963587` before and after) and an empty `diff`, and A3
  was re-run and confirmed GREEN again. **A8 was likewise proven to CATCH a real, live
  mutation** in the third architect pass (see "Status" above) — the exact guard-widening
  regression the team lead named — going RED with exit code 1 (4 failures) and back to GREEN
  (exit code 0) after revert, same md5/diff verification. **A2's structural checks
  (single-block, single-read, no-post-commit-read) and A4's specific failure-isolation
  scenarios were NOT independently mutation-tested against the real file** — only against their
  own inline frozen fixtures — so a reintroduced double-send or a split `if (paidNotice)` block
  remain unverified against the REAL file specifically (verified only against synthetic
  fixtures). Whoever runs QA next should extend this same mutate/revert exercise to A2/A4 before
  fully trusting a GREEN result on those two specific properties — this project's own audited
  "assertion
  satisfiable by something that isn't the real property" defect class (see `.agent/memory/project/
  learned.md` and `contracts/golden/vendor-flow-notifications/README.md`'s "Two accepted
  limitations") is exactly what this precaution exists to catch, and it has previously produced
  five separate instances of checks that stayed green under a real, injected defect.
- **The email template's exact rendered pixels/copy quality.** No visual/snapshot check exists
  for `emails/VendorPaymentConfirmation.tsx` — matches this project's existing posture for every
  other vendor-email template (no visual check exists for any of them either).
- **An invoice number or VAT line**, because neither exists in the data today — see "What the
  receipt does NOT carry" above.

## Harness change, made in service of this contract (not touching `lib/`)

`contracts/harness/route-runner/preload.cjs` gained two new `OVERRIDES` entries —
`@/lib/vendor-payment-confirmation` → the new `fixture-vendor-payment-confirmation.mjs`, and
`@/lib/vendor-payment-admin-notice` → the new `fixture-vendor-payment-admin-notice.mjs` — so
`A3`/`A4` can count and inspect both settlement emails deterministically, without a network call
or a `RESEND_API_KEY`. Before this change, a route-runner check driving a real `'paid'` ITN
through `lib/vendor-stand-payment-notification.ts` exercised the REAL
`lib/vendor-payment-admin-notice.ts`, which called the REAL `sendEmail()` (Resend) — silently
rejecting in this environment and getting swallowed by
`deliverConfirmationEmailAfterCommit`'s `onError`. This was harmless for
`contracts/checks/vendor-gated-registration-flow-m3/check-settlement-idempotent-and-guarded.mjs`
(re-run after this change to confirm: still PASSes, unchanged assertions, see that check's own
output), which never asserted on email counts — but it meant the admin-notice send had never
actually been behaviourally exercised end-to-end by any check in this repository before this
mission. Neither new fixture nor the `preload.cjs` edit touches
`lib/vendor-stand-payment-notification.ts` or any other file under `lib/`, `app/`, or `emails/` —
everything added by this architect pass lives under `contracts/`.
