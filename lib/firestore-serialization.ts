/**
 * Pure serialization boundary helper -- converts raw Firestore document data into the
 * plain, RSC-safe shapes VendorApplication and VendorSubmission are typed as.
 *
 * No Firebase Admin SDK import, no Firestore/network I/O -- mirrors
 * lib/firestore-write-safety.ts's existing "pure write-boundary helper" pattern in this repo.
 * Timestamp detection is duck-typed on `typeof value.toDate === 'function'` (matching the
 * existing pattern in app/api/vendors/register/verify-code/route.ts's toCandidate()), not an
 * `instanceof Timestamp` import from firebase-admin/firestore -- this keeps the module free of
 * any Admin SDK dependency and directly unit-testable with a plain object stand-in.
 *
 * Why this exists: Firestore's `doc.data()` returns Timestamp-shaped fields as `Timestamp`
 * CLASS INSTANCES, not plain data. A class instance cannot cross the Server->Client Component
 * RSC boundary ("Only plain objects, and a few built-ins, can be passed to Client Components
 * from Server Components"). Spreading `{ id: doc.id, ...data }` straight into a 'use client'
 * component's props crashes the page the moment a real document exists. See
 * contracts/golden/admin-vendor-listing-serialization/README.md for the full defect writeup.
 *
 * The conversion rule is STRUCTURAL, not a hardcoded field-name allowlist: a prior version of
 * this module converted only a fixed list of named fields and its own doc comment wrongly
 * claimed that list was exhaustive -- it silently missed seven Date-typed fields on
 * VendorSubmission (logoUploadedAt, productPhoto1-3UploadedAt, proofOfPaymentUploadedAt,
 * paymentConfirmedAt), any one of which still crashes the page the moment it's populated. A
 * field-name list re-breaks the instant a new Timestamp-shaped field is added anywhere in
 * either document, silently, with no test failing. Instead, `deepConvertTimestamps()` walks
 * the ENTIRE document recursively (including nested objects and arrays, e.g. M2's repeating
 * equipment tables) and converts anything exposing a callable `.toDate()`, regardless of its
 * key name -- so it can never miss a field this document shape has today, or gains later.
 */

import type { VendorApplication, VendorSubmission } from '@/types/index';

/** Duck-typed Timestamp check -- true for anything with a callable `.toDate()`, which is all
 *  that's needed to distinguish a Firestore Timestamp from every other value shape these
 *  documents carry (string, number, boolean, array, plain object, null, undefined, Date). */
function hasToDate(value: unknown): value is { toDate: () => Date } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  );
}

/**
 * Recursively converts every Timestamp-shaped value anywhere in `value` to a native Date --
 * at any depth, under any key name, inside plain objects and arrays alike (M2's repeating
 * equipment/vehicle tables included). `null`/`undefined` pass through unchanged; an already-
 * native `Date` is returned as-is (never recursed into); every other primitive and plain
 * object/array is walked and rebuilt with converted children.
 */
function deepConvertTimestamps(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (hasToDate(value)) return value.toDate();
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map((entry) => deepConvertTimestamps(entry));
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      result[key] = deepConvertTimestamps(entry);
    }
    return result;
  }
  return value;
}

/**
 * Converts a raw vendorApplications document (as returned by `doc.data()`) into a plain,
 * RSC-safe VendorApplication -- every Timestamp-shaped value anywhere in the document
 * (submittedAt, reviewedAt, the registrationToken/registrationCode fields, and any future
 * Timestamp-shaped field, at any depth) becomes a native Date; a null-valued field stays
 * null; every other field passes through unchanged.
 */
export function serializeVendorApplication(
  id: string,
  data: Record<string, unknown>,
): VendorApplication {
  const converted = deepConvertTimestamps(data) as Record<string, unknown>;
  return { id, ...converted } as unknown as VendorApplication;
}

/**
 * Converts a raw vendorSubmissions document (as returned by `doc.data()`) into a plain,
 * RSC-safe VendorSubmission -- every Timestamp-shaped value anywhere in the document
 * (submittedAt, reviewedAt, the marketing-upload/proof-of-payment/payment-confirmation
 * timestamps, and any future Timestamp-shaped field, at any depth, including nested
 * equipment/vehicle tables) becomes a native Date; a null-valued field stays null; every
 * other field passes through unchanged.
 */
export function serializeVendorSubmission(
  id: string,
  data: Record<string, unknown>,
): VendorSubmission {
  const converted = deepConvertTimestamps(data) as Record<string, unknown>;
  return { id, ...converted } as unknown as VendorSubmission;
}
