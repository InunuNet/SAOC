import React from 'react';

import { sendEmail, FORMS_FROM_ADDRESS } from '@/lib/email';
import { getAdminNotifyRecipients } from '@/lib/admin-notify-recipients';
import EventSubmissionAdminNotice from '@/emails/EventSubmissionAdminNotice';

/**
 * Admin notice fired once when a society event submission is written as a Sanity draft
 * (mission admin-form-notices). Same shape as lib/sponsor-enquiry-admin-notice.ts. Recipients
 * resolve EXCLUSIVELY via the allowlist helper, never from the submitter.
 *
 * The only logging permitted in this file is one non-PII warning, fired when the resolved
 * recipient list is empty.
 */

export interface EventSubmissionAdminNoticeInput {
  eventDraftId: string;
  title: string;
  kind: string;
  date: string;
  endDate: string | null;
  venue: string;
  location: string;
  description: string;
  hostSocietyId: string | null;
  submittedByUid: string;
  submittedAt: Date;
}

/** Deliberately narrow: matches what lib/email.ts's real `sendEmail` already satisfies. */
export interface EventSubmissionAdminNoticeMailer {
  send(args: { to: string; subject: string; react: React.ReactElement; from?: string }): Promise<void>;
}

export interface SendEventSubmissionAdminNoticeDeps {
  mailer?: EventSubmissionAdminNoticeMailer;
}

export async function sendEventSubmissionAdminNotice(
  input: EventSubmissionAdminNoticeInput,
  deps: SendEventSubmissionAdminNoticeDeps = {},
): Promise<void> {
  const mailer = deps.mailer ?? { send: sendEmail };
  const recipients = getAdminNotifyRecipients();

  if (recipients.length === 0) {
    console.warn('[event-submission-admin-notice] No admin recipients configured — no notice sent.');
    return;
  }

  const react = React.createElement(EventSubmissionAdminNotice, {
    eventDraftId: input.eventDraftId,
    title: input.title,
    kind: input.kind,
    date: input.date,
    endDate: input.endDate,
    venue: input.venue,
    location: input.location,
    description: input.description,
    hostSocietyId: input.hostSocietyId,
    submittedByUid: input.submittedByUid,
    submittedAt: input.submittedAt,
  });

  await Promise.all(
    recipients.map((to) =>
      mailer.send({
        to,
        subject: 'New event submission — SAOC',
        react,
        from: FORMS_FROM_ADDRESS,
      }),
    ),
  );
}
