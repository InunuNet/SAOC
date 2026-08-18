# F7 (vendor-registration) — booth fee payment path: decision record

Full source: mission brief inline F7
(`.agent/memory/project/missions/2026-08-17-vendor-registration.md`), verified field-by-field
against the live source document (`gws drive files get`, fileId
`1UKUdzZ9NAJHsqWHSV0mN9tnTrp6NE8I4`, extracted to
`word/document.xml` — see "Payment/booth wording as read from the source" below), and against
F6's shipped review workflow (`lib/vendor-review.ts`, `app/api/admin/vendors/`).

## What this feature is

Two independent pure functions in one new module (`lib/vendor-payment.ts`), six new
additive-only optional fields on `VendorSubmission`, one PUBLIC unauthenticated route for the
vendor's own proof-of-payment upload, and one capability-gated admin route for the office-use
booth-number/payment-received fields. `lib/vendor-review.ts` (F6) is **not modified at all** —
see "Orthogonal metadata, not a new state" below.

## Payment/booth wording as read from the source document

Section 5 of the form ("Payment & Agreement"):

> 29) On-site payment methods you will accept from customers: ☐ Cash ☐ Card ☐ EFT / Instant
> payment ☐ Not applicable
> 30) Booth fee payment reference / proof of payment
> 31) ☐ I confirm I have read and agree to the Vendor Terms & Conditions...

And the office-use block, verbatim, at the very end of the form:

> Office use only: Booth number allocated ____________ Payment received ☐ Yes ☐ No Confirmed
> by ____________

This confirms the mission brief's own reading verbatim: field 29 is what the vendor tells SAOC
about payment methods **they** will accept from **their own customers** at the show (already
modelled as `paymentMethodsAccepted` in F4 — orthogonal to the vendor's own booth fee). Field
30 is a single free-text field the vendor fills in once they've made their own EFT payment for
the booth — already modelled as `paymentReference` in F4. The office-use block is three
independent blanks a human (the show committee) fills in by hand after the fact: a booth
number, a yes/no, and a name. Nothing in the source document names a fee amount, a price list
per booth type, or any gateway/checkout mechanism — this reads as a human reconciling a bank
statement against a reference number, not a PayFast-style checkout flow, exactly as the mission
brief's own recommended default states. This contract builds against that reading.

## No PayFast integration — confirmed, not merely assumed

The mission brief gates F7 on "Brad/Lee-Ann answering the payment-path question" before
building against any assumption. The team lead's own dispatch for this contract already frames
F7 as "booth fee payment path — offline EFT + proof-of-payment upload + booth number
allocation," adopting the brief's recommended default. This contract proceeds on that basis: no
second PayFast/gateway integration exists anywhere in this feature, and none of F4's
`paymentMethodsAccepted`/`paymentReference` fields (already shipped) are touched.

## No ZAR amount anywhere in this feature — a real gap, not an oversight

The team lead's dispatch asked for "ZAR amounts: named constants, no magic numbers; placeholder
pricing flagged as not-Council-approved." Having verified the live source document field by
field, **no booth fee amount, no price list per booth type/size, and no total-due figure
appears anywhere in Lee-Ann's form or in the mission brief.** The form collects a payment
*reference* (field 30) and an office-use *yes/no* (payment received) — never an amount. This
contract does not invent a fee schedule: doing so would be a real business/pricing decision for
the show committee, out of scope for an engineering default and squarely the kind of "invented
brand/business asset" this codebase's `CLAUDE.md` already forbids. `lib/vendor-payment.ts`
contains exactly two named constants, both engineering limits for the upload adapter
(`PROOF_OF_PAYMENT_MAX_BYTES`, a 5 MB file-size cap; `PROOF_OF_PAYMENT_ALLOWED_MIME_TYPES`, a
3-member PDF/JPEG/PNG allowlist) — not pricing. If a booth-fee amount is ever needed (e.g. to
show a vendor how much to pay), that is a distinct future feature requiring a real, Council-
approved figure from Lee-Ann/the committee, not something this contract manufactures.

## Orthogonal metadata, not a new state in F6's machine — the judgement call

The mission brief's own F7 wording already leans this way ("an admin manually flags
`paymentReceived: boolean` and `boothNumber: string | null` **in the F6 review UI**") but
leaves open whether F6's `VendorSubmissionStatus` union should grow a state (e.g.
`approved` → `paid`). **Decision: no new status. Payment/booth fields are additive metadata on
an already-`'approved'` submission, evaluated by a second, independent pure function
(`decideVendorPaymentUpdate`), never a new edge in `lib/vendor-review.ts`'s closed machine.**

