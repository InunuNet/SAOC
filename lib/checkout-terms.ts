// Terms acceptance at checkout. Terms 5.1 and 7 (26 Nov 2026 masters): the customer confirms, before
// paying, that they accept the Terms and Conditions and the Refund and Cancellation Policy, and the
// version in force when they buy is the one that applies. The checkout route refuses any request
// that does not carry that confirmation for the versions currently published.
import { REFUND_POLICY_LAST_UPDATED } from '@/content/legal/refunds';
import { TERMS_LAST_UPDATED } from '@/content/legal/terms';

export interface TermsVersions {
  termsVersion: string;
  refundPolicyVersion: string;
}

export interface TermsAcceptanceBody extends TermsVersions {
  termsAccepted: true;
}

/** The versions a checkout must accept today: the "Last updated" dates of the two masters. */
export const CURRENT_TERMS_VERSIONS: TermsVersions = {
  termsVersion: TERMS_LAST_UPDATED,
  refundPolicyVersion: REFUND_POLICY_LAST_UPDATED,
};

/** The Refund policy's title as running text: the master's own title is set in capitals. */
export const REFUND_POLICY_DISPLAY_TITLE = 'Refund and Cancellation Policy';

export const TERMS_NOT_ACCEPTED_ERROR = `You must confirm that you have read and accept the Terms and Conditions and the ${REFUND_POLICY_DISPLAY_TITLE} before paying.`;
export const TERMS_VERSION_STALE_ERROR =
  'The Terms and Conditions or the Refund and Cancellation Policy have been updated. Please reload the page, read them and confirm again.';

export type TermsCheck = { ok: true } | { ok: false; error: string };

/** Pure. Untrusted body in; only an explicit `true` for the current versions passes. */
export function checkTermsAcceptance(
  body: { termsAccepted?: unknown; termsVersion?: unknown; refundPolicyVersion?: unknown },
  current: TermsVersions = CURRENT_TERMS_VERSIONS
): TermsCheck {
  if (body.termsAccepted !== true) return { ok: false, error: TERMS_NOT_ACCEPTED_ERROR };
  if (
    body.termsVersion !== current.termsVersion ||
    body.refundPolicyVersion !== current.refundPolicyVersion
  ) {
    return { ok: false, error: TERMS_VERSION_STALE_ERROR };
  }
  return { ok: true };
}
