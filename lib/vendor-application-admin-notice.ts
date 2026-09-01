import React from 'react';

import { sendEmail, FORMS_FROM_ADDRESS } from '@/lib/email';
import { getVendorAdminNotifyRecipients } from '@/lib/vendor-admin-notify-recipients';
import VendorApplicationAdminNotice from '@/emails/VendorApplicationAdminNotice';

/**
 * G1 (vendor-flow-notifications) -- admin notice fired when a new vendor application is
 * submitted. Recipients resolve EXCLUSIVELY via `getVendorAdminNotifyRecipients()` -- never
 * from the vendor's own submitted contactEmail/businessName/contactPersonName. See
 * contracts/golden/vendor-flow-notifications/README.md "Recipients -- read-only reuse, never
 * gating, never a second roster".
 *
 * `deps.mailer` defaults to the REAL lib/email.ts `sendEmail` export -- same injectable-fake
 * pattern as every other vendor-email sender. One `mailer.send` call per resolved recipient,
 * fired via `Promise.all`.
 *
 * The ONLY `console.*` call permitted in this file is a single, non-PII `console.warn` fired
 * when the resolved recipient list is empty -- businessName/contactPersonName/contactEmail
 * (were it ever passed) must never reach a log line.
 */

export interface VendorApplicationAdminNoticeInput {
  businessName: string;
  contactPersonName: string;
  applicationId: string;
  reviewUrl: string;
}

/** Deliberately narrow -- matches only what lib/email.ts's real `sendEmail` already satisfies
 *  structurally, same pattern as every other vendor-email sender's mailer interface. */
export interface VendorApplicationAdminNoticeMailer {
  send(args: { to: string; subject: string; react: React.ReactElement }): Promise<void>;
}

export interface SendVendorApplicationAdminNoticeDeps {
  mailer?: VendorApplicationAdminNoticeMailer;
}

export async function sendVendorApplicationAdminNoticeEmail(
  input: VendorApplicationAdminNoticeInput,
  deps: SendVendorApplicationAdminNoticeDeps = {},
): Promise<void> {
  const mailer = deps.mailer ?? { send: sendEmail };
  const recipients = getVendorAdminNotifyRecipients();

  if (recipients.length === 0) {
    console.warn(
      '[vendor-application-admin-notice] ADMIN_EMAIL_ALLOWLIST resolved zero recipients — no admin notice sent.',
    );
    return;
  }

  const react = React.createElement(VendorApplicationAdminNotice, {
    businessName: input.businessName,
    contactPersonName: input.contactPersonName,
    applicationId: input.applicationId,
    reviewUrl: input.reviewUrl,
  });

  await Promise.all(
    recipients.map((to) =>
      mailer.send({
        to,
        subject: 'New vendor application submitted — SAOC',
        react,
        from: FORMS_FROM_ADDRESS,
      }),
    ),
  );
}
