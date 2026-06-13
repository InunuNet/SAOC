import { Resend } from 'resend';
import { JSX } from 'react';

let resend: Resend | null = null;

function getResend(): Resend {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

export async function sendEmail({
  to,
  subject,
  react,
}: {
  to: string;
  subject: string;
  react: JSX.Element;
}): Promise<void> {
  const from = process.env.RESEND_FROM_ADDRESS ?? 'SAOC <noreply@saoc.co.za>';
  const { error } = await getResend().emails.send({ from, to, subject, react });
  if (error) throw new Error(`Resend send failed: ${error.message}`);
}
