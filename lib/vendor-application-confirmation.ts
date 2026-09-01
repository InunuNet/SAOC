import React from 'react';

import { sendEmail, FORMS_FROM_ADDRESS } from '@/lib/email';
import VendorApplicationConfirmation from '@/emails/VendorApplicationConfirmation';

/**
 * G1 (vendor-flow-notifications) -- the previously-missing vendor-facing "we received your
 * application" confirmation for POST /api/vendors/apply. Mirrors
 * lib/vendor-registration-confirmation.ts's exact injectable-mailer shape. See
 * contracts/golden/vendor-flow-notifications/README.md.
 *
 * `deps.mailer` defaults to the REAL lib/email.ts `sendEmail` export -- same injectable-fake
 * pattern as every other vendor-email sender, so a fixture test needs zero Resend adapter code.
 *
 * Contains no logging call of any kind anywhere in its body: businessName/contactPersonName/
 * contactEmail are POPIA-relevant submitter PII and must never reach a log line -- same rule
 * every other vendor-email sender in this project follows.
 */

export interface VendorApplicationConfirmationInput {
  businessName: string;
  contactPersonName: string;
  contactEmail: string;
}

/** Deliberately narrow -- matches only what lib/email.ts's real `sendEmail` already satisfies
 *  structurally, same pattern as VendorRegistrationConfirmationMailer. */
export interface VendorApplicationConfirmationMailer {
  send(args: { to: string; subject: string; react: React.ReactElement }): Promise<void>;
}

export interface SendVendorApplicationConfirmationDeps {
  mailer?: VendorApplicationConfirmationMailer;
}

export async function sendVendorApplicationConfirmationEmail(
  input: VendorApplicationConfirmationInput,
  deps: SendVendorApplicationConfirmationDeps = {},
): Promise<void> {
  const mailer = deps.mailer ?? { send: sendEmail };

  await mailer.send({
    to: input.contactEmail,
    subject: 'We received your vendor application — SAOC',
    react: React.createElement(VendorApplicationConfirmation, {
      businessName: input.businessName,
      contactPersonName: input.contactPersonName,
    }),
    from: FORMS_FROM_ADDRESS,
  });
}
