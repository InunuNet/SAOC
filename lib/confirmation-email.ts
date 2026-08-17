import type { TicketType } from '@/types/index';

/**
 * F10 (ticketing-foundation) — the F10/F11 boundary for the post-purchase confirmation email.
 *
 * F10 owns the hookup call site (strictly after the order/position transaction commits, see
 * app/api/tickets/itn/route.ts step 5), the input shape below, and a MINIMAL STUB
 * implementation of sendConfirmationEmail() that logs the payload's shape only — never a
 * recovery token's value, never a full attendee dump — and does not call Resend.
 *
 * F11 owns QR generation, the real email template/content, and swapping Resend in for real
 * delivery. F11 replaces sendConfirmationEmail's body only; it does not need to touch the
 * pinned ITN route again. See contracts/golden/ticketing-f10-itn-repin/README.md "The F10/F11
 * boundary".
 */

export interface ConfirmationEmailPosition {
  bookingRef: string;
  attendeeName: string;
  ticketType: TicketType;
}

export interface SendConfirmationEmailInput {
  orderId: string;
  buyerEmail: string;
  buyerName: string;
  positions: ConfirmationEmailPosition[];
  recoveryToken: string | null;
}

/**
 * MINIMAL STUB (F10) — logs the payload's shape only (order id, buyer email, position count,
 * and WHETHER a recovery token is present, never its value) and does not send a real email.
 * F11 replaces this body with real Resend delivery and QR generation.
 *
 * NEVER log recoveryToken's value, a signature, a passphrase, or any credential — this project
 * has an absolute rule against credential exposure in logs.
 */
export async function sendConfirmationEmail(input: SendConfirmationEmailInput): Promise<void> {
  console.log('[confirmation-email] stub send — F11 will replace this with real Resend delivery', {
    orderId: input.orderId,
    buyerEmail: input.buyerEmail,
    positionCount: input.positions.length,
    hasRecoveryToken: input.recoveryToken !== null,
  });
}

/**
 * Isolation wrapper the pinned ITN route calls strictly AFTER its order/position transaction
 * commits. Awaits `send()`; on ANY failure — a synchronous throw or an async rejection —
 * reports the real error to `onError` and resolves normally. NEVER rethrows.
 *
 * This is the load-bearing "money is more important than a delivery receipt" property: a
 * failed confirmation email must never roll back, retry, or put an already-committed payment
 * at risk.
 */
export async function deliverConfirmationEmailAfterCommit(
  send: () => Promise<void>,
  onError: (error: unknown) => void
): Promise<void> {
  try {
    await send();
  } catch (error) {
    onError(error);
  }
}
