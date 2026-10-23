import React from 'react';

import { sendEmail, NOS_FORMS_FROM_ADDRESS } from '@/lib/email';
import VendorRegistrationConfirmation from '@/emails/VendorRegistrationConfirmation';
import { mintVendorPhotoUploadUrl } from '@/lib/vendor-photo-resume-link';
import { nosUrl } from '@/lib/site-hosts';

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
 *
 * Photo-resume link (mission vendor-flow-fixes, F2): when `vendorSubmissionId` is supplied and
 * VENDOR_STAND_PAYMENT_TOKEN_SECRET is set, a fresh photo-resume link is minted and passed to
 * the email as `photoUploadUrl`. With the secret unset the link is silently omitted -- the
 * acknowledgement email must still send.
 */

export interface VendorRegistrationConfirmationInput {
  businessName: string;
  contactPersonName: string;
  contactEmail: string;
  vendorSubmissionId?: string;
}

/** Deliberately narrow -- matches only what lib/email.ts's real `sendEmail` already satisfies
 *  structurally, same pattern as ConfirmationEmailMailer. */
export interface VendorRegistrationConfirmationMailer {
  send(args: { to: string; subject: string; react: React.ReactElement }): Promise<void>;
}

export interface SendVendorRegistrationConfirmationDeps {
  mailer?: VendorRegistrationConfirmationMailer;
}

function resolvePhotoUploadUrl(vendorSubmissionId: string | undefined): string | undefined {
  const secret = process.env.VENDOR_STAND_PAYMENT_TOKEN_SECRET;
  if (!vendorSubmissionId || !secret) return undefined;

  const siteUrl = nosUrl('');
  return mintVendorPhotoUploadUrl({ vendorSubmissionId, secret, now: new Date(), siteUrl }).url;
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
      photoUploadUrl: resolvePhotoUploadUrl(input.vendorSubmissionId),
    }),
    from: NOS_FORMS_FROM_ADDRESS,
    site: 'nos',
  });
}
