import React from 'react';

import { sendEmail, FORMS_FROM_ADDRESS } from '@/lib/email';
import VendorApprovalConfirmation, {
  BOOTH_NUMBER_PENDING_LABEL,
  LOGISTICS_NOT_SPECIFIED_LABEL,
} from '@/emails/VendorApprovalConfirmation';
import type { VendorBoothType } from '@/types/index';

/**
 * Confirmation email for the F6 admin review route's 'approve' action (mission
 * vendor-registration F8). See contracts/golden/vendor-f8-approval-email/README.md for the
 * full decision record.
 *
 * `deps.mailer` defaults to the REAL lib/email.ts `sendEmail` export -- same injectable-fake
 * pattern as lib/vendor-registration-confirmation.ts's VendorRegistrationConfirmationMailer.
 *
 * Contains no logging call of any kind anywhere in its body: businessName/contactEmail/
 * contactPersonName are POPIA-relevant submitter PII and must never reach a log line -- same
 * rule F5's lib/vendor-registration-confirmation.ts already follows.
 *
 * No defaulting/formatting happens in this file -- that is emails/VendorApprovalConfirmation
 * .tsx's job, so the same formatting logic is exercised whether the caller is this function or
 * a direct render() call in a test.
 */

export { BOOTH_NUMBER_PENDING_LABEL, LOGISTICS_NOT_SPECIFIED_LABEL };

export interface VendorApprovalConfirmationInput {
  businessName: string;
  contactPersonName: string;
  contactEmail: string;
  boothNumber?: string | null;
  boothType?: VendorBoothType | null;
  staffPerDay?: number | null;
  /** Nullable since vendor-gated-registration-flow M1 -- see the same prop on
   *  emails/VendorApprovalConfirmation.tsx for why. */
  powerRequired?: boolean | null;
  waterRequired?: boolean | null;
  loadInSlot?: string | null;
  loadOutSlot?: string | null;
  /** F6 (vendor-gated-registration-flow) -- optional single-use link to the full registration
   *  form, rendered when present. The EXISTING call site
   *  (app/api/admin/vendors/[id]/review/route.ts, full-VendorSubmission approval) never
   *  passes this -- it stays undefined there, unchanged behavior. The NEW call site
   *  (app/api/admin/vendors/applications/[id]/review/route.ts's 'approve' action) sets it. */
  registrationLink?: string | null;
}

/** Deliberately narrow -- matches only what lib/email.ts's real `sendEmail` already satisfies
 *  structurally, same pattern as VendorRegistrationConfirmationMailer. */
export interface VendorApprovalConfirmationMailer {
  send(args: { to: string; subject: string; react: React.ReactElement }): Promise<void>;
}

export interface SendVendorApprovalConfirmationDeps {
  mailer?: VendorApprovalConfirmationMailer;
}

export async function sendVendorApprovalConfirmationEmail(
  input: VendorApprovalConfirmationInput,
  deps: SendVendorApprovalConfirmationDeps = {},
): Promise<void> {
  const mailer = deps.mailer ?? { send: sendEmail };

  await mailer.send({
    to: input.contactEmail,
    subject: input.registrationLink
      ? 'Your SAOC vendor application has been approved'
      : 'Your SAOC vendor registration has been approved',
    react: React.createElement(VendorApprovalConfirmation, {
      businessName: input.businessName,
      contactPersonName: input.contactPersonName,
      boothNumber: input.boothNumber ?? null,
      boothType: input.boothType ?? null,
      staffPerDay: input.staffPerDay ?? null,
      powerRequired: input.powerRequired ?? null,
      waterRequired: input.waterRequired ?? null,
      loadInSlot: input.loadInSlot ?? null,
      loadOutSlot: input.loadOutSlot ?? null,
      registrationLink: input.registrationLink ?? null,
    }),
    from: FORMS_FROM_ADDRESS,
  });
}
