/**
 * M3 (vendor-gated-registration-flow, F26) -- shared constants for the `vendorStandOrders`
 * collection. A NEW sibling collection, doc id === vendorSubmissionId -- see
 * contracts/golden/vendor-gated-registration-flow-m3/README.md "Why the doc id is the
 * submission id" and "The crux decision" for the full reasoning.
 *
 * Pure -- no Firestore import. Every module that reads/writes vendorStandOrders imports the
 * collection name from here, never re-literals the string.
 */

export const VENDOR_STAND_ORDERS_COLLECTION = 'vendorStandOrders';

export const VENDOR_STAND_ORDER_REF_PREFIX = 'VSO-';

/** `standOrderRef` for a given vendorSubmissionId -- the ONLY place this format is composed. */
export function buildVendorStandOrderRef(vendorSubmissionId: string): string {
  return `${VENDOR_STAND_ORDER_REF_PREFIX}${vendorSubmissionId}`;
}

/**
 * Inverse of buildVendorStandOrderRef -- strips the fixed `VSO-` prefix. Returns null on a
 * missing/malformed prefix (empty reference, no prefix at all, or an empty id after the
 * prefix) rather than throwing; the settlement handler treats a null result as "no-op, log
 * and stop", never as a stand-in for a real submission id.
 */
export function parseVendorSubmissionIdFromStandOrderRef(reference: string | null): string | null {
  if (!reference || !reference.startsWith(VENDOR_STAND_ORDER_REF_PREFIX)) {
    return null;
  }
  const vendorSubmissionId = reference.slice(VENDOR_STAND_ORDER_REF_PREFIX.length);
  return vendorSubmissionId.length > 0 ? vendorSubmissionId : null;
}
