import React from 'react';

import { sendEmail } from '@/lib/email';
import VendorRegistrationConfirmation from '@/emails/VendorRegistrationConfirmation';

/**
 * Confirmation email for POST /api/vendors/register (mission vendor-registration F5). See
 * contracts/golden/vendor-f5-register-route/README.md for the full decision record.
 *
 * `deps.mailer` defaults to the REAL lib/email.ts `sendEmail` export -- same injectable-fake
 * pattern as lib/confirmation-email.ts's `ConfirmationEmailMailer`, so a fixture test needs
 * zero Resend adapter code.
 *
 * Contains no logging call of any kind anywhere in its body: businessName/contactEmail are
 * POPIA-relevant submitter PII and must never reach a log line -- see the golden README's
 * "design constraint 5" and its static source check.
 */

export interface VendorRegistrationConfirmationInput {
  businessName: string;
  contactPersonName: string;
  contactEmail: string;
}

/** Deliberately narrow -- matches only what lib/email.ts's real `sendEmail` already satisfies
 *  structurally, same pattern as ConfirmationEmailMailer. */
export interface VendorRegistrationConfirmationMailer {
  send(args: { to: string; subject: string; react: React.ReactElement }): Promise<void>;
}

export interface SendVendorRegistrationConfirmationDeps {
  mailer?: VendorRegistrationConfirmationMailer;
}

export async function sendVendorRegistrationConfirmationEmail(
  input: VendorRegistrationConfirmationInput,
  deps: SendVendorRegistrationConfirmationDeps = {},
): Promise<void> {
  const mailer = deps.mailer ?? { send: sendEmail };

  await mailer.send({
    to: input.contactEmail,
    subject: 'We received your vendor registration — SAOC',
    react: React.createElement(VendorRegistrationConfirmation, {
      businessName: input.businessName,
      contactPersonName: input.contactPersonName,
    }),
  });
}
