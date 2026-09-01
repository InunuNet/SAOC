import React from 'react';

import { sendEmail, FORMS_FROM_ADDRESS } from '@/lib/email';
import VendorStandPaymentReady from '@/emails/VendorStandPaymentReady';

/**
 * M3 (vendor-gated-registration-flow, F28) -- sender for the stand-payment-link email. Mints
 * nothing itself -- the caller (the review route's post-commit hook, or the resend route)
 * already minted the token and built the URL; this module only formats and sends. Same
 * injectable-fake mailer pattern as lib/vendor-approval-confirmation.ts.
 *
 * Contains no logging call of any kind anywhere in its body -- businessName/contactEmail/
 * contactPersonName are POPIA-relevant submitter PII and must never reach a log line, same
 * rule every other vendor-email sender in this project follows.
 */

export interface VendorStandPaymentNoticeInput {
  businessName: string;
  contactPersonName: string;
  contactEmail: string;
  paymentUrl: string;
}

/** Deliberately narrow -- matches only what lib/email.ts's real `sendEmail` already satisfies
 *  structurally, same pattern as VendorApprovalConfirmationMailer. */
export interface VendorStandPaymentNoticeMailer {
  send(args: { to: string; subject: string; react: React.ReactElement }): Promise<void>;
}

export interface SendVendorStandPaymentNoticeDeps {
  mailer?: VendorStandPaymentNoticeMailer;
}

export async function sendVendorStandPaymentNoticeEmail(
  input: VendorStandPaymentNoticeInput,
  deps: SendVendorStandPaymentNoticeDeps = {},
): Promise<void> {
  const mailer = deps.mailer ?? { send: sendEmail };

  await mailer.send({
    to: input.contactEmail,
    subject: 'Pay for your SAOC National Show stand',
    react: React.createElement(VendorStandPaymentReady, {
      businessName: input.businessName,
      contactPersonName: input.contactPersonName,
      paymentUrl: input.paymentUrl,
    }),
    from: FORMS_FROM_ADDRESS,
  });
}
