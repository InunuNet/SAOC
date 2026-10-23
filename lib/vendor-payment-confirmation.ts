import React from 'react';

import { sendEmail, FORMS_FROM_ADDRESS } from '@/lib/email';
import VendorPaymentConfirmation from '@/emails/VendorPaymentConfirmation';
import { nosUrl } from '@/lib/site-hosts';
import { withTestSubjectPrefix } from '@/lib/ticketing-test-mode';

/**
 * F1 (vendor-payment-confirmation) -- the vendor-facing receipt fired when a vendor's stand
 * payment settles as 'paid'. Sends to the vendor's OWN contactEmail -- NEVER to any admin
 * address, and this module never imports lib/vendor-admin-notify-recipients.ts. Mirrors
 * lib/vendor-stand-payment-notice.ts's exact injectable-mailer shape.
 *
 * Contains no logging call of any kind anywhere in its body -- businessName/contactEmail are
 * POPIA-relevant submitter PII and must never reach a log line, same absolute rule every other
 * vendor-email sender in this project follows.
 */

export interface VendorPaymentConfirmationInput {
  businessName: string;
  contactEmail: string;
  boothSize: 1 | 2 | 3;
  amount: number;
  standOrderRef: string;
}

/** Deliberately narrow -- matches only what lib/email.ts's real `sendEmail` already satisfies
 *  structurally, same pattern as every other vendor-email sender's mailer interface. */
export interface VendorPaymentConfirmationMailer {
  send(args: { to: string; subject: string; react: React.ReactElement }): Promise<void>;
}

export interface SendVendorPaymentConfirmationDeps {
  mailer?: VendorPaymentConfirmationMailer;
  siteUrl?: string;
}

export async function sendVendorPaymentConfirmationEmail(
  input: VendorPaymentConfirmationInput,
  deps: SendVendorPaymentConfirmationDeps = {},
): Promise<void> {
  const mailer = deps.mailer ?? { send: sendEmail };
  const siteUrl = deps.siteUrl ?? nosUrl('');

  await mailer.send({
    to: input.contactEmail,
    subject: withTestSubjectPrefix('Your National Orchid Show stand payment is confirmed'),
    react: React.createElement(VendorPaymentConfirmation, {
      businessName: input.businessName,
      boothSize: input.boothSize,
      amount: input.amount,
      standOrderRef: input.standOrderRef,
      showDetailsUrl: `${siteUrl}/`,
    }),
    from: FORMS_FROM_ADDRESS,
  });
}
