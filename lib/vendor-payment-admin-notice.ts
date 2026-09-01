import React from 'react';

import { sendEmail, FORMS_FROM_ADDRESS } from '@/lib/email';
import { getVendorAdminNotifyRecipients } from '@/lib/vendor-admin-notify-recipients';
import VendorPaymentAdminNotice from '@/emails/VendorPaymentAdminNotice';

/**
 * G1 (vendor-flow-notifications) -- admin notice fired when a vendor's stand payment settles as
 * 'paid'. Identical shape to lib/vendor-application-admin-notice.ts. Recipients resolve
 * EXCLUSIVELY via `getVendorAdminNotifyRecipients()` -- never from the vendor's own submitted
 * contactEmail/businessName/contactPersonName.
 *
 * The ONLY `console.*` call permitted in this file is a single, non-PII `console.warn` fired
 * when the resolved recipient list is empty.
 */

export interface VendorPaymentAdminNoticeInput {
  businessName: string;
  contactPersonName: string;
  standOrderRef: string;
  reviewUrl: string;
}

/** Deliberately narrow -- matches only what lib/email.ts's real `sendEmail` already satisfies
 *  structurally, same pattern as every other vendor-email sender's mailer interface. */
export interface VendorPaymentAdminNoticeMailer {
  send(args: { to: string; subject: string; react: React.ReactElement }): Promise<void>;
}

export interface SendVendorPaymentAdminNoticeDeps {
  mailer?: VendorPaymentAdminNoticeMailer;
}

export async function sendVendorPaymentAdminNoticeEmail(
  input: VendorPaymentAdminNoticeInput,
  deps: SendVendorPaymentAdminNoticeDeps = {},
): Promise<void> {
  const mailer = deps.mailer ?? { send: sendEmail };
  const recipients = getVendorAdminNotifyRecipients();

  if (recipients.length === 0) {
    console.warn(
      '[vendor-payment-admin-notice] ADMIN_EMAIL_ALLOWLIST resolved zero recipients — no admin notice sent.',
    );
    return;
  }

  const react = React.createElement(VendorPaymentAdminNotice, {
    businessName: input.businessName,
    contactPersonName: input.contactPersonName,
    standOrderRef: input.standOrderRef,
    reviewUrl: input.reviewUrl,
  });

  await Promise.all(
    recipients.map((to) =>
      mailer.send({
        to,
        subject: 'Vendor stand payment received — SAOC',
        react,
        from: FORMS_FROM_ADDRESS,
      }),
    ),
  );
}
