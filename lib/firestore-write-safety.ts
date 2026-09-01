/**
 * Shared write-boundary helper for builders that construct Firestore documents from
 * optional-field drafts.
 *
 * The Firebase Admin SDK's Firestore client rejects any own-property whose value is
 * `undefined` at write time — a synchronous throw, before any network I/O — unless
 * `ignoreUndefinedProperties` is enabled on the Firestore instance. Some builders in this
 * codebase (buildVendorSubmission(), buildVendorApplication()) copy optional draft fields
 * field-by-field, deliberately never `{ ...input }` (see the security rationale in each
 * builder's doc comment): a caller that omits an optional input key produces a built object
 * that still carries that key, with value `undefined`. Stripping those keys here, at the
 * builder boundary, removes them before the object ever reaches a `.add()`/`.set()` call.
 *
 * Fixed at this layer rather than instance-level `ignoreUndefinedProperties` in
 * lib/firebase-admin.ts's initAdmin(): the already-safe reference builders
 * (buildMultiReservationDocs() in lib/checkout-reservation.ts, the M3 stand-payment write)
 * coalesce every optional field to a typed `null` and never rely on this distinction, so an
 * instance-level setting would be a no-op for them; scoping the fix to the two builders that
 * actually have the field-by-field-undefined shape keeps the change targeted and makes the
 * fix visible at the call site that needs it.
 *
 * See contracts/golden/firestore-undefined-write-safety/README.md for the full defect
 * writeup and sibling-builder audit.
 */
export function stripUndefinedProperties<T extends Record<string, unknown>>(value: T): T {
  const result = { ...value };
  for (const key of Object.keys(result) as (keyof T)[]) {
    if (result[key] === undefined) {
      delete result[key];
    }
  }
  return result;
}
