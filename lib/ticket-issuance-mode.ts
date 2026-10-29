// lib/ticket-issuance-mode.ts
// Mission nos-security-tiered-access F4 (SEC-06) -- the value stamped on a new order or ticket as
// `issuedInTestMode`. Client-safe: imports one pure module, reads no env and does no I/O.
//
// The launch constant alone is not enough: if it flips while the payment adapters still point at
// the sandbox, sandbox-paid orders would be stamped `false` and the door would admit them. A new
// document is stamped `false` only when BOTH switches are flipped. Flip PAYMENT_GATEWAYS_SANDBOX_ONLY
// in the same reviewed go-live commit as TICKETING_PAYMENTS_LIVE and the payment adapters;
// contracts/checks/door-reject-test-tickets/gateway-coupling.sh fails the build if it is flipped alone.
import { isTicketingTestMode } from '@/lib/ticketing-test-mode';

export const PAYMENT_GATEWAYS_SANDBOX_ONLY = true;

export function isIssuanceTestMode(): boolean {
  return isTicketingTestMode() || PAYMENT_GATEWAYS_SANDBOX_ONLY;
}
