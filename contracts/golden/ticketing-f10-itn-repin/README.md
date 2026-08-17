# F10 — Folded ITN re-pin ceremony: decision record

Mission `ticketing-foundation`, feature F10 (spec §6, §11). This is the single authorised
reopening of the sha256-pinned `app/api/tickets/itn/route.ts` for this mission. Everything
below was read and verified by architect against the actual current source, not assumed from
the mission brief — where the brief's wording turned out to be imprecise, that is called out
explicitly rather than silently re-derived, matching F1's precedent
(`contracts/golden/ticketing-f1-show-collision/README.md`).

**Sandbox only.** `PAYFAST_SANDBOX_PASSPHRASE` and every merchant identifier used anywhere in
this contract's checks are obviously-fake test values (`test-passphrase-not-real`,
`TEST-MERCHANT-00000001`) — never a real PayFast credential, and this project has never used
production PayFast. No check reads a real environment variable, makes a network call, or writes
to Firestore.

---

## The four defects, each with its file:line citation and catching assertion

### Defect 1 — inbound signature verification used the wrong algorithm

**File:line:** `app/api/tickets/itn/route.ts:89` (guard 1) and `:193` (guard 4, server-confirm
body), read on 2026-08-17.

```ts
// :89 (before F10)
const expectedSignature = generateSignature(fields, passphrase);
// :193 (before F10)
body: buildPayfastParamString(fields),
```

