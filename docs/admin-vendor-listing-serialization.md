# Admin vendor listing — Firestore Timestamp serialisation

**Code:** [`lib/firestore-serialization.ts`](../lib/firestore-serialization.ts) — pure serialisation boundary helper for converting Firestore Timestamp class instances to native `Date` objects.

**Contract:** [`contracts/contract-admin-vendor-listing-serialization.yaml`](../contracts/contract-admin-vendor-listing-serialization.yaml), features F1 + F2. Golden spec: [`contracts/golden/admin-vendor-listing-serialization/README.md`](../contracts/golden/admin-vendor-listing-serialization/README.md).

**Status:** Fixed and deployed. Revision `saoc-prod-build-2026-09-01-008`. Authenticated page render verified by user.

## What the defect was

On 2026-09-01T19:38:50Z, the `/admin/vendors/applications` page threw a server-side 500:

```
⨯ Error: Only plain objects, and a few built-ins, can be passed to Client Components from
Server Components. Classes or null prototypes are not supported.
```

The `fetchVendorApplications()` function in `app/admin/vendors/applications/page.tsx:97` spreads raw Firestore document data straight into a `'use client'` component prop:

```ts
return { id: doc.id, ...data } as VendorApplication;
```

Firestore's `doc.data()` returns timestamp-shaped fields as **class instances** (`Timestamp`), not plain data. A class instance cannot cross the Server→Client Component (RSC) boundary.

The defect was invisible until a real document existed. With an empty `vendorApplications` collection, an empty array serialises fine regardless of what shape its zero elements would carry. The crash activated the moment the first application was submitted—the collection then contained five documents.

### The latent twin

`app/admin/vendors/page.tsx:108` carries the identical pattern:

```ts
return { id: doc.id, ...data } as VendorSubmission;
```

`vendorSubmissions` is empty today; the page renders correctly. It would throw the instant the first vendor completed full registration—precisely the middle of the flow demoed on 2026-09-02. Fixing only the already-crashed page and leaving this one unfixed would ship a landmine at the exact next step of the same flow.

### The silent JSON variant

A grep of all raw `doc.data()` spreads under `app/` found exactly four instances:

1. `app/admin/vendors/applications/page.tsx:97` — already crashed in production.
2. `app/admin/vendors/page.tsx:108` — unfixed twin, above.
3. `app/api/admin/vendors/applications/route.ts:33` — GET handler, returns JSON.
4. `app/api/admin/vendors/route.ts:34` — GET handler, returns JSON.

Instances 3 and 4 do the identical raw spread into a `NextResponse.json()` response instead of a `'use client'` component prop. `JSON.stringify` does not throw on a class instance the way RSC serialisation does. Instead, it silently calls into the Firestore `Timestamp` class's internal shape and emits `{"_seconds": N, "_nanoseconds": N}` for every timestamp field—leaking Firestore's wire format and disagreeing with how every other date already crosses this project's API surface.

This is the more dangerous variant of the same defect. The RSC instance fails loudly: a 500, a stack trace, a demo-blocking crash impossible to miss. The JSON instance fails silently: a 200 response with a plausible object where a date should be, that a careless caller could ship straight into a UI. Both routes were orphaned at the time of fix (no caller round-trips through either; the admin pages read Firestore directly), but both were live, authenticated, and reachable. They were fixed in the same pass rather than left as known-wrong endpoints behind a now-fixed UI.

## The fix

