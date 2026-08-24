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

// "Enable Receiving" is deliberately OFF on both sending subdomains (send-only by design), so
// FROM is a dead end for anyone who hits Reply. reply_to gives replies a real inbox to land in.
// Resolved at CALL time (not module-load time like the *_FROM_ADDRESS constants above) so a
// blank/unset env var always falls back safely instead of baking a stale value in at import.
const DEFAULT_REPLY_TO = 'info@saoc.co.za';

export function resolveReplyTo(): string {
  const raw = process.env.RESEND_REPLY_TO?.trim();
  return raw ? raw : DEFAULT_REPLY_TO;
}

// ticket-confirmation-email-qr-fix (F1) — attachment shape matching Resend's own Attachment
// interface field-for-field (content/filename/contentType/contentId), so it threads straight
// into getResend().emails.send() with no adapter layer to keep in sync.
export interface EmailAttachment {
  content: Buffer;
  filename: string;
  contentType: string;
  contentId: string;
}

export function buildEmailPayload({
  to,
  subject,
  react,
  from,
  attachments,
}: {
  to: string;
  subject: string;
  react: JSX.Element;
  from: string;
  attachments?: EmailAttachment[];
}): {
  to: string;
  subject: string;
  react: JSX.Element;
  from: string;
  replyTo: string;
  attachments?: EmailAttachment[];
} {
  return {
    to,
    subject,
    react,
    from,
    replyTo: resolveReplyTo(),
    ...(attachments !== undefined ? { attachments } : {}),
  };
}

export async function sendEmail({
  to,
  subject,
  react,
  from,
  attachments,
}: {
  to: string;
  subject: string;
  react: JSX.Element;
  from: string;
  attachments?: EmailAttachment[];
}): Promise<void> {
  const { error } = await getResend().emails.send(
    buildEmailPayload({ to, subject, react, from, attachments })
  );
  if (error) throw new Error(`Resend send failed: ${error.message}`);
}
