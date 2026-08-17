/**
 * Pure response-shape builder for the resend-my-tickets endpoint (mission ticketing-foundation
 * F6, spec §8.2(b)). See contracts/golden/ticketing-f6-recovery-token/README.md for the full
 * decision record.
 *
 * Makes email enumeration structurally impossible: the caller-facing response is always the
 * exact same shared object reference, regardless of whether the email matched a real order or
 * the request was rate-limited. `shouldSend`/`logReason` are for server-side logging only and
 * must never be serialised into `publicResponse`.
 */

export const RESEND_MY_TICKETS_PUBLIC_RESPONSE = {
  status: 200,
  body: { message: 'If that email address matches an order, a recovery link has been sent.' },
} as const;

export interface ResendDecisionInput {
  orderMatched: boolean;
  rateLimited: boolean;
}

export interface ResendDecisionResult {
  publicResponse: typeof RESEND_MY_TICKETS_PUBLIC_RESPONSE;
  shouldSend: boolean;
  logReason: 'sent' | 'no-match' | 'rate-limited';
}

export function decideResendOutcome(input: ResendDecisionInput): ResendDecisionResult {
  const shouldSend = input.orderMatched && !input.rateLimited;
  const logReason: ResendDecisionResult['logReason'] = input.rateLimited
    ? 'rate-limited'
    : input.orderMatched
      ? 'sent'
      : 'no-match';

  return {
    publicResponse: RESEND_MY_TICKETS_PUBLIC_RESPONSE,
    shouldSend,
    logReason,
  };
}
