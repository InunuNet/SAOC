# admin-vendor-listing-serialization -- decision record

Architect pass, 2026-09-01 (P0, live production crash, blocks tomorrow's demo).

## The defect (already confirmed by team-lead from the live server trace -- not re-investigated here)

Cloud Logging, project `saoc-webapp`, service `saoc-prod`, revision
`saoc-prod-build-2026-09-01-002`, 2026-09-01T19:38:50Z:

```
⨯ Error: Only plain objects, and a few built-ins, can be passed to Client Components from
Server Components. Classes or null prototypes are not supported.
```

`fetchVendorApplications()` in `app/admin/vendors/applications/page.tsx:87-99` does
`return { id: doc.id, ...data } as VendorApplication` -- spreading raw Firestore document
data straight into a prop handed to `<VendorApplicationReviewTable>`
(`components/admin/VendorApplicationReviewTable.tsx:1`, `'use client'`). Firestore's
`doc.data()` returns `submittedAt`/`reviewedAt`/`registrationTokenIssuedAt`/
`registrationTokenExpiresAt`/`registrationTokenConsumedAt` as `Timestamp` **class
instances**, not plain data. A class instance cannot cross the RSC serialization boundary, so
the page throws server-side and Next renders its error page. Invisible until now only because
`vendorApplications` was empty -- an empty array serializes fine regardless of what shape its
(zero) elements would have been. The defect activated the moment the first application
document existed; there are five now.

**Confirmed by grep, exactly two sites in the whole `app/admin` tree carry this pattern** (no
other sibling admin listing does):

- `app/admin/vendors/applications/page.tsx:97` -- `{ id: doc.id, ...data } as VendorApplication`
  (the one that already crashed in production)
- `app/admin/vendors/page.tsx:108` -- `{ id: doc.id, ...data } as VendorSubmission` (the
  unfixed twin, below)

## Blast-radius sweep (team-lead, 2026-09-01) -- four instances total, confirmed complete

An independent agent grepped every raw `doc.data()` spread under `app/`. Exactly four exist,
no more:

1. `app/admin/vendors/applications/page.tsx:97` -- the one that already crashed in production.
2. `app/admin/vendors/page.tsx:108` -- the unfixed twin, below.
3. `app/api/admin/vendors/applications/route.ts:33` -- `snapshot.docs.map((doc) => ({ id:
   doc.id, ...doc.data() }))`, GET /api/admin/vendors/applications.
4. `app/api/admin/vendors/route.ts:34` -- the identical shape, GET /api/admin/vendors.

**Confirmed NOT affected, deliberately not widened further:** `app/admin/door/page.tsx`
(passes only booleans), `app/admin/settings/page.tsx` (client-side page, fetches its own
data), `app/admin/page.tsx` (server component, already correct -- see "The reference
pattern" below).

### Instances 3 and 4: fatal at one boundary, silent at the other

Instances 3 and 4 do the identical raw spread, but into a `NextResponse.json()` response
instead of a `'use client'` component prop. `JSON.stringify` does not throw on a class
instance the way RSC serialization does -- it silently calls into the Firestore `Timestamp`
class's own internal shape and emits `{"_seconds": N, "_nanoseconds": N}` for every
timestamp field, leaking Firestore's wire format to any caller and disagreeing with how
every other date already crosses this project's API surface. Confirmed directly:

```
$ node -e "const {Timestamp}=require('firebase-admin/firestore');
  console.log(JSON.stringify({submittedAt: Timestamp.fromDate(new Date('2026-01-01T00:00:00Z'))}))"
{"submittedAt":{"_seconds":1767225600,"_nanoseconds":0}}
```

**This is the more dangerous variant of the same defect class.** The RSC instance fails loudly
-- a 500, a stack trace, a demo-blocking crash impossible to miss. The JSON instance fails
silently -- a 200 response with a plausible-looking object where a date should be, that a
careless caller could ship straight into a UI (e.g. `new Date(response.submittedAt)` would
silently produce `Invalid Date`, not an error). Both routes are orphaned today -- no caller
round-trips through either; the admin pages read Firestore directly rather than calling their
own API routes -- but both are live, authenticated (same `getAdminSession()` +
`hasCapability(..., 'review-vendor-applications', ...)` gate as the pages), and reachable.
Fixed in the same pass rather than left as two known-wrong endpoints behind a now-fixed UI.

### The reference pattern -- reused, not reinvented

Two places in this codebase already convert a Firestore Timestamp correctly, and the fix
follows their convention rather than inventing a third:

- `components/admin/TicketsTable.tsx:13` -- `new Date(ticket.purchasedAt.toMillis()).toISOString()`.
  `TicketsTable` is NOT `'use client'`, and its page (`app/admin/page.tsx`) is a plain Server
  Component, so the raw `Timestamp` on `Ticket.purchasedAt` (`types/index.ts:148`) never
  crosses the RSC boundary at all -- confirming, by contrast, that `VendorApplicationReviewTable`
  and `VendorReviewTable` crash specifically because they ARE `'use client'`.
- `app/api/admin/export-csv/route.ts:27-28` -- the same `.toMillis()` -> `new Date()` ->
  `.toISOString()` conversion, for the CSV/JSON path.

Both already converge on an ISO 8601 string as this project's one convention for a date
crossing any boundary. F1's `serializeVendorApplication`/`serializeVendorSubmission` convert
Timestamp -> `Date` (matching `VendorApplication`/`VendorSubmission`'s own type, and safe to
pass across the RSC boundary directly); F2's two routes reuse those SAME functions and rely on
`NextResponse.json()`'s native `Date.prototype.toJSON()` call, which returns
`.toISOString()` -- producing the identical string shape as the reference pattern, through one
shared conversion path rather than a second, parallel one. Confirmed directly:

```
$ node -e "console.log(JSON.stringify({submittedAt: new Date('2026-01-01T00:00:00Z')}))"
{"submittedAt":"2026-01-01T00:00:00.000Z"}
```

## Why the second instance is the important one

`app/admin/vendors/page.tsx`'s `fetchVendorSubmissions()` has the byte-identical pattern,
feeding `components/admin/VendorReviewTable.tsx` (also `'use client'`). `vendorSubmissions` is
empty today, so `/admin/vendors` currently renders fine -- but it will throw the instant the
first vendor completes full registration, which is precisely the middle of the flow being
demoed tomorrow. Fixing only the already-crashing applications-list page and leaving this one
alone ships a landmine at the very next step of the same flow. **Both sites are in this
contract's scope; A2 exists specifically to keep this one from shipping unfixed.**

`app/admin/vendors/page.tsx`'s third fetch helper, `fetchStandPaymentStatusById()` (F32,
`VENDOR_STAND_ORDERS_COLLECTION`), is NOT in scope -- it reads only `doc.data().status`, a
plain string, never spreads the raw document, and carries no Timestamp-shaped value into its
return type (`Record<string, VendorStandOrderStatus>`). Confirmed by reading the function body,
not assumed.

## What produced this in the first place -- and why the fix has to record the lesson

`app/admin/vendors/applications/page.tsx:92-96` carries a comment that explicitly justifies the
untyped, untested spread:

> Firestore's untyped document data (submittedAt/reviewedAt/registrationToken* arrive as
> Timestamps, not Date) is trusted here rather than field-by-field validated -- this listing
> page is UI-only and not itself contract-tested (see this feature's golden README), same
> rationale as app/admin/vendors/page.tsx's own fetchVendorSubmissions().

That reasoning is the direct cause of the production crash: "UI-only, not itself
contract-tested" was used to justify never proving the one property (Timestamp survives the
boundary) that turned out to matter. This contract's whole existence is the counter-example to
that comment -- the fix must not just patch the two call sites but must be a genuinely
unit-testable, contract-tested unit, so this reasoning cannot recur for the same defect class.

