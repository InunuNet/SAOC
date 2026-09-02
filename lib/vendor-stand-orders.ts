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

/** F3 (vendor-stand-payment-confirm-gate) -- separates the base `VSO-{vendorSubmissionId}`
 *  reference from a per-payment-attempt identifier, e.g. `VSO-abc123::a1b2c3`. Threaded through
 *  the already-gateway-echoed `reference` field (both payfast.ts and ozow.ts round-trip it
 *  verbatim into `notification.reference` with zero adapter changes) so the settlement handler
 *  can tell a notification belonging to the CURRENT live payment attempt apart from a stale
 *  notification belonging to an earlier, superseded attempt for the same vendor submission --
 *  see contracts/golden/vendor-stand-payment-confirm-gate/README.md "F3" for the full decision
 *  record. */
export const VENDOR_STAND_ORDER_REF_ATTEMPT_SEPARATOR = '::';

/** `standOrderRef` for a given vendorSubmissionId -- the ONLY place this format is composed. */
export function buildVendorStandOrderRef(vendorSubmissionId: string): string {
  return `${VENDOR_STAND_ORDER_REF_PREFIX}${vendorSubmissionId}`;
}

/** F3 (vendor-stand-payment-confirm-gate) -- the per-attempt reference actually handed to
 *  `paymentProvider.initiate()`. Not used for the document id or the stored `standOrderRef`
 *  field (both remain the base, attempt-less form) -- only for the value the gateway is told
 *  to echo back on notifications, so the settlement handler can recover which attempt a given
 *  notification belongs to. */
export function buildVendorStandOrderReference(vendorSubmissionId: string, attemptId: string): string {
  return `${buildVendorStandOrderRef(vendorSubmissionId)}${VENDOR_STAND_ORDER_REF_ATTEMPT_SEPARATOR}${attemptId}`;
}

/**
 * Inverse of buildVendorStandOrderRef -- strips the fixed `VSO-` prefix and, if present, the
 * `::{attemptId}` suffix, returning ONLY the leading vendorSubmissionId. Returns null on a
 * missing/malformed prefix (empty reference, no prefix at all, or an empty id after the
 * prefix) rather than throwing; the settlement handler treats a null result as "no-op, log
 * and stop", never as a stand-in for a real submission id. Callers that never see the attempt
 * suffix (e.g. admin review pages reading the stored `standOrderRef` field) are unaffected.
 */
export function parseVendorSubmissionIdFromStandOrderRef(reference: string | null): string | null {
  if (!reference || !reference.startsWith(VENDOR_STAND_ORDER_REF_PREFIX)) {
    return null;
  }
  const withoutPrefix = reference.slice(VENDOR_STAND_ORDER_REF_PREFIX.length);
  const separatorIndex = withoutPrefix.indexOf(VENDOR_STAND_ORDER_REF_ATTEMPT_SEPARATOR);
  const vendorSubmissionId = separatorIndex === -1 ? withoutPrefix : withoutPrefix.slice(0, separatorIndex);
  return vendorSubmissionId.length > 0 ? vendorSubmissionId : null;
}

/**
 * F3 (vendor-stand-payment-confirm-gate) -- extracts ONLY the `::{attemptId}` suffix from a
 * stand-order reference, or null if the reference carries no attempt suffix at all (a
 * pre-fix/migration-window reference, or a malformed/missing reference). Never throws --
 * mirrors parseVendorSubmissionIdFromStandOrderRef's fail-closed-by-null shape.
 */
export function parseAttemptIdFromStandOrderRef(reference: string | null): string | null {
  if (!reference || !reference.startsWith(VENDOR_STAND_ORDER_REF_PREFIX)) {
    return null;
  }
  const withoutPrefix = reference.slice(VENDOR_STAND_ORDER_REF_PREFIX.length);
  const separatorIndex = withoutPrefix.indexOf(VENDOR_STAND_ORDER_REF_ATTEMPT_SEPARATOR);
  if (separatorIndex === -1) {
    return null;
  }
  const attemptId = withoutPrefix.slice(separatorIndex + VENDOR_STAND_ORDER_REF_ATTEMPT_SEPARATOR.length);
  return attemptId.length > 0 ? attemptId : null;
}
