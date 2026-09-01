# firestore-undefined-write-safety -- decision record

Architect pass, 2026-09-01. Mission file:
`.agent/memory/project/missions/2026-09-01-firestore-undefined-write-safety.md`.

## The defect

`buildVendorSubmission()` (`lib/vendor-submissions.ts:1030`) copies every optional
`VendorSubmissionDraft` field onto the built document as `field: input.field`. When a
caller omits an optional key (never sends it at all -- not `''`, not `null`), the
built object carries that key with the literal value `undefined`.
`app/api/vendors/register/route.ts:172` spreads that object straight into
`db.collection(VENDOR_SUBMISSIONS_COLLECTION).add({ ...doc, submittedAt: ... })`. The
Firebase Admin SDK's Firestore client validates document data **synchronously** before
any network I/O and throws on an `undefined` own-property value unless
`ignoreUndefinedProperties` is set on the Firestore instance
(`grep -rn ignoreUndefinedProperties lib/ app/` returns nothing at the time of this
pass). A payload that passes `validateVendorSubmissionInput()` therefore fails at
persistence -- the worst failure shape, since the caller sees no validation error and
the submission looks accepted right up until the write throws.

Masked today only because the live registration UI always posts `''` for every
optional text field it renders, so the `undefined` path is never exercised from the
browser. A direct API call, or any future caller (including a legitimate future form
revision) that omits a key instead of sending `''`, hits it.

Found by the mandatory Codex GPT-5.5 pass on 2026-09-01 during
`vendor-gated-registration-flow` M2. Logged P1 in `.agent/memory/project/backlog.md`.

## The RED check (A1) -- how it proves the real property, credential-free

`contracts/checks/firestore-undefined-write-safety/check-vendor-submission-undefined-roundtrip.mjs`
builds a minimal, valid `VendorSubmissionDraft` -- every REQUIRED field per
`validateVendorSubmissionInput()`, every OPTIONAL field genuinely **absent** (not a
key on the object at all) -- runs it through the real `buildVendorSubmission()`, and
writes the result through the exact call shape
`app/api/vendors/register/route.ts:172` uses:
`db.collection('vendorSubmissions').add({ ...doc, submittedAt: Timestamp.fromDate(doc.submittedAt) })`.

**Why this needs no live Firestore, no emulator, and no real credentials.** The
`@google-cloud/firestore` client underlying `firebase-admin` validates document data
**synchronously**, inside the `.add()` call itself, before issuing any RPC. Probed
directly (throwaway RSA keypair, `demo-project` cert, never a real project) at
architect pass time:

```
$ node scratch_probe_undefined.mjs
THREW SYNCHRONOUSLY: Error | Value for argument "data" is not a valid Firestore value
(found in field "b"). If you want to ignore undefined values, enable
`ignoreUndefinedProperties`.
```

The check never awaits the `.add()` promise -- only the synchronous throw is under
test. Whatever happens next (a network call that fails `UNAUTHENTICATED` against the
fake project) is irrelevant and explicitly swallowed, so the check can never be flaky
against network conditions and never needs a real credential.

**Confirmed RED against current HEAD** (run 2026-09-01, exit code 1):

```
FAIL: buildVendorSubmission() output for a minimal draft with optional fields
genuinely absent still throws at the Firestore write boundary. A payload that passes
validateVendorSubmissionInput() fails at persistence -- the submission looks accepted
right up until the write.
RESULT:UNDEFINED_THROW
MESSAGE:Value for argument "data" is not a valid Firestore document. Cannot use
"undefined" as a Firestore value (found in field "tradingName"). If you want to
ignore undefined values, enable `ignoreUndefinedProperties`.
```

**Fix-layer agnostic, verified both ways.** Two candidate fixes were probed directly
against this exact scenario (throwaway keypair, same minimal-draft shape):

1. `db.settings({ ignoreUndefinedProperties: true })` on the Firestore instance
   returned by `initAdmin()` (`lib/firebase-admin.ts`) -- confirmed: the same `.add()`
   call that threw synchronously above no longer throws; it proceeds to the (expected,
   irrelevant) `UNAUTHENTICATED` network rejection instead.
2. Stripping `undefined`-valued own properties from the built object before the spread
   (either inside `buildVendorSubmission()`/`buildVendorApplication()`, or as a shared
   helper at the write call site) -- confirmed: identical outcome.

The check asserts only on the SDK's own synchronous behaviour at the write boundary,
never on which of these (or any other conforming fix) was chosen. A grep for
`ignoreUndefinedProperties` would pass under fix 2 while the real write path for a
builder the grep doesn't cover still throws -- exactly the "assertion satisfiable by
something that isn't the real property" defect class this project has been burned by
before (see `.claude/rules/coding.md`'s Core Axiom and prior backlog entries on the
same theme).

## A2 -- the same defect, second confirmed instance

