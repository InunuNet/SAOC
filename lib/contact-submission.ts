import React from 'react';

import ContactConfirmation from '@/emails/ContactConfirmation';
import NosContactConfirmation from '@/emails/NosContactConfirmation';
import { sendEmail, FORMS_FROM_ADDRESS, NOS_FORMS_FROM_ADDRESS } from '@/lib/email';
import { SHOW_TITLE } from '@/lib/show-title';
import type { Site } from '@/lib/site-hosts';

/**
 * Contact message document and acknowledgement (missions admin-form-notices, nos-contact). Pure:
 * no Firebase. `site` comes from the request host, never from the body (the sponsor-enquiry
 * pattern). The SAOC acknowledgement is unchanged; the NOS one is sent as the show.
 */

export interface ContactSubmissionInput {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface ContactSubmissionDoc {
  name: string;
  email: string;
  subject: string;
  message: string;
  submittedAt: Date;
  status: 'new';
  site: Site;
  emailDelivery: { visitor: null; admin: null };
}

/** Trimmed fields, lowercased email, and no `undefined` own property. */
export function buildContactSubmissionDoc(
  input: ContactSubmissionInput,
  site: Site,
  submittedAt: Date,
): ContactSubmissionDoc {
  return {
    name: String(input.name).trim(),
    email: String(input.email).trim().toLowerCase(),
    subject: String(input.subject).trim(),
    message: String(input.message).trim(),
    submittedAt,
    status: 'new',
    site,
    emailDelivery: { visitor: null, admin: null },
  };
}

export interface ContactAcknowledgementInput {
  name: string;
  email: string;
  subject: string;
  site: Site;
}

/** Deliberately narrow: matches what lib/email.ts's real `sendEmail` already satisfies. */
export interface ContactAcknowledgementMailer {
  send(args: {
    to: string;
    subject: string;
    react: React.ReactElement;
    from?: string;
    site?: Site;
  }): Promise<void>;
}

export interface SendContactAcknowledgementDeps {
  mailer?: ContactAcknowledgementMailer;
}

export async function sendContactAcknowledgement(
  input: ContactAcknowledgementInput,
  deps: SendContactAcknowledgementDeps = {},
): Promise<void> {
  const mailer = deps.mailer ?? { send: sendEmail };
  const props = { name: input.name, subject: input.subject };

  if (input.site === 'nos') {
    await mailer.send({
      to: input.email,
      subject: `We received your message — ${SHOW_TITLE}`,
      react: React.createElement(NosContactConfirmation, props),
      from: NOS_FORMS_FROM_ADDRESS,
      site: 'nos',
    });
    return;
  }

  await mailer.send({
    to: input.email,
    subject: 'We received your message — SAOC',
    react: React.createElement(ContactConfirmation, props),
    from: FORMS_FROM_ADDRESS,
  });
}
