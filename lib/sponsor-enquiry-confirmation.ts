import React from 'react';

import { sendEmail, FORMS_FROM_ADDRESS, NOS_FORMS_FROM_ADDRESS } from '@/lib/email';
import type { Site } from '@/lib/site-hosts';
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
  /** The site the enquiry was submitted on; anything but 'nos' means the SAOC identity. */
  site?: Site | null;
}

const SITE_LABELS = { saoc: 'SAOC', nos: 'National Orchid Show' } as const;
const SUBJECT_STEM = 'We received your sponsorship enquiry';

/** Deliberately narrow: matches what lib/email.ts's real `sendEmail` already satisfies. */
export interface SponsorEnquiryConfirmationMailer {
  send(args: { to: string; subject: string; react: React.ReactElement; from?: string; site?: Site }): Promise<void>;
}

export interface SendSponsorEnquiryConfirmationDeps {
  mailer?: SponsorEnquiryConfirmationMailer;
}

export async function sendSponsorEnquiryConfirmationEmail(
  input: SponsorEnquiryConfirmationInput,
  deps: SendSponsorEnquiryConfirmationDeps = {},
): Promise<void> {
  const mailer = deps.mailer ?? { send: sendEmail };

  const site: Site = input.site === 'nos' ? 'nos' : 'saoc';
  const subject = `${SUBJECT_STEM} — ${SITE_LABELS[site]}`;

  await mailer.send({
    to: input.email,
    subject,
    react: React.createElement(SponsorEnquiryConfirmation, {
      name: input.contactName,
      preview: subject,
    }),
    from: site === 'nos' ? NOS_FORMS_FROM_ADDRESS : FORMS_FROM_ADDRESS,
    site,
  });
}
