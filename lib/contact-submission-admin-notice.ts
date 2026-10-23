import React from 'react';

import { sendEmail, FORMS_FROM_ADDRESS } from '@/lib/email';
import { getAdminNotifyRecipients } from '@/lib/admin-notify-recipients';
import ContactSubmissionAdminNotice from '@/emails/ContactSubmissionAdminNotice';

/**
 * Admin notice fired once when a contact message is stored (mission admin-form-notices).
 * Same shape as lib/sponsor-enquiry-admin-notice.ts. Recipients resolve EXCLUSIVELY via the
 * allowlist helper, never from the submitter's own details.
 *
 * The only logging permitted in this file is one non-PII warning, fired when the resolved
 * recipient list is empty.
 */

export interface ContactSubmissionAdminNoticeInput {
  submissionId: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  submittedAt: Date;
}

/** Deliberately narrow: matches what lib/email.ts's real `sendEmail` already satisfies. */
export interface ContactSubmissionAdminNoticeMailer {
  send(args: { to: string; subject: string; react: React.ReactElement; from?: string }): Promise<void>;
}

export interface SendContactSubmissionAdminNoticeDeps {
  mailer?: ContactSubmissionAdminNoticeMailer;
}

export async function sendContactSubmissionAdminNotice(
  input: ContactSubmissionAdminNoticeInput,
  deps: SendContactSubmissionAdminNoticeDeps = {},
): Promise<void> {
  const mailer = deps.mailer ?? { send: sendEmail };
  const recipients = getAdminNotifyRecipients();

  if (recipients.length === 0) {
    console.warn('[contact-submission-admin-notice] No admin recipients configured — no notice sent.');
    return;
  }

  const react = React.createElement(ContactSubmissionAdminNotice, {
    submissionId: input.submissionId,
    name: input.name,
    email: input.email,
    subject: input.subject,
    message: input.message,
    submittedAt: input.submittedAt,
  });

  await Promise.all(
    recipients.map((to) =>
      mailer.send({
        to,
        subject: 'New contact message — SAOC',
        react,
        from: FORMS_FROM_ADDRESS,
      }),
    ),
  );
}
