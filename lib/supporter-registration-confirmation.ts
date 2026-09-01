import React from 'react';

import { sendEmail, FORMS_FROM_ADDRESS } from '@/lib/email';
import SupporterRegistrationConfirmation from '@/emails/SupporterRegistrationConfirmation';

/**
 * Double-opt-in confirmation email for POST /api/supporters/register (mission
 * public-supporter-registration, F1). See
 * .agent/memory/project/specs/public-supporter-registration/goldens/README.md for the full
 * decision record.
 *
 * `deps.mailer` defaults to the REAL lib/email.ts `sendEmail` export -- same injectable-fake
 * pattern as lib/vendor-registration-confirmation.ts, so a fixture test needs zero Resend
 * adapter code.
 *
 * Contains no logging call of any kind anywhere in its body: `input.to`/`input.firstName` are
 * POPIA-relevant registrant PII and must never reach a log line.
 */

export interface SupporterRegistrationConfirmationInput {
  to: string;
  firstName: string | null;
  /** Absolute URL, e.g. https://saoc.co.za/api/supporters/confirm?token=... */
  confirmUrl: string;
}

/** Deliberately narrow -- matches only what lib/email.ts's real `sendEmail` already satisfies
 *  structurally. */
export interface SupporterRegistrationConfirmationMailer {
  send(args: {
    to: string;
    subject: string;
    react: React.ReactElement;
    from: string;
  }): Promise<void>;
}

export interface SendSupporterRegistrationConfirmationDeps {
  mailer?: SupporterRegistrationConfirmationMailer;
}

export async function sendSupporterRegistrationConfirmationEmail(
  input: SupporterRegistrationConfirmationInput,
  deps: SendSupporterRegistrationConfirmationDeps = {},
): Promise<void> {
  const mailer = deps.mailer ?? { send: sendEmail };

  await mailer.send({
    to: input.to,
    subject: 'Confirm your SAOC supporter registration',
    react: React.createElement(SupporterRegistrationConfirmation, {
      firstName: input.firstName,
      confirmUrl: input.confirmUrl,
    }),
    from: FORMS_FROM_ADDRESS,
  });
}
