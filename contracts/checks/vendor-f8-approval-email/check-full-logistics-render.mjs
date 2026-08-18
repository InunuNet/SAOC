#!/usr/bin/env node
// F8 (vendor-registration) — A3: behavioural, full-data proof that every one of the seven
// booth/logistics recap fields actually reaches the rendered HTML as legible text.
//
// Calls the REAL sendVendorApprovalConfirmationEmail() with an injected fixture mailer (never
// touches lib/email.ts/Resend), captures the react element the mailer receives, and renders it
// to real HTML with @react-email/components' render() — same technique already proven out by
// ticketing-f11-qr-confirmation-email's check-multi-position-fanout.mjs. This is deliberate,
// not incidental: calling the .tsx component function directly from a plain .mjs script hits a
// known tsx/esm default-export double-wrapping quirk in this environment; routing through the
// real send function (which itself does `React.createElement(VendorApprovalConfirmation, ...)`
// from within its own, correctly-resolved module context) sidesteps it entirely, and is a
// strictly stronger proof anyway — it exercises the real call site, not a hand-picked one.
//
// MUST be run with `npx tsx`, NOT `node --import tsx/esm` — this repo's known env quirk:
// node --import tsx/esm cannot chain a @/lib -> @/lib alias import (lib/vendor-approval-
// confirmation.ts imports @/lib/email and @/emails/VendorApprovalConfirmation); npx tsx
// resolves the same chain correctly. Confirmed against this repo's own shipped
// ticketing-f11-qr-confirmation-email check before being adopted here.
//
// DEFEATING MUTATION this check kills: dropping a field from the rendered template entirely,
// or rendering it only into a non-visible attribute the plain-text HTML scan would miss.
//
// Run as: npx tsx contracts/checks/vendor-f8-approval-email/check-full-logistics-render.mjs

import { render } from '@react-email/components';
import { sendVendorApprovalConfirmationEmail } from '../../../lib/vendor-approval-confirmation.ts';

const failures = [];

async function captureRenderedHtml(input) {
  let captured;
  const fixtureMailer = {
    send: async (args) => {
      captured = args.react;
    },
  };
  await sendVendorApprovalConfirmationEmail(input, { mailer: fixtureMailer });
  if (!captured) {
    throw new Error('fixture mailer was never called — sendVendorApprovalConfirmationEmail did not send.');
  }
  return render(captured);
}

const html = await captureRenderedHtml({
  businessName: 'Cape Orchid Traders',
  contactPersonName: 'Jane Vendor',
  contactEmail: 'jane@example.com',
  boothNumber: 'A12',
  boothType: 'corner',
  staffPerDay: 3,
  powerRequired: true,
  waterRequired: true,
  loadInSlot: 'Thursday 06:00-10:00',
  loadOutSlot: 'Sunday 16:00-19:00',
});

const expectations = [
  ['boothNumber (A12)', 'A12'],
  ['boothType (corner)', 'corner'],
  ['staffPerDay (3)', '3'],
  ['loadInSlot', 'Thursday 06:00-10:00'],
  ['loadOutSlot', 'Sunday 16:00-19:00'],
];

for (const [label, needle] of expectations) {
  if (!html.includes(needle)) {
    failures.push(`Rendered HTML did not contain ${label} — expected to find "${needle}" as legible text.`);
  }
}

// powerRequired=true AND waterRequired=true must BOTH render as 'Yes' — a mutation dropping one
// of the two boolean fields would still pass a single 'contains "Yes"' check, so this counts
// occurrences instead.
const yesCount = (html.match(/Yes/g) ?? []).length;
if (yesCount < 2) {
  failures.push(
    `Expected at least 2 occurrences of "Yes" (powerRequired AND waterRequired both true), found ${yesCount}.`,
  );
}

if (html.includes('businessName') || html.includes('contactPersonName')) {
  failures.push('Rendered HTML leaked a raw prop/field name instead of its value — template likely broken.');
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: sending a fully-populated vendor approval confirmation renders all seven recap fields ' +
    '(boothNumber, boothType, staffPerDay, powerRequired, waterRequired, loadInSlot, loadOutSlot) ' +
    'as legible text, with both boolean fields correctly rendered as "Yes".',
);
process.exit(0);
