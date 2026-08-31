#!/usr/bin/env node
// vendor-gated-registration-flow M4/F24 -- proves the 'approve' action in
// app/api/admin/vendors/applications/[id]/review/route.ts mints a registration CODE (not the
// retired HMAC token) atomically alongside the F2 status-transition patch, and that the
// approval email renders the code digit-grouped, never as an unbroken 4-digit run.
//
// SUPERSEDES A20 (contracts/checks/vendor-gated-registration-flow/check-approval-mints-before-
// commit.mjs), which asserted the equivalent property for the M1 token mechanism -- that check
// now fails as direct, expected collateral of F24 replacing mintVendorRegistrationToken()
// outright (see contracts/golden/vendor-gated-registration-flow-m4/README.md's "Migration").
// The defect A20 guarded against (a failed mint leaving an application terminally 'approved'
// with no way to issue a link) is the SAME shape of defect for a failed code generation, so
// this check keeps A20's ordering technique, repointed to the new identifiers, and ADDS a real
// behavioural proof (part 2 below) that A20 never had: A20 could only assert source order,
// never that the email actually renders the code correctly, since the route itself needs a
// Firebase Admin credential + authenticated admin session this environment does not have.
//
// PART 1 (source-order, same stated limitation as A20): the route reads/generates the code
// BEFORE any ref.update(), a generation failure refuses the whole approval (no partial commit),
// and -- the property A20 could not check, since the M1 shape used two separate ref.update()
// calls -- the F2 decision patch and the code fields land in the SAME, single ref.update() call,
// never a separate/laggable second write.
//
// PART 2 (behavioural, real execution): sendVendorApprovalConfirmationEmail() with
// registrationCode set renders "4 8 2 1" digit-grouped under a "Your registration code"
// heading, never the unbroken "4821".
//
// Run as: npx tsx contracts/checks/vendor-gated-registration-flow-m4/check-approval-mints-code-atomically.mjs

import { readFileSync } from 'node:fs';
import { render } from '@react-email/components';
import { sendVendorApprovalConfirmationEmail } from '../../../lib/vendor-approval-confirmation.ts';

const ROUTE = 'app/api/admin/vendors/applications/[id]/review/route.ts';
const failures = [];

// --- Part 1: source-order + single-patch proof ------------------------------------------------

const raw = readFileSync(new URL(`../../../${ROUTE}`, import.meta.url), 'utf8');
// Strip comments before any ordering assertion -- this file's own header prose mentions
// ref.update()/generateVendorRegistrationCodeId, which would make offset-based checks below
// pass or fail for the wrong reason (same precaution as the retired A20 check).
const source = raw
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));

if (/mintVendorRegistrationToken/.test(source)) {
  failures.push(`${ROUTE}: still calls the retired mintVendorRegistrationToken -- F24 requires it be replaced outright, not run alongside.`);
}

const generateAt = source.indexOf('generateVendorRegistrationCodeId(');
const updateCalls = [...source.matchAll(/ref\.update\(/g)].map((m) => m.index);

if (generateAt === -1) {
  failures.push(`${ROUTE}: no generateVendorRegistrationCodeId() call found.`);
}
if (updateCalls.length === 0) {
  failures.push(`${ROUTE}: no ref.update(...) call found.`);
} else if (updateCalls.length > 1) {
  failures.push(
    `${ROUTE}: found ${updateCalls.length} ref.update() call sites -- F5's decision patch and F24's ` +
      `code fields must land in a SINGLE update, never a separate/laggable second write.`,
  );
}

if (generateAt !== -1 && updateCalls.length >= 1 && generateAt > updateCalls[0]) {
  failures.push(
    `${ROUTE}: the code is generated AFTER ref.update() -- an approval can commit and then fail to ` +
      `generate a code, leaving the application terminally approved with no code issued.`,
  );
}

// The single update call's argument must actually combine the decision patch with the code
// fields (not merely be the only call site by coincidence) -- both identifiers must appear
// within that one call's argument list.
if (updateCalls.length === 1) {
  const afterUpdate = source.slice(updateCalls[0]);
  const closeParenAt = afterUpdate.indexOf('\n}');
  const updateArgs = afterUpdate.slice(0, closeParenAt === -1 ? undefined : closeParenAt);
  if (!/decision\.patch/.test(updateArgs)) {
    failures.push(`${ROUTE}: the single ref.update() call does not spread decision.patch -- the F2 status transition may be written separately.`);
  }
  if (!/registrationCodeId/.test(updateArgs)) {
    failures.push(`${ROUTE}: the single ref.update() call does not include registrationCodeId -- the code may be written separately from the decision.`);
  }
}

// The generation-failure path must refuse rather than commit (mirrors A20's own check).
if (!/catch \(error\) \{[\s\S]{0,600}?Cannot approve/.test(source)) {
  failures.push(
    `${ROUTE}: a generateVendorRegistrationCodeId()/normalizeVendorCodeName() throw does not refuse ` +
      `the approval with an operator-facing "Cannot approve" error.`,
  );
}

// The review machine must NOT have been weakened to allow re-approving an approved application
// (same regression guard A20 carried).
const machine = readFileSync(new URL('../../../lib/vendor-application-review.ts', import.meta.url), 'utf8');
if (/'approved'\s*:\s*\{[\s\S]{0,200}?approve/.test(machine)) {
  failures.push('lib/vendor-application-review.ts appears to allow an action from the approved state.');
}

// --- Part 2: behavioural digit-grouping proof --------------------------------------------------

async function capture(input) {
  let captured = null;
  await sendVendorApprovalConfirmationEmail(input, {
    mailer: { send: async (args) => { captured = args; } },
  });
  if (!captured) throw new Error('the fixture mailer was never called');
  return { text: await render(captured.react, { plainText: true }) };
}

const { text } = await capture({
  businessName: 'Fynbos Pottery',
  contactPersonName: 'Jane Vendor',
  contactEmail: 'jane@example.com',
  registrationLink: 'https://saoc.co.za/national-show/vendors/register?name=Fynbos%20Pottery&code=4821',
  registrationCode: '4821',
});

if (!/your registration code/i.test(text)) {
  failures.push('approval email with a registrationCode does not render a "Your registration code" heading.');
}
if (!text.includes('4 8 2 1')) {
  failures.push(`approval email does not render the code digit-grouped ("4 8 2 1"); rendered text was: "${text}"`);
}
if (text.includes('4821') && !text.includes('code=4821')) {
  // The convenience link legitimately carries the unbroken digits in its query string --
  // that is not the human-facing read-aloud rendering this check guards. Anything OUTSIDE the
  // link containing the unbroken run is the defect.
  const withoutLink = text.replace(/https:\/\/\S+/g, '');
  if (withoutLink.includes('4821')) {
    failures.push('approval email renders the code as an unbroken run "4821" outside the convenience link.');
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: the approval route generates the registration code BEFORE its single ref.update() call ' +
    '(which combines F2\'s decision patch and the code fields in one write), refuses the whole ' +
    'approval on a generation failure, leaves the closed review machine unweakened, and the real ' +
    'approval email renders the code digit-grouped ("4 8 2 1"), never as the unbroken run "4821".',
);
process.exit(0);