## The fix, specified

New pure module `lib/firestore-serialization.ts` -- no Firebase Admin SDK import, no
Firestore read/write, no network (mirrors `lib/firestore-write-safety.ts`'s existing
"pure write-boundary helper" pattern in this repo):

- `serializeVendorApplication(id: string, data: Record<string, unknown>): VendorApplication`
  -- converts `submittedAt`, `reviewedAt`, `registrationTokenIssuedAt`,
  `registrationTokenExpiresAt`, `registrationTokenConsumedAt`, `registrationCodeIssuedAt`,
  `registrationCodeExpiresAt`, `registrationCodeConsumedAt`, `registrationCodeLockedAt` (every
  Timestamp-shaped field on `VendorApplication`, per `types/index.ts:840-889`) from
  Firestore `Timestamp` to native `Date`; every other field passes through unchanged; a
  `null`-valued field stays `null`; a genuinely absent field stays absent.
- `serializeVendorSubmission(id: string, data: Record<string, unknown>): VendorSubmission`
  -- same conversion for `submittedAt` (required) and `reviewedAt` (optional/nullable), the
  only two Timestamp-shaped fields on `VendorSubmission` (`types/index.ts:786-793`, confirmed
  by grep -- no `registrationToken*`/`registrationCode*` fields exist on this type).
