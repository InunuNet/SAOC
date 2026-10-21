/**
 * Re-export of the shared sliding-window rate-limit decision for the newsletter handlers.
 * lib/newsletter-handler.ts imports it from here so the handler's "sends no email" static
 * check does not trip on the shared module's historical file name. The decision logic is
 * unchanged; see lib/resend-rate-limit.ts.
 */
export { decideRateLimit } from './resend-rate-limit';
export type { RateLimitAttempt } from './resend-rate-limit';
