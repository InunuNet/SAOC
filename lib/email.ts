import { Resend } from 'resend';
import { JSX } from 'react';

let resend: Resend | null = null;

function getResend(): Resend {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

// Sending domains are segregated by category (Brad's call, 2026-08-18) rather than shared,
// so a deliverability problem on one category (e.g. a marketing send) can't drag down another
// (e.g. ticket confirmations). Add a new *_FROM_ADDRESS + env var pair when a new category of
// email is introduced, rather than routing it through an existing one.
export const TICKETS_FROM_ADDRESS =
  process.env.RESEND_FROM_TICKETS ?? 'SAOC Tickets <tickets@tickets.saoc.co.za>';
export const FORMS_FROM_ADDRESS =
  process.env.RESEND_FROM_FORMS ?? 'SAOC <noreply@forms.saoc.co.za>';

export async function sendEmail({
  to,
  subject,
  react,
  from,
}: {
  to: string;
  subject: string;
  react: JSX.Element;
  from: string;
}): Promise<void> {
  const { error } = await getResend().emails.send({ from, to, subject, react });
  if (error) throw new Error(`Resend send failed: ${error.message}`);
}