- Conversion is duck-typed on `typeof value.toDate === 'function'` (matching how
  `app/api/vendors/register/verify-code/route.ts:76-79` already converts Timestamps elsewhere
  in this codebase), not an `instanceof Timestamp` import -- keeps the module Admin-SDK-free
  and directly unit-testable with a plain object stand-in if ever needed. (The contract's own
  check scripts import the real `Timestamp` from `firebase-admin/firestore` to *seed* the input
  -- that's a test-time choice, not a constraint on the module's own implementation.)

**Why `Date`, not an ISO string:** `VendorApplication.submittedAt`/`VendorSubmission.submittedAt`
etc. are already typed `Date` on the shared type (`types/index.ts:857`, `:787`) -- every other
document builder in this codebase (`lib/vendor-applications.ts`, `lib/vendor-submissions.ts`)
already treats these fields as `Date` end-to-end. `Date` is also one of the "few built-ins"
the production error message itself names as supported crossing the Server->Client boundary
(React Flight serializes `Date` natively). Converting to `Date` is therefore the zero-type-
change fix: no edit to `types/index.ts`, no edit to either table component's prop contract,
and no new string-parsing burden added to `VendorApplicationReviewTable`/`VendorReviewTable` if
either component is later extended to actually render these fields (see "What this contract
does NOT prove" below).

Both page files switch their `.map()` body from the inline cast to calling the new helper:

```ts
// app/admin/vendors/applications/page.tsx
return serializeVendorApplication(doc.id, doc.data());

// app/admin/vendors/page.tsx
return serializeVendorSubmission(doc.id, doc.data());
```

The old `{ id: doc.id, ...data } as VendorApplication` / `as VendorSubmission` lines, and the
comments justifying them as untested, are REMOVED, not left alongside the new code -- a fix
that adds the helper but leaves the old spread live would still crash.

## The RED checks (A1, A2, A8, A9) -- how they prove the real property, credential-free

`contracts/checks/admin-vendor-listing-serialization/check-vendor-application-serialization.mjs`
and `check-vendor-submission-serialization.mjs` (A1/A2, the RSC boundary, F1) and
`check-vendor-applications-route-json.mjs` and `check-vendor-submissions-route-json.mjs`
(A8/A9, the JSON boundary, F2 -- same structure, asserting a JSON-round-tripped ISO 8601
string instead of an `instanceof Date` check, since a JSON response has no live Date objects
by the time a caller sees it). All four:

1. Seed a document with **every Timestamp-shaped field genuinely present and non-null** (a
   fully-reviewed application / a fully-reviewed registration) -- never an empty collection.
   This is deliberate: an empty array is exactly how this defect shipped green the first time,
   so every assertion in this contract is paired with a populated fixture, not an
   absence-only check against nothing.
2. Run a **control** assertion first: the exact `{ id, ...data }` spread the current code uses,
   confirmed (by running it) to still carry real `Timestamp` instances. If a future
   `firebase-admin` upgrade ever changes `Timestamp`'s shape such that a plain spread no longer
   carries a class instance, this control fails loudly and flags the whole check's premise as
   stale, rather than the gate silently proving nothing.
3. Run the **gate**: import the real, exported `serializeVendorApplication` /
   `serializeVendorSubmission` from `lib/firestore-serialization.ts` (relative import,
   explicit `.ts` extension, never the `@/lib/...` alias, per this project's coding rules) and
   assert the output is (a) Timestamp-instance-free everywhere via a recursive walk using the
   real `Timestamp` class from `firebase-admin/firestore` for the `instanceof` check, (b) every
   converted field is a genuine `Date` instance, (c) millisecond-exact against the seeded
   source `Date` (no precision loss, no accidental timezone-string corruption), (d) a
   `null`-valued source field stays `null`, and (e) non-Timestamp fields pass through
   unchanged.

**Why credential-free and deterministic.** `Timestamp.fromDate()` is a pure value-class
constructor on `firebase-admin/firestore` -- it needs no `initializeApp()`, no service account,
no network. Confirmed directly:

```
$ node -e "
const {Timestamp} = require('firebase-admin/firestore');
const t = Timestamp.fromDate(new Date('2026-01-01T00:00:00Z'));
console.log(t.constructor.name, typeof t.toDate, t.toDate());
"
Timestamp function 2026-01-01T00:00:00.000Z
```

**Confirmed RED against current HEAD** (run 2026-09-01, both exit code 1):

```
$ node --import tsx/esm contracts/checks/admin-vendor-listing-serialization/check-vendor-application-serialization.mjs
CONTROL OK: naive spread still carries 3 Timestamp instance(s): naiveSpread.submittedAt, naiveSpread.reviewedAt, naiveSpread.registrationTokenIssuedAt
FAIL: admin-vendor-listing-serialization A1 (vendor applications listing)
 - GATE IMPORT FAILED: lib/firestore-serialization.ts's serializeVendorApplication could not be imported -- Cannot find module '/Users/vetus/ai/SAOC/lib/firestore-serialization.ts' imported from ...
EXIT:1

$ node --import tsx/esm contracts/checks/admin-vendor-listing-serialization/check-vendor-submission-serialization.mjs
CONTROL OK: naive spread still carries 2 Timestamp instance(s): naiveSpread.submittedAt, naiveSpread.reviewedAt
FAIL: admin-vendor-listing-serialization A2 (vendor submissions listing -- the unexercised landmine)
 - GATE IMPORT FAILED: lib/firestore-serialization.ts's serializeVendorSubmission could not be imported -- Cannot find module '/Users/vetus/ai/SAOC/lib/firestore-serialization.ts' imported from ...
EXIT:1
```

**Confirmed GREEN against a correct implementation**, verified by architect (temporary
throwaway module, written outside `lib/`, deleted immediately after -- no production code was
committed by this architect pass):

```
CONTROL OK: naive spread still carries 3 Timestamp instance(s): ...
PASS: serializeVendorApplication() returns a plain, Timestamp-free, millisecond-exact structure.
EXIT_APP:0
CONTROL OK: naive spread still carries 2 Timestamp instance(s): ...
PASS: serializeVendorSubmission() returns a plain, Timestamp-free, millisecond-exact structure.
EXIT_SUB:0
```

**A8/A9 (the JSON boundary) were confirmed RED the same way** -- `lib/firestore-serialization.ts`
absent, gate import throws -- before F1/F2 landed.

**By the time this contract's widened scope (F2, A8-A13) was written, @dev had already landed
the fix for all four instances in parallel**, independently arriving at the identical design
this architect pass specifies: `lib/firestore-serialization.ts` exporting
`serializeVendorApplication`/`serializeVendorSubmission`, wired into all four call sites, old
spreads removed. All 13 assertions were re-run against the landed code and are GREEN:

```
A1:0  A2:0  A3:0  A4:0  A5:0  A6:0  A7:0  A8:0  A9:0  A10:0  A11:0  A12:0  A13:0
```

This contract remains the source of truth for the design (including the reasoning @qa/Codex
should check the implementation against) and the regression gate going forward -- the fact that
the fix already exists does not remove the need for the contract; it is the proof the fix is
correct, not merely present.

## The Codex finding, and why A1/A2 alone were not enough

Codex GPT-5.5 reviewed the landed diff and returned FAIL:

```
lib/firestore-serialization.ts:54
const VENDOR_SUBMISSION_TIMESTAMP_FIELDS = ['submittedAt', 'reviewedAt'] as const;
```

The shipped `serializeVendorSubmission()` converted only the two fields it happened to name.
`VendorSubmission` actually carries eight Date-typed fields (`types/index.ts:765-807`):
`submittedAt`, `reviewedAt`, `logoUploadedAt`, `productPhoto1UploadedAt`,
`productPhoto2UploadedAt`, `productPhoto3UploadedAt`, `proofOfPaymentUploadedAt`,
`paymentConfirmedAt`. A submission with any of the other six populated -- marketing uploads,
proof of payment, payment confirmed: precisely the middle of the flow demoed tomorrow morning
-- still handed a `Timestamp` class instance to `VendorReviewTable` and crashed the page in
exactly the way this mission exists to prevent. `VendorApplication` had the analogous gap
(9 real Timestamp-shaped fields, an early allowlist implementation named only 5).

**Why A1/A2 passed anyway: the assertion was satisfiable by something that was not the real
property.** The original fixtures seeded only `submittedAt`/`reviewedAt` (VendorSubmission) or
a 3-field subset (VendorApplication) -- a representative pair, not the full field set. An
implementation shaped exactly like the check's own fixture passes trivially regardless of what
it does with fields the fixture never exercises. This is the SAME failure this golden README
already documented as the root cause of the original production outage (an untested code path
activating the moment real data existed) -- reproduced one level up, in the contract meant to
prevent it.

**The fix, both at the implementation and at the contract:**

1. Implementation: `deepConvertTimestamps()` -- a recursive walk over the ENTIRE document
   (nested objects and arrays included, covering M2's repeating equipment/vehicle tables) that
   converts anything exposing a callable `.toDate()`, regardless of key name or depth. This
   binds to SHAPE, not to a list of names someone has to remember to update -- a field added to
   either type tomorrow is converted correctly with zero change to this module.
2. Contract, A1/A2: fixtures widened to seed EVERY real Timestamp-shaped field on each type
   (9 for VendorApplication, 8 for VendorSubmission), each with its own distinct source `Date`
   so a field-swap bug is also caught, not just a missing-conversion bug.
3. Contract, A14/A15 (new): a assertion the team lead explicitly asked for -- one that would
   fail if a NEW Timestamp-shaped field were added to either type and left unconverted, without
   needing to be told that field's name. Each seeds two SYNTHETIC fields under names invented
   for this check, appearing nowhere in `types/index.ts` or in any implementation this project
   has ever shipped (`futureApprovalTimestamp` / `futureShippingManifestTimestamp`, top-level;
   `nestedEquipmentTable[0].calibratedAt` / `nestedVehicleTable[0].inspectedAt`, inside an
   array of objects) and asserts both convert to `Date`. A hardcoded allowlist can never satisfy
   this check no matter how many real field names it is given, because it was never told these
   names -- only a shape-based (duck-typed `.toDate()`) implementation can pass it. This is the
   check that would have caught the exact defect Codex found, and will catch its recurrence,
   or the analogous one on `VendorApplication`, without ever being edited again as either type
   grows.

**RED proof for the widened A1/A2/A14/A15, against a reconstruction of the actual shipped
allowlist bug** (throwaway file, written outside `lib/`, deleted immediately after -- never
committed):

```
=== A1 vs OLD BUGGY (expect RED) ===
FAIL: admin-vendor-listing-serialization A1 (vendor applications listing)
 - GATE FAILED: ... result.registrationCodeIssuedAt, result.registrationCodeExpiresAt,
   result.registrationCodeConsumedAt, result.registrationCodeLockedAt ...
EXIT:1
=== A2 vs OLD BUGGY (expect RED) ===
FAIL: admin-vendor-listing-serialization A2 (vendor submissions listing -- the unexercised landmine)
 - GATE FAILED: ... result.logoUploadedAt, result.productPhoto1UploadedAt,
   result.productPhoto2UploadedAt, result.productPhoto3UploadedAt,
   result.proofOfPaymentUploadedAt, result.paymentConfirmedAt ...
EXIT:1
=== A14 vs OLD BUGGY (expect RED) ===
FAIL: admin-vendor-listing-serialization A14 (structural genericity -- VendorApplication)
 - GATE FAILED: unnamed/synthetic fields still carry Timestamp instance(s) ...
EXIT:1
=== A15 vs OLD BUGGY (expect RED) ===
FAIL: admin-vendor-listing-serialization A15 (structural genericity -- VendorSubmission)
 - GATE FAILED: unnamed/synthetic fields still carry Timestamp instance(s) ...
EXIT:1
```

**GREEN, re-verified against the real, currently-landed `lib/firestore-serialization.ts`**
(shape-based `deepConvertTimestamps()`, not the reconstructed allowlist):

```
A1: PASS (exit 0)   A2: PASS (exit 0)   A14: PASS (exit 0)   A15: PASS (exit 0)
```

All 15 assertions (A1-A15), every `command:` executed straight out of the parsed contract YAML
via `subprocess`, not hand-copied: 15/15 GREEN.

## A3-A7, A10-A13: wiring and removal, not just existence of the helper

A1/A2/A8/A9 prove `lib/firestore-serialization.ts` behaves correctly in isolation. They prove
NOTHING about whether any of the four call sites actually calls it -- a fix that adds the
helper but forgets to wire it in somewhere (or wires it in without removing the old line)
would pass the behavioral checks and still ship a landmine. Source assertions close that gap:

- A3: `app/admin/vendors/applications/page.tsx` calls `serializeVendorApplication(`.
- A4: `app/admin/vendors/page.tsx` calls `serializeVendorSubmission(`.
- A5: the old `{ id: doc.id, ...data } as VendorApplication` line is gone from
  `app/admin/vendors/applications/page.tsx` (grep count 0).
- A6: the old `{ id: doc.id, ...data } as VendorSubmission` line is gone from
  `app/admin/vendors/page.tsx` (grep count 0).
- A7: `lib/firestore-serialization.ts` stays Admin-SDK-free (guards against the fix collapsing
  into a thin Firestore-coupled wrapper instead of the specified pure module).
- A10: `app/api/admin/vendors/applications/route.ts` calls `serializeVendorApplication(`.
- A11: `app/api/admin/vendors/route.ts` calls `serializeVendorSubmission(`.
- A12: the old `{ id: doc.id, ...doc.data() }` line is gone from
  `app/api/admin/vendors/applications/route.ts`.
- A13: the old `{ id: doc.id, ...doc.data() }` line is gone from `app/api/admin/vendors/route.ts`.

## What this contract does NOT prove -- flagged, not silently assumed

- **It does not prove the pages render without throwing inside a live Next.js request** (no
  emulator, no live Firestore, no live RSC render harness available offline). A1/A2 prove the
  exact data shape crossing the boundary is now serializable, which is the entire mechanism of
  the crash; the production crash's own error message confirms a class instance is sufficient
  and necessary to trigger it, so removing every class instance from the boundary removes the
  crash by the same mechanism that caused it. This is the same "prove the real property via the
  SDK's own documented boundary behaviour" strategy used by
  `contracts/golden/firestore-undefined-write-safety/README.md`'s A1, not a live render.
- **"The rendered table still displays the dates correctly afterward"** (team-lead's brief) --
  checked directly: as of this pass, `components/admin/VendorApplicationReviewTable.tsx` and
  `components/admin/VendorReviewTable.tsx` do not render `submittedAt`/`reviewedAt` at all
  (confirmed by grep -- zero occurrences of either field name in either file). There is
  therefore no existing display to regress-test. What A1/A2's fidelity assertions (c) above
  substantively prove instead is that no date/time precision or timezone information is lost in
  the conversion -- so if either table is later extended to render these fields (a plain
  follow-up, not part of this P0), the value it would format is already correct. Flagged as a
  judgment call: the literal brief asked for a render-regression check where none can exist
  without inventing new UI in a P0 hotfix.
- **It does not typecheck the two page files themselves** -- P0 speed tradeoff. `tsc --noEmit`
  on the full project (not scoped to these two files) is already covered by this repo's
  existing `pnpm type-check`/CI, which will catch a shape mismatch same as any other change;
  adding a scoped `tsconfig.typecheck.json` for two files was judged not worth the extra
  round-trip time for a live-crash P0. If speed were not the binding constraint here, the
  established pattern (see `contracts/checks/vendor-gated-registration-flow-m2/`) would be to
  add one.
