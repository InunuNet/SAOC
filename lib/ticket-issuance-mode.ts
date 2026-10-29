// lib/ticket-issuance-mode.ts
// Mission nos-security-tiered-access F4 (SEC-06) -- the value stamped on a new order or ticket as
// `issuedInTestMode`. Client-safe: it imports only pure modules and reads no env.
//
// The launch constant alone is not enough: if it flips while a payment adapter still points at
// the sandbox, sandbox-paid orders would be stamped `false` and the door would admit them. The
// sandbox flag is therefore derived from the flags the adapters themselves read
// (lib/payments/sandbox-mode.ts), so no hand-flipped flag can disagree with adapter state. A new document is stamped `false` only when
// the launch constant is live AND every adapter has left the sandbox.
import { OZOW_SANDBOX_MODE, PAYFAST_SANDBOX_MODE } from '@/lib/payments/sandbox-mode';
import { isTicketingTestMode } from '@/lib/ticketing-test-mode';

export const PAYMENT_GATEWAYS_SANDBOX_ONLY = OZOW_SANDBOX_MODE || PAYFAST_SANDBOX_MODE;

export function isIssuanceTestMode(): boolean {
  return isTicketingTestMode() || PAYMENT_GATEWAYS_SANDBOX_ONLY;
}
