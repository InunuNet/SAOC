// lib/ticket-type-emails-switch.ts
// Mission ticket-email-samples -- the single off switch for Lee-Ann's per-ticket-type confirmation
// emails. While false, sendConfirmationEmail sends the generic order confirmation exactly as
// before. Flipped by one reviewed edit after Lee-Ann approves the sample PDFs. Same convention as
// lib/ticketing-test-mode.ts; it does not touch the payment-live or public-launch switches.
export const TICKET_TYPE_EMAILS_LIVE = false;

export function isTicketTypeEmailsLive(): boolean {
  return TICKET_TYPE_EMAILS_LIVE;
}