`generateSignature`/`buildPayfastParamString` (`lib/payfast.ts`) implement PayFast's
**outbound** (checkout-signing) algorithm: insertion order, **skip blank fields**, **trim()**
every value. PayFast's own docs (`contracts/golden/payfast-itn-signature/
inbound-algorithm.golden.md`, fetched verbatim 2026-08-15) specify a genuinely different
**inbound** (ITN-verification) algorithm: posted order, **no blank-skip**, **no trim**. Real
PayFast ITN bodies always contain blank fields (`name_last`, `custom_str1..5`,
`custom_int1..5`, frequently `item_description`) — recomputing with the outbound builder
produces a digest that can never match, which is documented (`docs/payfast-itn-signature.md`)
as the reason every real sandbox ITN sent to this project has been rejected at guard 1, even
though the payment genuinely completed. This is not new work: `generateNotifySignature`/
`buildPayfastNotifyParamString` already exist in `lib/payfast.ts`, built and contract-tested
by `contracts/contract-payfast-itn-signature.yaml` (still present, still valid — F10
supersedes only its two blocked assertions, A5/A6, which required the pin lifted; its A1-A4/
A7-A8 already prove the library functions correct and remain the authority on that). They were
simply never wired into the pinned route, because wiring them requires reopening a pinned file
— exactly what F10 is authorised to do.

**Catching assertion:** A3 (`check-signature-brutal.mjs`) — 8 cases, described below.

### Defect 2 — `parseOrderedFields` `continue`-vs-`break` divergence

**File:line:** `app/api/tickets/itn/route.ts:69`, read on 2026-08-17.

```ts
for (const [key, value] of params) {
  if (key === 'signature') {
    signature = value;
    continue;   // <- pre-F10
  }
  fields[key] = value;
}
```

**CORRECTION, stated plainly rather than reproduced from the brief:** the mission brief
describes this as "a control-flow bug involving a `break`". Reading the file shows the CURRENT
code already uses `continue`, not `break` — there is no `break` anywhere in
`app/api/tickets/itn/route.ts` today (`grep -n break app/api/tickets/itn/route.ts` matches only
a prose comment, not a statement). This is **not** a live signature-forgery bug: PayFast always
posts `signature` last in the ITN body, so `continue` (process every remaining key) and `break`
(stop at `signature`) are behaviourally identical for every real ITN this project has ever
received or will receive under PayFast's documented posting convention.

It **is** a genuine divergence from PayFast's own documented reference implementation, which
uses `break`:

```php
foreach( $pfData as $key => $val ) {
    if( $key !== 'signature' ) {
        $pfParamString .= $key .'='. urlencode( $val ) .'&';
    } else {
        break;
    }
}
```

`docs/payfast-itn-signature.md`'s own "Known Remaining Defect" section (written 2026-08-16, one
day before this contract) already identified this and left it unfixed pending the re-pin
ceremony — F10 is that ceremony. The practical risk of leaving `continue` in place is
**availability, not forgery**: if a field ever arrived after `signature` in a future PayFast
posted-order change, `continue` would include it in the recomputed digest while PayFast's own
`break`-based algorithm never would have — a **genuine, valid** ITN would then fail signature
verification and be silently (from PayFast's perspective) rejected. Failing closed on a real
payment is the wrong kind of "safe" here (it produces an unreconciled payment, logged but not
auto-recovered) — matching the exact algorithm removes the fragility rather than merely hoping
PayFast's field order never changes.

**Fix:** `continue` → `break`. `parseOrderedFields` is also exported (its only signature
change) so this property is unit-testable without an HTTP round trip.

**Catching assertion:** A4 (`check-break-fix-field-order.mjs`) — case 1 (regression: ordinary
signature-last body still parses every field, including blanks, correctly) and case 2 (the
defeating case: a field posted after `signature` must NOT appear in the parsed `fields` — this
is the only observable difference between `break` and `continue`, and reverting the fix makes
this case fail while case 1 keeps passing).

### Defect 3 — no order/position two-write

**File:line:** `app/api/tickets/itn/route.ts:130-134` (the pre-F10 lookup) and `:232-253` (the
pre-F10 transaction), read 2026-08-17.

The pre-F10 route queries and transactionally updates exactly one `tickets` document — there is
no reference anywhere in the file to the `orders` collection (`grep -c orders
app/api/tickets/itn/route.ts` → `0`, verified). F2 (already shipped) introduced `orders` as the
payment source of truth, with position-level payment fields kept only for backward
compatibility (`lib/orders.ts`'s own docstring: "duplicated onto BOTH the order and the
position... until F10's backfill makes the order the sole source of truth"). F10 is that
backfill: a paid ITN must flip the order AND its position together, atomically, or the model F2
introduced is half-real.

**Fix:** `markOrderAndPositionPaidByPaymentId` (new, `lib/orders.ts`) resolves the order by
`m_payment_id` and its one child position by `orderId`, then updates both inside one
`runTransaction`. Built on the SAME primitive family F8 established
(`createOrderWithPosition`'s injectable `deps.db` pattern) rather than a parallel one — see "Why
two interface families, not one widened one" below for why this is a sibling to, not an edit of,
F8's interfaces.

**Catching assertion:** A5 (`check-order-position-atomicity.mjs`) — three cases against an
in-memory fake store, the same technique as F8's A4: success path; position-write forced to
fail (order must NOT flip either); order-write forced to fail (negative control, proving the
rollback isn't an artefact of write ordering).

### Defect 4 — no confirmation-email hookup

**File:line:** entire file, read 2026-08-17 — there is no import of, or call to, any email
function anywhere in `app/api/tickets/itn/route.ts`. `docs/ticketing-system-foundation-spec.md`
line 42 independently confirms this gap project-wide: "No confirmation email or QR exists —
`emails/TicketConfirmation.tsx` is written but imported nowhere".

**Fix:** `lib/confirmation-email.ts` (new) exports `sendConfirmationEmail()` (F10 ships a
minimal stub; F11 owns the real content) and `deliverConfirmationEmailAfterCommit()` (the
isolation wrapper). The pinned route calls the wrapper strictly AFTER
`markOrderAndPositionPaidByPaymentId` reports `committed: true` — never before, never
conditionally skipped based on email outcome, never able to affect the HTTP response.

**Catching assertion:** A7 (`check-email-failure-does-not-block.mjs`) — proves the wrapper never
propagates a send failure and always resolves, with a non-vacuous positive control (success case
must NOT call `onError`).

---

## The F10/F11 boundary

F10 owns: the hookup call site (strictly after commit, isolated by
`deliverConfirmationEmailAfterCommit`), the input shape (`SendConfirmationEmailInput`), and a
**minimal stub** implementation of `sendConfirmationEmail()` that logs the payload's *shape*
only (order id, buyer email, position count, whether a recovery token is present — **never**
the recovery token's value, never a full attendee list dump to a general log) and does not call
Resend.

F11 owns: QR generation (one inline data-URI PNG per position, at email-send time, per spec §6),
the actual email template/content, and swapping Resend in for real delivery. F11 replaces
`sendConfirmationEmail`'s body; it does **not** need to touch the pinned route again, because
F10's call site and signature are already the ceremony-authorised contract F11 builds against.

**Money is more important than a delivery receipt**, stated as the mission brief requires: an
email failure is logged (via `onError`, never silently eaten) but is structurally incapable of
rolling back, retrying, or blocking the payment write, because `deliverConfirmationEmailAfterCommit`
is called only after the transaction in step 5 has already committed, and its own contract
(A7) is to never propagate a failure.

---

## Idempotency finding

**Reported prominently, not silently added without flagging it was missing**, per the dispatch
instructions. The pre-F10 route already had SOME idempotency protection at the single-document
level (a positive `!== 'reserved'` guard, both as a pre-transaction fast path and inside the
transaction). F10 carries the identical shape to the order level in
`markOrderAndPositionPaidByPaymentId`, and A6 proves — rather than assumes — that this survives
the two-write rewrite: two identical deliveries against the same fake store produce exactly one
write per collection, unchanged `purchasedAt`/`gatewayPaymentId` after the second delivery, and
(structurally, since this path only ever updates, never creates) no possibility of a second
order or position document under any circumstance.

**What was already true and is NOT a new gap**: because this is an UPDATE-based design (not
create-based), the double-write failure mode F8's A4 exists to catch on the CREATE path
(comp-ticket issuance) cannot occur here at all — there is no code path in
`markOrderAndPositionPaidByPaymentId` that can create a new order or position document. This is
a structural property of the design, asserted by A6's final document-count check rather than
merely asserted in prose.

**What duplicate delivery does NOT protect against, named as a limit**: PayFast could in
principle deliver two ITNs for the SAME `m_payment_id` **concurrently** (not sequentially) —
both racing to read `status: 'reserved'` before either writes. This is the reason the write MUST
be a Firestore transaction and not a plain read-then-write: Firestore's transaction contract
guarantees the loser of such a race is automatically retried against the winner's now-committed
state and observes `status: 'paid'`, correctly no-opping. A6 tests SEQUENTIAL duplicate
delivery (the common, PayFast-retry-driven case) against a fake store; it does not, and cannot
offline, reproduce genuine Firestore-level concurrent-transaction contention — that guarantee is
inherited from Firestore's own transaction semantics (the same reasoning the pre-F10 route's own
comment already relied on) and is not re-proven here.

---

## The re-pin mechanism

Following the exact precedent `contracts/contract-ticketing-hardening.yaml`'s A15 established
(see that contract's comment on A15 and `contracts/golden/ticketing-hardening/
itn-route.expected.ts.txt`):

1. **Architect authors the complete new file content BEFORE any code is written.** This
   README's sibling file, `itn-route.expected.ts.txt`, IS that file — every line of the new
   `app/api/tickets/itn/route.ts` is already decided, not left to `@dev`'s discretion.
2. **Architect computes the new pin value** from that file:
   `253c15c4dc56bdf32bb7391d610d75c4e2b9ab5f5531914bd640af20f096fd8b` (verified by architect via
   `shasum -a 256` against the actual golden file in this directory — re-run that command
   yourself before trusting this value if the golden file is ever touched again).
3. **`@dev`'s only job is to make the real file byte-identical to the golden file** — e.g.
   `cp contracts/golden/ticketing-f10-itn-repin/itn-route.expected.ts.txt
   app/api/tickets/itn/route.ts` — never to retype it, and never to compute or choose the pin
   value themselves. A8 (`echo "$(cat itn-route.golden.sha256)  app/api/tickets/itn/route.ts" |
   shasum -a 256 -c -`) is the only gate that can go green, and it can only go green against
   this exact byte sequence.
4. **`@dev` must also update `contracts/golden/ticketing-hardening/itn-route.golden.sha256`** to
   the same new value — that older contract's own A15 pins the same file to the OLD hash and
   would otherwise go red the moment F10 ships, even though F10 is the authorised change. This
   is not a second, independent re-pin decision; it is propagating the one decision made here.

**How a future legitimate re-pin differs from an unauthorised edit**: a legitimate re-pin always
starts with a NEW architect-authored expected file and a NEW contract feature explaining why the
file must change again, exactly like this one and F1's own re-pin before it. An unauthorised
edit is any change to `app/api/tickets/itn/route.ts` that is NOT byte-identical to an
architect-authored expected file referenced by an active contract feature — the sha256 gate
cannot distinguish "well-intentioned hotfix" from "attack"; it only distinguishes "matches the
authored file" from "does not", which is exactly the property that matters for a payment
security boundary.

---

## Why two interface families, not one widened one

F8 already shipped `OrdersFirestoreLike`/`OrdersTransactionLike`/`OrdersCollectionLike` in
`lib/orders.ts`, deliberately narrow — matching only `collection(name).doc(id?)`,
`runTransaction(fn)`, and the transaction's `set(ref, data)` — so the real `Firestore`/
`Transaction` classes already satisfy them structurally with zero adapter code, and so F8's own
fake store (a `set`-only object literal) type-checks against them.

F10 needs strictly more: `collection(name).where(...).limit(n).get()` (to resolve the order and
position refs) and the transaction's `get(ref)` + `update(ref, data)` (to re-read fresh and
write an update rather than a fresh `set`). Two options were considered:

- **Widen `OrdersTransactionLike` in place** to add `get`/`update` as required members. Rejected:
  this would make F8's ALREADY-SHIPPED, ALREADY-PASSING fake store (which only implements
  `set`) stop satisfying the interface, breaking `contracts/contract-ticketing-f8-comp-tickets.yaml`'s
  A4/A2 for no reason connected to F10's own work. A payment-security ceremony contract is not
  the place to introduce an unrelated regression in an already-shipped, already-verified
  feature.
- **Add new, wider, sibling interfaces** (`OrdersFirestoreRwLike`, `OrdersTransactionRwLike`,
  `OrdersCollectionRwLike`, extending the F8 ones only where genuinely additive) that the two new
  F10 functions accept via their own `deps.db`. F8's interfaces, F8's fake store, and F8's
  contract are completely untouched. **This is the approach taken.**

---

## `npx tsx` vs `node --import tsx/esm` — note for future contract authors

Carried forward from `contracts/golden/ticketing-f8-comp-tickets/README.md`, which paid for
this rule twice on this mission before it was written down; F10 nearly paid for it a third
time (A3-A6 were initially specified with `node --import tsx/esm` and gate-failed against
correct code and a correct check — the command was wrong, not the code):

- **`node --import tsx/esm <file>.mjs`** strips TypeScript syntax but does NOT resolve the
  `@/*` tsconfig path alias at runtime — a transitive `import { x } from '@/lib/whatever'` (a
  VALUE import, not `import type`) fails with `Cannot find module '@/lib/whatever'`.
- **`npx tsx <file>.mjs`** goes through tsx's CLI resolver, which DOES honour `tsconfig.json`'s
  `paths` mapping, and resolves the same import correctly.
- `import type { X } from '@/lib/whatever'` is erased entirely before either loader runs, so a
  check whose import chain only ever reaches the alias through `import type` is safe under
  either invocation.

Applied to F10's own checks, verified by running each script both ways before fixing the
contract:

- **A3** (`check-signature-brutal.mjs`) imports `app/api/tickets/itn/route.ts`, whose own
  imports from `@/lib/payfast`, `@/lib/orders`, `@/lib/confirmation-email` are all VALUE
  imports -> **`npx tsx` required**.
- **A4** (`check-break-fix-field-order.mjs`) imports the same route file for
  `parseOrderedFields` -> **`npx tsx` required**, same reason.
- **A5** (`check-order-position-atomicity.mjs`) and **A6**
  (`check-idempotent-duplicate-itn.mjs`) both import `lib/orders.ts`, whose
  `import { initAdmin } from '@/lib/firebase-admin'` is a VALUE import -> **`npx tsx`
  required**.
- **A7** (`check-email-failure-does-not-block.mjs`) imports `lib/confirmation-email.ts`, whose
  only `@/*` import is `import type { TicketType } from '@/types/index'` (type-only) ->
  correct under EITHER invocation; verified both ways, kept as `node --import tsx/esm` to match
  the lighter-weight convention used elsewhere in this project's checks when the alias issue
  does not apply.

**Rule of thumb, restated because it has now cost two features a cycle each: use `npx tsx` for
any check whose import chain contains a VALUE import through `@/*`; `node --import tsx/esm` is
fine otherwise. When in doubt, run the check both ways before committing to a command in the
contract.**

---

## Judgement calls

- **`recoveryToken` is not yet generated at checkout time.** F6 (already shipped) built the
  pure `mintRecoveryToken`/`verifyRecoveryToken` module but explicitly left "wiring
  `mintRecoveryToken` into `lib/orders.ts` / F10's ITN rewrite" open
  (`contracts/contract-ticketing-f6-recovery-token.yaml` line ~94-95). Grepping the repo
  (`recoveryToken`) before this contract was written found ZERO references in `types/index.ts`,
  `lib/orders.ts`, or anywhere order-creation happens — the field does not exist on any real
  `Order` document today. F10 adds the OPTIONAL field to the `Order` type (so the email hookup
  compiles and can read it defensively) and reads whatever is on the order document
  (`null` today, in practice, until checkout is updated to call `mintRecoveryToken` at order
  creation). **F10 does not generate `recoveryToken` at checkout** — `checkout/route.ts` is not
  the pinned file and is outside this ceremony's authorised scope. This is a pre-existing gap
  this contract makes visible rather than either silently fixing (which would mean editing a
  second file under the same ceremony, expanding its blast radius past what was authorised) or
  silently assuming is handled. **Handed to a human/future-feature step**: whoever builds F11 or
  a checkout follow-up must wire `mintRecoveryToken` into order creation, or every real
  confirmation email will carry `recoveryToken: null` and F6's recovery link will not work for
  any real purchase.
- **`buyerName`/`buyerEmail` on the email hookup come from the ORDER, not the position.** For
  F10's single-position scope (§6: "For Milestone 2 (single-attendee purchases only)... one
  email, one QR") this is equivalent to the position's attendee fields, but using the order's
  buyer fields is the forward-compatible choice for the eventual multi-position order (a family
  buying four tickets gets one email addressed to the buyer, not the first attendee) — matching
  spec §6's explicit multi-position design even though F10 itself only ever populates one
  position in the `positions` array.
- **Amount check now reads `order.amount`, not `ticket.amount`.** Both were kept in sync by
  `createOrderWithPosition` (F2/F8), so this changes nothing observable today, but it is the
  correct direction for F2's stated goal of the order becoming the sole source of truth, and
  it is what lets `findReservedOrderByPaymentId` avoid touching the `tickets` collection at all
  for the pre-transaction lookup.

---

## What this contract does NOT prove — handed to a human step, not downgraded to a source grep

- **A real, end-to-end sandbox purchase reaching `paid` in Firestore.** This requires a live
  PayFast sandbox merchant account, a live Firestore project, and guard 4's real outbound
  network call to `https://sandbox.payfast.co.za/eng/query/validate` — all forbidden by this
  contract's hard offline/credential-free constraint. This is F12's job (human purchase-and-scan
  proof on the deployed host), not F10's. A3-A7 prove every unit of logic the route depends on,
  independently and behaviourally; A8's byte-identical pin is the proof the route actually wires
  them together as designed. Nothing in this contract is a substitute for that live proof.
- **A real duplicate ITN delivered concurrently (not sequentially) by PayFast**, and Firestore's
  transaction-retry behaviour under that exact race. A6 proves sequential duplicate delivery;
  the concurrent case is inherited from Firestore's own documented transaction contract (the
  same reasoning the pre-F10 route's own source comments already relied on) and cannot be
  reproduced by an in-memory fake store or verified offline.
- **The route's real HTTP response shape end to end when the email genuinely fails.** A7 proves
  the isolation wrapper itself never propagates a failure; it does not drive the actual Next.js
  route handler over HTTP with a live payment, for the same reason as the first bullet.
- **That `PAYFAST_SANDBOX_PASSPHRASE` is actually configured correctly in the deployed
  environment**, or that a real PayFast sandbox ITN's exact field set matches this contract's
  hand-built fixtures byte-for-byte. The fixtures were built from PayFast's documented payload
  order and the fields already logged from real (rejected) ITNs in `docs/payfast-itn-signature.md`
  — a genuinely new field PayFast adds in the future is not something this contract can
  anticipate.

---

## Files written

- `contracts/contract-ticketing-f10-itn-repin.yaml`
- `contracts/golden/ticketing-f10-itn-repin/README.md` (this file)
- `contracts/golden/ticketing-f10-itn-repin/itn-route.expected.ts.txt` (the architect-authored
  byte-exact target for the re-pin)
- `contracts/golden/ticketing-f10-itn-repin/itn-route.golden.sha256`
- `contracts/checks/ticketing-f10-itn-repin/tsconfig.typecheck.json`
- `contracts/checks/ticketing-f10-itn-repin/fixtures/itn-repin-typecheck.ts`
- `contracts/checks/ticketing-f10-itn-repin/check-signature-brutal.mjs`
- `contracts/checks/ticketing-f10-itn-repin/check-break-fix-field-order.mjs`
- `contracts/checks/ticketing-f10-itn-repin/check-order-position-atomicity.mjs`
- `contracts/checks/ticketing-f10-itn-repin/check-idempotent-duplicate-itn.mjs`
- `contracts/checks/ticketing-f10-itn-repin/check-email-failure-does-not-block.mjs`

None of these checks have been run end to end against real `@dev`-implemented `lib/orders.ts`/
`lib/confirmation-email.ts` code — they cannot pass until those files exist. Every script was
syntax-checked (`node --check`) and the tsconfig/contract YAML were parse-checked by architect;
none has been executed against real implementations, and none is claimed to be green.