New pure module `lib/firestore-serialization.ts` (no Firebase Admin SDK import, no Firestore read/write, mirroring `lib/firestore-write-safety.ts`'s existing pattern):

- `serializeVendorApplication(id: string, data: Record<string, unknown>): VendorApplication`
- `serializeVendorSubmission(id: string, data: Record<string, unknown>): VendorSubmission`

Both convert **by structure, not by a hardcoded field-name list**. A recursive `deepConvertTimestamps()` walk converts anything exposing a callable `.toDate()` (duck-typed; a Firestore `Timestamp` class instance) to a native `Date`, regardless of key name or depth—including nested objects and arrays (e.g., M2's repeating equipment and vehicle tables). A `null`-valued field stays `null`; every other field passes through unchanged.

The two page files switch their `.map()` body:

```ts
// app/admin/vendors/applications/page.tsx
return serializeVendorApplication(doc.id, doc.data());

// app/admin/vendors/page.tsx
return serializeVendorSubmission(doc.id, doc.data());
```

The old `{ id: doc.id, ...data } as VendorApplication` / `as VendorSubmission` lines, and the comments justifying them as "UI-only and not itself contract-tested", are **removed**—not left alongside the new code. A fix that adds the helper but leaves the old spread live still crashes.

The two API routes reuse the same functions:

```ts
// app/api/admin/vendors/applications/route.ts and app/api/admin/vendors/route.ts
const applications = snapshot.docs.map((doc) => serializeVendorApplication(doc.id, doc.data()));
```

`NextResponse.json()` calls `Date.prototype.toJSON()` natively on every `Date` value, which yields an ISO 8601 string—matching the convention already established by `app/api/admin/export-csv/route.ts:27–28` and `components/admin/TicketsTable.tsx:13`.

### Why not a field-name allowlist

An earlier version of this module used `VENDOR_SUBMISSION_TIMESTAMP_FIELDS = ['submittedAt', 'reviewedAt']` and claimed that list was exhaustive. It silently missed seven real Date-typed fields on `VendorSubmission`:

- `logoUploadedAt`, `productPhoto1UploadedAt`, `productPhoto2UploadedAt`, `productPhoto3UploadedAt`
- `proofOfPaymentUploadedAt`
- `paymentConfirmedAt`

A submission with any of these fields populated—marking uploads as received, payment confirmed—still handed a `Timestamp` class instance to `VendorReviewTable` and crashed the page. A field-name list re-breaks silently the instant a new Timestamp-shaped field is added to either document type, with no test failing.

The fix converts by shape instead. Future fields are converted correctly with zero change to this module; the implementation can never miss a field this document shape has today or gains later.

## Why the first pass failed contract

The shipped implementation passed A1 and A2 (the behavioural checks) but was caught by the mandatory Codex GPT-5.5 cross-model review. Codex found the hardcoded allowlist bug that Claude's own @qa had approved.

The root cause: the original fixtures seeded only a subset of real Timestamp fields. An implementation shaped exactly like the check's own fixture passed trivially, regardless of what it did with fields the fixture never exercised. This reproduced, one level up, the exact failure that caused the original production outage—an untested code path that activates the moment real data exists.

### Rewritten checks

A1 and A2 now seed **every real Timestamp-shaped field** on each type:

- `VendorApplication`: 9 fields—`submittedAt`, `reviewedAt`, `registrationTokenIssuedAt`, `registrationTokenExpiresAt`, `registrationTokenConsumedAt`, `registrationCodeIssuedAt`, `registrationCodeExpiresAt`, `registrationCodeConsumedAt`, `registrationCodeLockedAt`.
- `VendorSubmission`: 8 fields—the two above plus `logoUploadedAt`, `productPhoto1UploadedAt`, `productPhoto2UploadedAt`, `productPhoto3UploadedAt`, `proofOfPaymentUploadedAt`, `paymentConfirmedAt`.

Each field carries a distinct source `Date`, so a field-swap bug is also caught, not just a missing-conversion bug.

A14 and A15 (new assertions) seed **synthetic Timestamp-shaped field names** that appear nowhere in `types/index.ts` or in any implementation this project has shipped (`futureApprovalTimestamp`, `futureShippingManifestTimestamp`, and nested fields inside an array of objects). A hardcoded allowlist cannot satisfy this check no matter how many real field names it is given—only a shape-based implementation can pass. This check catches the exact defect Codex found and will catch its recurrence without ever being edited as either type evolves.

## Existing reference patterns

Two places in this codebase already converted Firestore Timestamps correctly:

- `components/admin/TicketsTable.tsx:13` — `new Date(ticket.purchasedAt.toMillis()).toISOString()`. The page is a plain Server Component; raw `Timestamp` never crosses the RSC boundary.
- `app/api/admin/export-csv/route.ts:27–28` — the same conversion pattern for the CSV/JSON path.

Both converge on ISO 8601 string as the convention for a date crossing any boundary. The fix converts `Timestamp` → `Date` (matching these types' own native `Date` declaration and safe to pass across the RSC boundary directly), and `NextResponse.json()` converts `Date` → ISO 8601 string natively—producing the identical output shape through one shared conversion path.

## Deploy blocker resolved

Three consecutive Firebase App Hosting builds failed at the preparer step:

```
PermissionDenied
Failed to authenticate with Secret Manager. Please verify your credentials and permissions.
```

The secret `VENDOR_REGISTRATION_TOKEN_SECRET` existed and was readable at runtime, but App Hosting resolves secrets **before compiling**. The build service account had no access.

Granting access by hand to the inferred service account did not work. The fix was:

```bash
firebase apphosting:secrets:grantaccess VENDOR_REGISTRATION_TOKEN_SECRET --backend saoc-prod
```

Nothing deployed for two hours; the site served old code with no visible signal of the build failure.

## Testing note

This contract does not prove the pages render without throwing inside a live Next.js request (no emulator, no live Firestore, no live RSC render harness available offline). The contract proves the exact data shape crossing the boundary is now serialisable; removing every class instance from the boundary removes the crash by the same mechanism that caused it. The production crash's own error message confirms this.
