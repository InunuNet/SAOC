# Firestore Write Safety — Undefined Property Stripping

**Feature:** Mission `firestore-undefined-write-safety`, M1 F1. Prevents a defect class where form builders copy optional input fields field-by-field, silently producing `undefined` own-properties on the output object, which the Firestore Admin SDK rejects synchronously at write time.

**Contract:** `contracts/golden/firestore-undefined-write-safety/README.md` — the full decision record with defect analysis, proof-of-defect checks, and sibling-builder audit. **This doc is the guide; that is the specification.**

**Status:** Gated 11/11 (A1/A2 pass; vendor-gated-registration-flow M2 regression checks 52/1 skip + 13 pass). Codex GPT-5.5 cross-model passed.

---

## The Defect

`buildVendorSubmission()` and `buildVendorApplication()` construct Firestore documents by copying every field from an optional-field draft **field by field, never with a spread**. This design prevents a caller from smuggling a `status: 'approved'` or a backdated `submittedAt` through the type system.

When a caller omits an optional key (does not send it at all — not `''`, not `null`), the built object still carries that key with the literal value `undefined`:

```ts
// Draft is missing tradingName (not a key on the object at all)
const draft = { businessName: 'Orchid Co.', /* tradingName: omitted */ };
const built = buildVendorSubmission(draft, now);
// built.tradingName === undefined (own property exists, value is undefined)
```

When this object is spread into a Firestore write:

```ts
db.collection('vendorSubmissions').add({ ...built, submittedAt: now })
```

The Firebase Admin SDK validates the data **synchronously**, before any network I/O, and throws:

```
FirebaseError: Value for argument "data" is not a valid Firestore document.
Cannot use "undefined" as a Firestore value (found in field "tradingName").
If you want to ignore undefined values, enable `ignoreUndefinedProperties`.
```

**Why this matters:** A payload that passes `validateVendorSubmissionInput()` succeeds, but the submission fails at persistence — it looks accepted right up until the write throws. The caller sees no validation error, making the failure hard to diagnose.

**Masked in production only because the live registration UI always posts `''` for every optional text field it renders**, so the `undefined` path was never exercised from the browser. A direct API call, or any future caller (including a legitimate form revision) that omits a key instead of sending `''`, hits it. Found 2026-09-01 by the mandatory Codex GPT-5.5 pass during vendor-gated-registration-flow M2.

---

## Two Instances

### A1: `buildVendorSubmission()`

**File:** `lib/vendor-submissions.ts:1031`

**Write path:** `app/api/vendors/register/route.ts:172`

```ts
return stripUndefinedProperties({
  businessName: input.businessName,
  tradingName: input.tradingName,  // ← optional; undefined if omitted
  contactPersonName: input.contactPersonName,
  // ... 90+ more fields, each field-by-field
});
```

### A2: `buildVendorApplication()`

**File:** `lib/vendor-applications.ts:168`

**Write path:** `app/api/vendors/apply/route.ts:47`

Same defect, same fix pattern.

---

## The Fix

**Module:** `lib/firestore-write-safety.ts` — new shared helper for any builder that constructs a document from an optional-field draft.

```ts
export function stripUndefinedProperties<T extends Record<string, unknown>>(value: T): T {
  const result = { ...value };
  for (const key of Object.keys(result) as (keyof T)[]) {
    if (result[key] === undefined) {
      delete result[key];
    }
  }
  return result;
}
```

**Applied at the builder boundary:**

- `buildVendorSubmission()` wraps its field-by-field object construction with `stripUndefinedProperties()` before returning it (line 1041).
- `buildVendorApplication()` does the same (line 178).

**Why this layer, not `lib/firebase-admin.ts`?**

The already-safe reference builders (`buildMultiReservationDocs()` in `lib/checkout-reservation.ts`, the M3 stand-payment write in `app/api/vendors/stand-payment/initiate/route.ts:167`) coalesce every optional field to a typed `null` using `?? null` operators. They never rely on the distinction between `undefined` and an absent key, so an instance-level `ignoreUndefinedProperties` setting in `initAdmin()` would be a no-op for them.

Scoping the fix to the builders that actually have the field-by-field-undefined shape keeps the change targeted, makes the fix visible at the call site that needs it, and avoids a silent no-op on already-correct builders.

---

## Import Pattern Trap: Relative Imports Only

**Critical for builders imported by contract check scripts:**

`lib/vendor-submissions.ts` and `lib/vendor-applications.ts` are imported directly by check scripts run under plain `node` (not the Next.js build system). Node has no tsconfig path-alias resolution, so imports like `@/lib/firestore-write-safety` **silently fail to resolve**.

The import **must** be a relative path with the explicit `.ts` extension:

