import React from 'react';

import { sendEmail, FORMS_FROM_ADDRESS } from '@/lib/email';
import { getAdminNotifyRecipients } from '@/lib/admin-notify-recipients';
import SponsorEnquiryAdminNotice from '@/emails/SponsorEnquiryAdminNotice';
import { sponsorLevelLabel, type SponsorEnquiryDoc } from '@/lib/sponsor-enquiry';

/**
 * Admin notice fired once when a sponsorship enquiry is stored (mission sponsor-enquiry-form).
 * Same shape as lib/vendor-application-admin-notice.ts. Recipients resolve EXCLUSIVELY via the
 * allowlist helper, never from the submitter's own details; the single import above is the one
 * place to change if the resolver moves again.
 *
 * The ONLY `console.*` call permitted in this file is one non-PII `console.warn`, fired when the
 * resolved recipient list is empty.
 */

const SITE_LABELS = { saoc: 'SAOC', nos: 'National Orchid Show' } as const;

export interface SponsorEnquiryAdminNoticeInput {
  enquiryId: string;
  doc: SponsorEnquiryDoc;
}

/** Deliberately narrow: matches what lib/email.ts's real `sendEmail` already satisfies. */
export interface SponsorEnquiryAdminNoticeMailer {
  send(args: { to: string; subject: string; react: React.ReactElement; from?: string }): Promise<void>;
}

export interface SendSponsorEnquiryAdminNoticeDeps {
  mailer?: SponsorEnquiryAdminNoticeMailer;
}

export async function sendSponsorEnquiryAdminNotice(
  input: SponsorEnquiryAdminNoticeInput,
  deps: SendSponsorEnquiryAdminNoticeDeps = {},
): Promise<void> {
  const mailer = deps.mailer ?? { send: sendEmail };
  const recipients = getAdminNotifyRecipients();

  if (recipients.length === 0) {
    console.warn('[sponsor-enquiry-admin-notice] No admin recipients configured — no notice sent.');
    return;
  }

  const { doc } = input;
  const react = React.createElement(SponsorEnquiryAdminNotice, {
    enquiryId: input.enquiryId,
    siteLabel: SITE_LABELS[doc.source],
    contactName: doc.contactName,
    organisation: doc.organisation,
    email: doc.email,
    phone: doc.phone,
    website: doc.website,
    levelLabel: sponsorLevelLabel(doc.level),
    message: doc.message,
  });

  await Promise.all(
    recipients.map((to) =>
      mailer.send({
        to,
        subject: 'New sponsorship enquiry — SAOC',
        react,
        from: FORMS_FROM_ADDRESS,
      }),
    ),
  );
}
