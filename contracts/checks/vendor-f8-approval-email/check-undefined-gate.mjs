#!/usr/bin/env node
// F8 (vendor-registration) — A4: THE "undefined" GATE. Proves, via real
// sendVendorApprovalConfirmationEmail() calls (captured through a fixture mailer and rendered
// with @react-email/components' render() — same technique as A3, for the same tsx/esm
// double-wrapping reason, see that file's header), that a missing boothNumber and/or missing
// optional logistics fields NEVER produce the literal substring "undefined" in the rendered
// HTML, and that the documented fallback labels appear instead.
//
// Three independent cases, not one:
//  (1) COMBINED-FAILURE — boothNumber, boothType, staffPerDay, waterRequired, loadInSlot, and
//      loadOutSlot are ALL missing in the same call. Proves neither a missing boothNumber nor
//      missing logistics masks detection of the other.
//  (2) boothNumber alone missing, every other field populated.
//  (3) boothNumber present but empty/whitespace-only ('   ') — must be treated as missing, not
//      as a literal empty booth number.
//
// DEFEATING MUTATION: `Booth: ${boothNumber}` or `Staff: ${staffPerDay} per day` used as a bare
// template literal anywhere in the component instead of routing through
// formatBoothNumber/formatOptionalField first — any such mutation makes the rendered HTML
// contain the literal substring "undefined" for case (1) or (2).
//
// MUST be run with `npx tsx`, NOT `node --import tsx/esm` (see check-full-logistics-render.mjs's
// header for the known env-quirk reason).
//
// Run as: npx tsx contracts/checks/vendor-f8-approval-email/check-undefined-gate.mjs

import { render } from '@react-email/components';
import { sendVendorApprovalConfirmationEmail } from '../../../lib/vendor-approval-confirmation.ts';
import {
  BOOTH_NUMBER_PENDING_LABEL,
  LOGISTICS_NOT_SPECIFIED_LABEL,
} from '../../../emails/VendorApprovalConfirmation.tsx';

const failures = [];

const BASE = {
  businessName: 'Cape Orchid Traders',
  contactPersonName: 'Jane Vendor',
  contactEmail: 'jane@example.com',
  powerRequired: true,
};

async function renderFor(input) {
  let captured;
  const fixtureMailer = {
    send: async (args) => {
      captured = args.react;
    },
  };
  await sendVendorApprovalConfirmationEmail(input, { mailer: fixtureMailer });
  return render(captured);
}

function assertNoUndefined(label, html) {
  if (/undefined/.test(html)) {
    failures.push(`[${label}] rendered HTML contains the literal substring "undefined".`);
  }
}

// (1) Combined-failure case — everything optional is missing at once.
{
  const html = await renderFor({
    ...BASE,
    boothNumber: undefined,
    boothType: undefined,
    staffPerDay: undefined,
    waterRequired: undefined,
    loadInSlot: undefined,
    loadOutSlot: undefined,
  });
  assertNoUndefined('combined-failure', html);
  if (!html.includes(BOOTH_NUMBER_PENDING_LABEL)) {
    failures.push(`[combined-failure] expected "${BOOTH_NUMBER_PENDING_LABEL}" for the missing booth number.`);
  }
  const notSpecifiedCount = html.split(LOGISTICS_NOT_SPECIFIED_LABEL).length - 1;
  if (notSpecifiedCount < 5) {
    failures.push(
      `[combined-failure] expected at least 5 occurrences of "${LOGISTICS_NOT_SPECIFIED_LABEL}" ` +
        `(boothType, staffPerDay, waterRequired, loadInSlot, loadOutSlot all missing), found ${notSpecifiedCount}.`,
    );
  }
}

// (2) boothNumber alone missing, every other field populated.
{
  const html = await renderFor({
    ...BASE,
    boothNumber: undefined,
    boothType: 'standard',
    staffPerDay: 2,
    waterRequired: false,
    loadInSlot: 'Thursday',
    loadOutSlot: 'Sunday',
  });
  assertNoUndefined('boothNumber-alone-missing', html);
  if (!html.includes(BOOTH_NUMBER_PENDING_LABEL)) {
    failures.push(`[boothNumber-alone-missing] expected "${BOOTH_NUMBER_PENDING_LABEL}".`);
  }
  if (html.includes(LOGISTICS_NOT_SPECIFIED_LABEL)) {
    failures.push('[boothNumber-alone-missing] every other field was populated but "Not specified" appeared anyway.');
  }
}

// (3) boothNumber present but whitespace-only — treated as missing, not as a literal value.
{
  const html = await renderFor({
    ...BASE,
    boothNumber: '   ',
    boothType: 'standard',
    staffPerDay: 2,
    waterRequired: false,
    loadInSlot: 'Thursday',
    loadOutSlot: 'Sunday',
  });
  assertNoUndefined('whitespace-boothNumber', html);
  if (!html.includes(BOOTH_NUMBER_PENDING_LABEL)) {
    failures.push(
      `[whitespace-boothNumber] a whitespace-only boothNumber must fall back to "${BOOTH_NUMBER_PENDING_LABEL}", ` +
        'not render as a blank/literal empty value.',
    );
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: a missing boothNumber (alone, combined with every other missing logistics field, or ' +
    'present-but-whitespace-only) never renders the literal substring "undefined", and the ' +
    'documented fallback labels appear in its place.',
);
process.exit(0);