```ts
import { stripUndefinedProperties } from './firestore-write-safety.ts';
```

Not:

```ts
import { stripUndefinedProperties } from '@/lib/firestore-write-safety';  // ✗ fails under node
```

This caught A29 as a regression during this work. Any future builder imported into check scripts must follow the same pattern.

---

## Data-Shape Decision: Omit vs. Null

New documents simply omit the key for an absent optional field. They do not store `null`:

```ts
// If tradingName is omitted:
const built = stripUndefinedProperties({
  businessName: 'Orchid Co.',
  tradingName: input.tradingName,  // undefined
  // ... other fields
});
// Result has NO tradingName key at all
// { businessName: 'Orchid Co.', /* no tradingName key */ }
```

**Pre-existing documents are unaffected** — the live UI has always sent `''` for optional fields, so no documents have undefined values to begin with.

**No reader affected today:** The repo has no reader of `vendorSubmissions` or `vendorApplications` that reads individual optional fields — admin surfaces render only metadata, and API routes spread document data without field-level inspection. The shape change is therefore safe in production today. **Future readers must be careful:** do not use `'field' in doc` presence checks to distinguish "absent" from "empty", because optional fields now omit the key entirely when not provided.

**Deliberate difference from `buildMultiReservationDocs()`:** That builder coalesces ~7 optional fields to typed `null`. This builder has ~90 optional fields, making blanket `?? null` conversion disproportionate to a targeted fix.

---

## Known Boundary: No Recursive Stripping

`stripUndefinedProperties()` strips top-level own-properties only. Undefined values nested inside array-of-object fields are **not** recursively removed.

**Not a defect today:** `sanitizeElectricalEquipmentEntries()` and `sanitizeGasEquipmentEntries()` in `lib/vendor-submissions.ts` already project those row objects to named keys only, so any field added to those row shapes in the future would not be covered without recursive stripping.

**Future consideration:** If a genuinely optional member is added to `VendorElectricalEquipmentEntry` or `VendorGasEquipmentEntry` shapes, recursive stripping will need to be added. Document it at that time as a boundary that was previously left open.

---

## Safe Reference Pattern: Explicit Field Assignment with Null Coalescing

Don't copy this defect class to new builders. Use the pattern proven in `buildMultiReservationDocs()` (`lib/checkout-reservation.ts:49`) and the M3 stand-payment write (`app/api/vendors/stand-payment/initiate/route.ts:167`):

- Assign every field explicitly, naming each one.
- For optional fields, coalesce to a typed `null`: `field: input.field ?? null`.
- For hardcoded fields (status, timestamps, system values), use literals: `status: 'pending'`, `paidAt: null`.
- Never a `{ ...input }` spread.

Example (M3 stand-payment):

```ts
transaction.set(standOrderRef, {
  id: vendorSubmissionId,
  vendorSubmissionId,
  businessName: submissionData.businessName ?? '',      // coalesced
  contactEmail: submissionData.contactEmail ?? '',       // coalesced
  boothSize,                                             // required
  amount,                                                // required
  status: 'pending',                                     // hardcoded literal
  gateway: activeGateway,                                // required
  gatewayPaymentId: null,                                // hardcoded null
  paidAt: null,                                          // hardcoded null
  failedAt: null,                                        // hardcoded null
  createdAt: Timestamp.now(),                            // system-provided
});
```

This pattern prevents both the undefined-value bug and the class of defects where a caller could inject fields that bypass the builder's own validation.

---

## Verification

- **A1** — direct check script; proves `buildVendorSubmission()` output survives the exact write shape `app/api/vendors/register/route.ts:172` uses without throwing on undefined.
- **A2** — identical proof for `buildVendorApplication()`.
- **A29** — vendor-gated-registration-flow M2 regression gate; proves no regression on the existing gated-application flow (52 skipped assertions on multi-collection sanity; 13 pass; no drift).

---

## Files Changed

- `lib/firestore-write-safety.ts` — new module; `stripUndefinedProperties()` helper
- `lib/vendor-submissions.ts:1041` — wrap builder output with `stripUndefinedProperties()`
- `lib/vendor-applications.ts:178` — wrap builder output with `stripUndefinedProperties()`
- `contracts/golden/firestore-undefined-write-safety/README.md` — corrected factual error on check-script coverage

---

## Sources

- `contracts/golden/firestore-undefined-write-safety/README.md` — full defect analysis, proof-of-defect check construction, and sibling-builder audit
- `contracts/checks/firestore-undefined-write-safety/check-vendor-submission-undefined-roundtrip.mjs` — RED check (A1)
- `contracts/checks/firestore-undefined-write-safety/check-vendor-application-undefined-roundtrip.mjs` — RED check (A2)