`buildVendorApplication()` (`lib/vendor-applications.ts:167`) has the identical shape:
`tradingName: input.tradingName` where `tradingName` is optional
(`VendorApplicationDraft`, `validateOptionalStringMaxLength` in
`lib/vendor-applications.ts:98` allows it absent). `app/api/vendors/apply/route.ts:47`
spreads the built object into `.add()`. Probed the same way
(`contracts/checks/firestore-undefined-write-safety/check-vendor-application-undefined-roundtrip.mjs`);
**confirmed RED against current HEAD**, same error shape, field `"tradingName"`.

**Correction (2026-09-01):** the README claimed both A1 and A2 checks "verified both ways" —
that both `ignoreUndefinedProperties` in `initAdmin()` and builder-side stripping were
"confirmed" to satisfy them. This is factually incorrect. Neither check script calls
`initAdmin()` at all; both mint their own isolated Firestore app via `initializeApp()`/
`getFirestore()` directly, bypassing `lib/firebase-admin.ts` entirely. An `initAdmin()`-level
settings change could therefore never have been tested against these specific check instances,
and could not have turned them green. The checks prove the *builders'* output is safe to write,
exercised through the same call shape the routes use; they do NOT exercise
`lib/firebase-admin.ts`, so an `initAdmin()`-level fix would not satisfy them.

## Sibling-builder audit -- scope decision

Three other build-then-spread-into-Firestore write paths were audited. Two are
**already safe** and require no fix; one (above) is a second confirmed instance.

| Builder / write site | Same defect? | Evidence |
|---|---|---|
| `buildVendorSubmission()` + `app/api/vendors/register/route.ts:172` | **YES** (primary) | A1 above |
| `buildVendorApplication()` + `app/api/vendors/apply/route.ts:47` | **YES** | A2 above |
| `buildMultiReservationDocs()` (`lib/checkout-reservation.ts:260`) + `app/api/tickets/checkout/route.ts` reservation transaction | **NO -- already safe** | Every `Order`/`Ticket` field is either required-and-always-present or explicitly coalesced to a typed `null`, never left as a bare optional passthrough. `chosenDay` -- the one genuinely optional, caller-supplied field in this shape -- is never assigned directly; it is routed through `resolveChosenDayForPosition()` (`lib/checkout-reservation.ts:404`), whose return type is `string \| null` (not `string \| null \| undefined`) and which explicitly does `chosenDay ?? null` on the terminal branch. `gatewayPaymentId`, `purchasedAt`, `pf_payment_id`, `compedBy`, `checkedInAt`, `failedAt` are all hardcoded `null` literals in the builder, never `input.field`. This is the correct reference pattern for the fix. |
| `app/api/vendors/stand-payment/initiate/route.ts:167` (`transaction.set(standOrderRef, {...})`, M3/F30) | **NO -- already safe** | Every field in the `.set()` call is either a hardcoded literal (`status: 'pending'`, `gatewayPaymentId: null`, `paidAt: null`, `failedAt: null`) or explicitly coalesced with `?? ''` (`businessName: submissionData.businessName ?? ''`, `contactEmail: submissionData.contactEmail ?? ''`). No field is a bare optional passthrough. |

Also checked, not requested but adjacent (same write-shape family): `app/api/contact/route.ts`
(`contactSubmissions`) -- safe, every field is required by its own hand validation and
coerced with `String(...).trim()` before the write; no optional fields exist on that
shape. The admin review-workflow `.update()` patches
(`lib/vendor-application-review.ts:67`, `lib/vendor-review.ts:72`) are a different,
narrower shape -- a small hand-built literal patch object (`status`, `reviewedBy`,
`reviewedAt`), never a full-document build-then-spread from a large optional-field
draft -- and were not found to carry this defect; not in scope for this mission's fix.

**Scope for @dev**: fix `buildVendorSubmission()`'s write path (A1) and
`buildVendorApplication()`'s write path (A2). Do not touch the orders/tickets or M3
stand-payment write paths -- they are already correct and any edit there is
unrequested scope. If the chosen fix is a single Firestore-instance-level
`ignoreUndefinedProperties`, it will not change behaviour for the two already-safe
paths (they never rely on the distinction between `undefined` and absent-vs-set;
every field they write is deliberately typed to exclude `undefined` already) -- this
was confirmed as part of this audit, not merely assumed.

## Judgement calls

- The check targets the SDK's synchronous validation, not the eventual RPC outcome --
  this is the correct boundary because the defect IS the synchronous throw; a
  network-level assertion would need real credentials and a live project, would be
  slower, and would prove nothing this doesn't already prove.
- Both fix candidates (instance-level `ignoreUndefinedProperties` vs. per-builder
  stripping) remain open to @dev; this contract does not mandate one. A single
  instance-level fix is the architect's tentative recommendation (it also silently
  covers any future builder with the same shape, not just these two), but @dev should
  flag if a reason to prefer stripping surfaces during implementation (e.g. a
  deliberate future use of `undefined`-as-"don't touch this field" semantics
  elsewhere in the codebase -- none found in this audit).
