import React from 'react';

import { sendEmail, FORMS_FROM_ADDRESS } from '@/lib/email';
import SponsorEnquiryConfirmation from '@/emails/SponsorEnquiryConfirmation';

/**
 * Acknowledgement sent to the person who submitted a sponsorship enquiry (mission
 * sponsor-enquiry-form). Same injectable-mailer shape as lib/vendor-application-confirmation.ts.
 * The subject is fixed and carries no user text; `to` is the validated submitted address.
 *
 * Contains no logging call of any kind: the submitter's name and address are POPIA-relevant PII
 * and must never reach a log line.
 */

export interface SponsorEnquiryConfirmationInput {
  contactName: string;
  email: string;
}

/** Deliberately narrow: matches what lib/email.ts's real `sendEmail` already satisfies. */
export interface SponsorEnquiryConfirmationMailer {
  send(args: { to: string; subject: string; react: React.ReactElement; from?: string }): Promise<void>;
}

export interface SendSponsorEnquiryConfirmationDeps {
  mailer?: SponsorEnquiryConfirmationMailer;
}

export async function sendSponsorEnquiryConfirmationEmail(
  input: SponsorEnquiryConfirmationInput,
  deps: SendSponsorEnquiryConfirmationDeps = {},
): Promise<void> {
  const mailer = deps.mailer ?? { send: sendEmail };

  await mailer.send({
    to: input.email,
    subject: 'We received your sponsorship enquiry — SAOC',
    react: React.createElement(SponsorEnquiryConfirmation, { name: input.contactName }),
    from: FORMS_FROM_ADDRESS,
  });
}
