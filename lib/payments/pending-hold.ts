/**
 * F31 (launch-weekend) -- how long a gateway "Pending" / "PendingInvestigation" report holds a
 * ticket seat and locks a vendor stand re-initiate. Ozow publishes no SLA for a manual
 * investigation, so this is a deliberate, single-constant policy (72 h, orchestrator decision).
 * Provider-neutral: nothing here names a gateway.
 */
export const PENDING_PAYMENT_HOLD_MINUTES = 4320;

const MS_PER_MINUTE = 60_000;

/** Server instances can disagree by a little; a marker further in the future than this is not a
 *  real recording, so it is treated as malformed (inactive) rather than extending the lockout. */
const MAX_CLOCK_SKEW_MS = 5 * MS_PER_MINUTE;

/** Existing ConfirmationPoller wording, reused verbatim for the vendor pending notice
 *  (docs/rules/no-invention.md -- no new user-facing copy). */
export const PENDING_NOTICE_HEADING = 'Confirming your payment';
export const PENDING_NOTICE_BODY =
  "We're still waiting for payment confirmation. Please don't refresh or submit payment again.";

/** Structural, so this module needs no firebase-admin import and stays usable from a page. */
interface TimestampLike {
  toMillis(): number;
}

function isTimestampLike(value: unknown): value is TimestampLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { toMillis?: unknown }).toMillis === 'function'
  );
}

/**
 * True iff the stored gatewayPending marker was recorded within the hold window (a timestamp in
 * the future beyond clock skew does not count). A missing or malformed marker is inactive: a
 * bad document must never be able to lock a vendor out.
 */
export function isPendingPaymentHoldActive(marker: unknown, now: Date = new Date()): boolean {
  if (typeof marker !== 'object' || marker === null) return false;
  const at = (marker as { at?: unknown }).at;
  if (!isTimestampLike(at)) return false;
  const atMillis = at.toMillis();
  if (!Number.isFinite(atMillis)) return false;
  const elapsedMs = now.getTime() - atMillis;
  const holdMs = PENDING_PAYMENT_HOLD_MINUTES * MS_PER_MINUTE;
  return elapsedMs >= -MAX_CLOCK_SKEW_MS && elapsedMs < holdMs;
}