Reasoning:

- The office-use block on the source form is three **independent blanks on one document** —
  a booth number, a yes/no, a name — not a sequence of states a submission moves through. A
  vendor's booth number can reasonably be recorded before their payment clears (the committee
  plans the floor first), or payment can be confirmed before a specific booth is assigned. A
  single linear `approved → paid` status cannot express "booth allocated, payment still
  pending" or the reverse without either a combinatorial explosion of statuses or losing
  information — the two independent boolean/nullable fields already say exactly what's true.
- F6's contract explicitly documents its closed machine as **exactly 3 edges**
  (`submitted→under-review`, `under-review→approved`, `under-review→reject`) and both F6's A5
  (closed-transition-machine) and A6 (additive-patch-injected-time) hardcode that exact edge
  count and the exact 3-key patch shape. Adding a 4th status or a new edge would require
  editing those two check scripts' hardcoded expectations — the same "required edit, not a
  regression" pattern F6's own A4 documents for F3 — for zero expressive gain over the simpler
  orthogonal-metadata model. This contract's A8 (F6 regression gate) re-runs those exact F6
  scripts **unchanged** and requires them to still pass, proving F7 needed no such edit.
- `decideVendorPaymentUpdate`'s own status gate (`currentStatus !== 'approved'` → refuse) is
  where the real invariant lives: office-use fields cannot be recorded against a submission
  that hasn't been approved, full stop. This captures the same business rule the brief cares
  about (don't allocate a booth to an unapproved/rejected vendor) without touching F6's state
  space at all.

## Booth-number allocation — manual, admin-recorded, uniqueness enforced

Per the mission brief's own recommended default (Open Question 3): **manual allocation, the
admin tool just records the result** — no allocation algorithm, no floor-plan logic. This
contract encodes exactly one invariant beyond "record whatever the admin types": **a non-empty
booth number must not collide with one already recorded against a DIFFERENT approved
submission.** This is the one place a bare recording field would let a real-world mistake
(double-booking a booth) go unnoticed by the software; enforcing it costs nothing in the "no
allocation algorithm" sense — the admin still picks the number by looking at a real floor plan,
this only stops a typo or a stale UI from accidentally reusing one already given out.
`allocatedBoothNumbers` is **injected by the caller** (a real Firestore query over other
`'approved'` submissions' `boothNumber` field, excluding the submission currently being
updated) — the pure function never queries anything itself, matching F6's injected-time
pattern for the equivalent reason (offline-testable, no live Firestore needed).

Booth numbers are compared as plain strings, case-sensitively, with no format constraint (no
regex like "must be alphanumeric") — the office-use block on the form is a blank line, not a
structured field, so this contract does not invent a format the source document doesn't
specify. Re-confirming a submission's OWN already-recorded booth number is not treated as a
self-collision; the contract's own test (A5/A6) proves this by having the caller exclude the
submission's own current value from `allocatedBoothNumbers` before calling — the same
responsibility a real caller (the admin route) must uphold, documented explicitly in that
route's golden wiring file.

## Capability reuse, not a new one

Payment/booth-recording is gated on the exact same `review-vendor-applications` capability F6
already introduced — no new capability is added to `lib/admin-roles.ts`'s `CAPABILITIES` array.
This is back-office triage of the same submission by the same reviewer role (`manager`/`owner`,
never `door-staff`), not a functionally distinct permission; introducing a second capability
for "the same admin doing a later step on the same document" would fragment the role model for
no access-control benefit Lee-Ann's team needs today.

## The public upload route — deliberately unauthenticated

`POST /api/vendors/[id]/proof-of-payment` has **no capability gate, no session check at all**
— by design, not by omission. The vendor reaches this route with their own submission id
(received in the F5 confirmation email, matching the pattern the mission brief already assumes
for how a vendor would reference their own booth-fee payment). A10's discriminator enforces the
INVERSE of A9's requirement: this route must **not** import `lib/admin-auth.ts`/
`lib/admin-roles.ts` at all, so a future edit that accidentally starts gating it (or, worse,
silently drops the gate from the admin route while this one stays unguarded and no test
notices) is caught either way.

This IS an unauthenticated 5 MB upload endpoint, though, and that carries a real spam/cost
vector (arbitrary Storage writes, junk proof files against arbitrary submission ids) that the
first pass of this contract left completely ungated. The team lead flagged this before
dispatching to `@dev`; the three additions below close it.

## Rate limiting the public upload route

`lib/vendor-payment-rate-limit.ts` (new) mirrors `lib/vendor-registration-rate-limit.ts` (F5)
exactly: a thin wrapper delegating to the REAL `decideRateLimit()`
(`lib/resend-rate-limit.ts`) — no sliding-window arithmetic is reimplemented a third time in
this codebase. `PROOF_OF_PAYMENT_RATE_LIMIT_MAX_ATTEMPTS = 5` /
`PROOF_OF_PAYMENT_RATE_LIMIT_WINDOW_MS` = 1 day (placeholders, not Council-approved, same
caveat as F5's own constants) — deliberately **tighter over the relevant time horizon** than
either F6's resend-my-tickets (5/hour) or F5's own vendor-registration limit (3/hour, i.e. up
to 72/day theoretically): this is a repeat-upload endpoint a legitimate vendor might retry a
handful of times (a bad scan, a wrong file, a payment correction), but it is also the single
most expensive unauthenticated action in this mission (a 5 MB Storage write, versus F5's tiny
JSON document), so the per-IP ceiling is set low across a full day rather than a short window.

Enforcement is at the **handler level**, exactly mirroring F5's
`lib/vendor-registration-handler.ts`: the new `lib/vendor-proof-of-payment-handler.ts`'s
`handleProofOfPaymentUpload()` checks the rate limit and records the attempt **first, before
anything else** — a blocked caller reaches none of `planProofOfPaymentUpload`,
`submissionExists`, `uploadFile`, or `updateSubmission` (A14 proves zero calls to any of the
three injected side-effecting deps on a 429). The public route itself
(`app/api/vendors/[id]/proof-of-payment/route.ts`) is a thin wrapper delegating entirely to this
handler — it contains no rate-limit, validation, or existence logic of its own (A10 now
requires this delegation, not a direct call to `planProofOfPaymentUpload()` as the contract's
first draft had it).

## Overwrite semantics — the judgement call

**Decision: REPLACE, never refuse and never version.** A second upload for the same
`submissionId` is accepted exactly like the first: it computes the identical, deterministic,
mime-derived `storagePath` (so it overwrites the same Storage object) and the latest call's
`now` becomes the surviving `proofOfPaymentUploadedAt`. Reasoning: the source form gives a
vendor no formal channel to "correct" a mistaken upload other than uploading again — a bad
scan, the wrong file, or a payment made in two tranches (e.g. a partial EFT followed by a
top-up) are all realistic reasons a vendor would upload a second time, and the reviewing admin
only ever cares about the latest proof, matching the office-use block's own "Payment received
Yes/No" framing (a current state, not a history). Refusing a second upload would create a
support burden (the vendor emailing SAOC to ask for a manual override) for no security benefit;
versioning (keeping every historical upload) is complexity the source document gives no reason
to need. A16 proves this behaviourally: two successive uploads against the same id, with a
DIFFERENT original file name on the second call, both succeed, both reach `updateSubmission`,
both compute the identical `storagePath`, and the second call's `proofOfPaymentUploadedAt`
reflects its own injected `now`, not the first's.

## Non-enumerable existence posture — the judgement call

**Decision: the response is byte-for-byte identical (`202`, `{ accepted: true }`) whether or
not the target submission exists.** `handleProofOfPaymentUpload()` still checks existence via
`deps.submissionExists()` (an EXISTENCE-ONLY lookup — the handler never reads or can leak any
other field of the submission), but only the INTERNAL side effects differ: `uploadFile`/
`updateSubmission` are called when it exists, and are never called when it does not. This
supersedes this contract's first-draft design, which returned a distinct `404` for a missing
submission — the team lead's dispatch specifically asked "does the public route leak
existence" and to pick the non-enumerable posture, so this contract now does, rather than
falling back on "Firestore auto-IDs have enough entropy that enumeration is impractical
anyway" (true, but not the posture asked for, and cheap to close properly). A15 proves the
response equality directly; A10's route-wiring discriminator additionally forbids the route
itself from containing a `status: 404` branch at all, so a future edit cannot reintroduce the
leak at the route layer even if the handler's own response stays correct.

**The real tradeoff, named explicitly**: a vendor who mistypes their own submission id gets the
same "accepted" response as a vendor who typed it correctly — there is no distinct error
telling them their upload silently went nowhere. This is the same tradeoff a password-reset
flow makes ("if that account exists, we've sent a link") to avoid becoming an account-existence
oracle. Given the file validation step (mime type, size, filename) still runs and still returns
a genuinely distinct `400` for the vendor's OWN mistakes about their own file — the only thing
made silent is a wrong *id*, which a vendor is unlikely to get wrong if they're pasting it from
their own confirmation email — this is judged an acceptable cost for closing the oracle. Rate
limiting (above) further bounds how many existence-probing attempts a single IP can make
regardless of the response shape.

## Storage upload adapter — unproven, F10 territory

Per the house rule on live-Storage checks: this contract keeps the gated core pure
(`planProofOfPaymentUpload` validates submissionId/fileName/mimeType/sizeBytes shape and
computes a deterministic path; nothing here touches Firebase Storage). The real upload adapter
— actually calling `getStorage(initAdmin()).bucket().file(path).save(...)` against a live
bucket — is **not proven by this contract**, the same gap F6's README documents for a live
Firebase Auth admin session, and F8's README documents for the comp route. It is F10's
human-proof step: a real submission, a real EFT payment, a real proof-of-payment file actually
uploaded and actually retrievable. The extension used for the stored path is derived solely
from the validated `mimeType`, never the caller's `fileName`, specifically so a file uploaded
with a spoofed extension (e.g. `virus.exe` sent with `mimeType: 'application/pdf'`) can never
influence what gets written to Storage.

## Combined-failure case — named per house rule

`decideVendorPaymentUpdate`'s check script (A5/A6 combined,
`check-payment-status-gate-and-booth-uniqueness.mjs`) includes one case that is invalid for
**two independent reasons at once**: `currentStatus: 'submitted'` (fails the status gate) AND
a `boothNumber` that also collides with `allocatedBoothNumbers` (would separately fail the
uniqueness gate). The function short-circuits on the status gate first, so only one reason
appears in the returned error — the test asserts the refusal happens AND that the reported
reason names the status gate specifically, while separately proving (elsewhere in the same
script) that each reason fails in isolation too, so neither failure mode is merely correlated
with the other in this one combined case.

## Additive-only patch, not a full document

`decideVendorPaymentUpdate()`'s `ok:true` result is a 4-key patch object
(`boothNumber`, `paymentReceived`, `paymentConfirmedBy`, `paymentConfirmedAt`) only — it never
returns or touches any of the 31 submitted fields or F6's `status`/`reviewedBy`/`reviewedAt`.
The admin route applies the patch via Firestore's partial-merge `ref.update(decision.patch)`,
never `ref.set(...)`. `planProofOfPaymentUpload()`'s successful result is likewise scoped to
exactly the two fields the public route may write
(`proofOfPaymentPath`, `proofOfPaymentUploadedAt`) — A10's discriminator explicitly forbids the
public route's `ref.update()` call from mentioning any of the four office-use fields, keeping
the "public submitter can never self-approve/self-allocate a booth" invariant enforced at the
route-wiring level, not merely by convention.

## Zero-authorization carry-through

Neither `planProofOfPaymentUpload()` nor `decideVendorPaymentUpdate()` has any notion of
admin/roles/capability — `lib/vendor-payment.ts` imports neither `lib/admin-auth.ts` nor
`lib/admin-roles.ts`. A.7(c) proves `planProofOfPaymentUpload()` succeeds identically
regardless of the real submission's status, because the pure function has no way to check it
— all status/authorization logic for the payment path lives in `decideVendorPaymentUpdate()`
and the two route files, never in the upload-metadata validator.

## What this contract does NOT prove

- That a genuine admin session WITHOUT `review-vendor-applications` gets 403 specifically from
  the new payment route, or that a genuine manager/owner session succeeds with 200. Both
  require a live Firebase Auth project — deferred to F10's human-proof step, exactly as F6's
  own README already documents for its two routes. (Unlike F6, this contract does not include
  an HTTP-level fail-closed round-trip script (F6's A9) — the wiring discriminator (A9 here)
  already proves the SAME gate pattern F6's own A9 exercised live is present at the call site;
  duplicating an HTTP-server-spinning script for a second route protected by the identical gate
  was judged not worth the added runtime and flake surface for this contract. If reviewers
  want that live proof duplicated per-route, it is a cheap, mechanical addition later.)
- That the real Firebase Storage upload adapter actually writes a retrievable file to a real
  bucket — F10 territory, see above.
- Anything about `/admin/vendors/page.tsx`'s visual rendering of the new payment/booth fields,
  or the public registration confirmation page's upload UX. UI acceptance is @qa/human-proof
  (F10) territory, per the house rule that `agent_review`-shaped UI checks are a smell this
  contract does not introduce.
- Whether `manager`/`owner` are the only correct roles for this action, or whether booth
  numbers should ever be validated against a real floor-plan format — both re-litigate
  decisions this contract treats as settled by F6/the mission brief's own recommendation.
- Cross-instance or persistent rate-limiting: `createInMemoryProofOfPaymentRateLimitStore()`'s
  counter is a module-level array, surviving warm invocations only — not a cold start or a
  second Firebase App Hosting instance. Same gap F5's own README documents for its identical
  in-memory store; a real distributed limiter (Firestore- or Redis-backed) is future work, not
  this contract's scope.
- That `x-forwarded-for`'s first hop is a trustworthy client identifier — it is
  client-suppliable and therefore spoofable by a direct caller who sets the header itself
  (mirrors F5's own `deriveRateLimitKey()` caveat exactly; see that route's golden README).
  The rate limit is a best-effort abuse deterrent, not a security boundary.

## Verification

Every check script was syntax-checked (`node --check` where applicable) and hand-run against a
throwaway reference implementation of `lib/vendor-payment.ts` and a temporarily-patched
`types/index.ts` (both created, verified, then fully reverted — `git status` confirmed clean
before and after). The two route-wiring discriminators (A9, A10) were additionally verified
against temporarily-created copies of this contract's own wired goldens at the real route
paths (`app/api/admin/vendors/[id]/payment/route.ts`,
`app/api/vendors/[id]/proof-of-payment/route.ts`), then those throwaway route files were
deleted — `git status` confirmed clean again. Findings from that verification pass, already
folded into the check scripts/goldens above:

1. **Both wired goldens' own explanatory comments, first draft**: used the phrase "never
   `ref.set()`" — containing the literal substring `ref.set(`, tripping each discriminator's
   own negative check and failing its self-test against its own golden (the exact trap F6's
   README already documents for its own review-route golden). Fixed by rewording both comments
   to avoid the literal substring, not by weakening either check.
2. All five defeating mutations below were confirmed live, run against the throwaway reference
   implementation / temporarily-wired route files, each producing the expected named failure:
   - Removing `planProofOfPaymentUpload`'s size-limit comparison → A3 failed, naming the
     "one byte over the limit was accepted" case specifically.
   - Re-inlining the byte limit as a bare `5242880` literal → A4 failed, naming both the
     missing named-constant comparison and the bare 5+-digit literal.
   - Widening `decideVendorPaymentUpdate`'s status gate to accept any status (`if (false)`)
     → A5/A6 failed with 4 named failures: three non-approved statuses wrongly accepted, plus
     the combined-failure case no longer naming the status-gate reason (since the gate no
     longer refuses).
   - Removing the booth-uniqueness comparison → A5/A6 failed, naming "a booth number colliding
     with an already-allocated one was accepted."
   - Adding a stray 5th key to the successful patch → A6 failed, naming the exact unexpected
     key set.
   - Deleting the admin payment route's `hasCapability` call, and separately swapping
     `ref.update(` for `ref.set(` → both defeated A9 independently, each producing "does not
     pass the capability-gate + additive-payment-wiring discriminator."
   - Making the public upload route import `lib/admin-auth.ts`, and separately making its
     `ref.update()` also write `boothNumber` → both defeated A10 independently.
3. A8 (F6 regression gate) was confirmed to pass against the current, unmodified repository
   state (F6's four re-run scripts all green) — proving F7's contract authoring alone (no
   production files yet exist) does not itself disturb F6.
4. **Rate limiting / non-enumerable existence / overwrite semantics (added after the team
   lead's security-gap review)**: `lib/vendor-payment-rate-limit.ts` and
   `lib/vendor-proof-of-payment-handler.ts` were added to the same throwaway-reference-then-
   revert cycle, and the public route's wired golden/unwired fixture and A10's discriminator
   were rewritten to require delegation to `handleProofOfPaymentUpload()` (not a direct call to
   `planProofOfPaymentUpload()`, as the contract's first draft had it). A13-A16 were run green
   against the throwaway implementation, then three additional defeating mutations were
   confirmed live: importing `lib/admin-auth.ts` into the public route, adding a route-level
   `404` branch for a missing submission, and bypassing the handler to hand-roll validation
   inline — all three independently defeated A10.
5. **Node/tsx alias-resolution quirk discovered during this pass**: any check script that
   imports a production file which itself imports another `@/lib/*`-aliased file (e.g.
   `lib/vendor-payment-rate-limit.ts` importing `@/lib/resend-rate-limit`) fails to resolve
   under `node --import tsx/esm` in this environment (Node 26.4.0), even though the identical
   pattern already ships in F5's own `lib/vendor-registration-rate-limit.ts`. `npx tsx` resolves
   it correctly. This is a pre-existing environment quirk, not something this contract
   introduces — confirmed by reproducing the identical failure against F5's own shipped file.
   A13-A16's commands use `npx tsx` for exactly this reason; A3/A5/A6/A7 (which only import
   `lib/vendor-payment.ts`, whose sole alias import is `@/types/index`) were re-confirmed to
   still pass under `node --import tsx/esm` as originally specified.
