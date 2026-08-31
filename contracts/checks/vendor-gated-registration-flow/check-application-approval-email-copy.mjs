#!/usr/bin/env node
// vendor-gated-registration-flow M1 fix pass -- behavioural proof that the approval email
// asserts nothing the vendor has not actually told us.
//
// The application-approval path (registrationLink present) previously rendered the
// full-registration heading/preview ("Vendor Registration Approved"), the whole "Your submitted
// logistics" recap, and -- because powerRequired was a non-nullable boolean -- the literal
// claim "Power required: No" to a vendor who was never asked the question.
//
// Headings arrive UPPERCASED in @react-email's plain-text render, so heading assertions below
// are deliberately case-insensitive; body copy is compared verbatim.
//
// Renders BOTH branches through the REAL sendVendorApprovalConfirmationEmail() with an injected
// fixture mailer, using the same technique (and the same `npx tsx` requirement) as
// contracts/checks/vendor-f8-approval-email/check-full-logistics-render.mjs -- see that file's
// header for why this repo's checks route through the real send function rather than calling
// the .tsx component directly.
//
// Run as: npx tsx contracts/checks/vendor-gated-registration-flow/check-application-approval-email-copy.mjs

import { render } from '@react-email/components';
import { sendVendorApprovalConfirmationEmail } from '../../../lib/vendor-approval-confirmation.ts';

const failures = [];

async function capture(input) {
  let captured = null;
  await sendVendorApprovalConfirmationEmail(input, {
    mailer: { send: async (args) => { captured = args; } },
  });
  if (!captured) throw new Error('the fixture mailer was never called');
  return { subject: captured.subject, text: await render(captured.react, { plainText: true }) };
}

const BASE = {
  businessName: 'Cape Orchid Traders',
  contactPersonName: 'Jane Vendor',
  contactEmail: 'jane@example.com',
};

// -------------------------------------------------------------------------------------------
// (1) Application approval: says APPLICATION, carries the link, asserts NO logistics at all.
// -------------------------------------------------------------------------------------------
const REGISTRATION_LINK = 'https://saoc.co.za/national-show/vendors/register?token=fixture-token';
const application = await capture({ ...BASE, registrationLink: REGISTRATION_LINK });

if (!/vendor application has been approved/i.test(application.subject)) {
  failures.push(`application subject still claims a registration was approved: "${application.subject}"`);
}
if (!/vendor application approved/i.test(application.text)) {
  failures.push('application email is not headed "Vendor Application Approved".');
}
if (/vendor registration approved/i.test(application.text)) {
  failures.push('application email still carries the "Vendor Registration Approved" heading.');
}
if (!application.text.includes(REGISTRATION_LINK)) {
  failures.push('application email does not contain the single-use registration link.');
}
// The load-bearing assertion: NONE of the seven logistics recap fields, and above all no
// fabricated Yes/No answer, may appear in an email sent before the vendor was ever asked.
for (const forbidden of [
  'Your submitted logistics',
  'Booth number',
  'Booth type',
  'Staff per day',
  'Power required',
  'Water required',
  'Load-in slot',
  'Load-out slot',
  'To be confirmed',
  'Not specified',
]) {
  if (application.text.includes(forbidden)) {
    failures.push(`application email asserts un-submitted logistics: found "${forbidden}".`);
  }
}

// -------------------------------------------------------------------------------------------
// (2) The existing full-registration call site (no registrationLink) is unchanged: same
//     subject, same heading, all seven fields, real answers -- not "Not specified".
// -------------------------------------------------------------------------------------------
const full = await capture({
  ...BASE,
  boothNumber: 'A12',
  boothType: 'standard-in-row',
  staffPerDay: 3,
  powerRequired: true,
  waterRequired: false,
  loadInSlot: '2027-09-15T06:00',
  loadOutSlot: '2027-09-19T18:00',
});

if (full.subject !== 'Your SAOC vendor registration has been approved') {
  failures.push(`full-registration subject changed: "${full.subject}"`);
}
for (const pattern of [/vendor registration approved/i, /your submitted logistics \(please verify\)/i]) {
  if (!pattern.test(full.text)) {
    failures.push(`full-registration email lost a heading matching ${pattern}.`);
  }
}
for (const expected of [
  'Booth number: A12',
  'Booth type: standard-in-row',
  'Staff per day: 3',
  'Power required: Yes',
  'Water required: No',
  'Load-in slot: 2027-09-15T06:00',
  'Load-out slot: 2027-09-19T18:00',
]) {
  if (!full.text.includes(expected)) {
    failures.push(`full-registration email lost "${expected}".`);
  }
}
if (full.text.includes(REGISTRATION_LINK)) {
  failures.push('full-registration email leaked a registration link it was never given.');
}

// -------------------------------------------------------------------------------------------
// (3) powerRequired is genuinely optional now: omitting it on the full-registration path
//     renders the "Not specified" fallback, NOT a fabricated "No".
// -------------------------------------------------------------------------------------------
const noPower = await capture({ ...BASE, boothNumber: 'A12' });
if (!noPower.text.includes('Power required: Not specified')) {
  failures.push('an omitted powerRequired does not render the "Not specified" fallback.');
}
// Anchored so it cannot be satisfied by the "No" inside "Not specified".
if (/Power required: No(?!t specified)/.test(noPower.text)) {
  failures.push('an omitted powerRequired still renders the fabricated answer "Power required: No".');
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: the application-approval email says an APPLICATION was approved, carries the ' +
    'single-use link, and asserts none of the seven logistics fields; the existing ' +
    'full-registration email is unchanged (same subject, heading and all seven real answers); ' +
    'and an omitted powerRequired renders "Not specified" rather than a fabricated "No".',
);
process.exit(0);
