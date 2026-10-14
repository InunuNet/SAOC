/**
 * Short, token-free gateway return URL for vendor stand payments, and the pure resolver for the
 * status page it points at. Success, cancel and error all share one URL carrying only the
 * server-minted attempt id; the page decides what to show from the stored order, never from the
 * URL. No imports: loadable by plain node.
 */
export const VENDOR_STAND_RETURN_PATH = '/national-show/vendors/payment/status';

/** Attempt ids are `randomBytes(8).toString('hex')`: 16 lowercase hex characters. */
export const ATTEMPT_ID_PATTERN = /^[0-9a-f]{16}$/;

export type VendorStandReturnState = 'paid' | 'pending' | 'not-completed';

export function buildVendorStandReturnUrl(siteUrl: string, attemptId: string): string {
  if (typeof attemptId !== 'string' || !ATTEMPT_ID_PATTERN.test(attemptId)) {
    throw new Error('[vendor-stand-return] Malformed attempt id; refusing to build a return URL.');
  }
  return `${siteUrl.replace(/\/$/, '')}${VENDOR_STAND_RETURN_PATH}?a=${attemptId}`;
}

export interface ResolveVendorStandReturnStateInput {
  /** Untrusted: whatever the query string carried. */
  attemptId: unknown;
  loadOrderStatus: (attemptId: string) => Promise<string | null | undefined>;
}

/**
 * Exact stored `paid` -> paid; exact `pending` -> pending; any other value, a missing order, or a
 * malformed attempt id -> not-completed (the loader is never called for a malformed id). A loader
 * failure resolves to the neutral pending state so a possibly-paid vendor is never told to retry.
 */
export async function resolveVendorStandReturnState(
  input: ResolveVendorStandReturnStateInput,
): Promise<VendorStandReturnState> {
  const { attemptId, loadOrderStatus } = input;
  if (typeof attemptId !== 'string' || !ATTEMPT_ID_PATTERN.test(attemptId)) {
    return 'not-completed';
  }
  let stored: string | null | undefined;
  try {
    stored = await loadOrderStatus(attemptId);
  } catch {
    return 'pending';
  }
  if (stored === 'paid') return 'paid';
  if (stored === 'pending') return 'pending';
  return 'not-completed';
}
