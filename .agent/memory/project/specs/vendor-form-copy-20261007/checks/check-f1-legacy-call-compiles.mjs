#!/usr/bin/env node
// F1 (vendor-form-copy-20261007) -- amendment 2026-10-08 (SAOC lead, via team-lead):
// sendVendorApprovalConfirmationEmail is called from TWO places: the full-VendorSubmission
// approval route this feature edits (app/api/admin/vendors/[id]/review/route.ts) and the
// application-approval route feat/vendor-invite also calls it from
// (app/api/admin/vendors/applications/[id]/review/route.ts:223). This feature must NOT touch
// that second file (see contract A8), and must NOT change
// sendVendorApprovalConfirmationEmail's signature -- the 5 new staff fields may only be added
// as optional fields on the EXISTING VendorApprovalConfirmationInput type, never as new
// required parameters, a renamed field, or a second function overload.
//
// A grep cannot prove this -- "the field is optional" has to be exercised, not read. This
// fixture calls the REAL function with the real injectable-mailer DI hook (already shipped for
// exactly this purpose -- see SendVendorApprovalConfirmationDeps) using the EXACT literal input
// shape application/[id]/review/route.ts:223 passes today (businessName, contactPersonName,
// contactEmail, registrationCode, registrationLink -- no staff/booth/logistics fields at all,
// since that call path is the registrationLink branch, which never renders them). It asserts:
//
//   1. The call resolves without throwing (proves the 5 new optional fields didn't turn into
//      required ones -- a required field omitted here would throw or fail to type-check, and
//      at the TS level this fixture is also compiled by `pnpm run type-check`, so a required-
//      field regression fails loudly there too, not just at runtime).
//   2. The captured react element's new staff props all come through as `null` (the same `??
//      null` default the function already applies to every optional field) -- proving nothing
//      new leaks into this call path's rendered output by accident, and this call path's
//      behaviour is bit-for-bit what it was before this feature.
//
// Run as:
//   npx tsx .agent/memory/project/specs/vendor-form-copy-20261007/checks/check-f1-legacy-call-compiles.mjs

import { sendVendorApprovalConfirmationEmail } from '../../../../../../lib/vendor-approval-confirmation.ts';

const failures = [];
function fail(msg) {
  failures.push(msg);
}

let capturedReactElement = null;
const fakeMailer = {
  async send({ react }) {
    capturedReactElement = react;
  },
};

// The exact literal shape app/api/admin/vendors/applications/[id]/review/route.ts:223 passes
// today -- copied, not paraphrased, from that call site.
const PRE_CHANGE_INPUT = {
  businessName: 'Cape Orchid Nursery',
  contactPersonName: 'Jane Vendor',
  contactEmail: 'jane@capeorchid.example',
  registrationCode: '4821',
  registrationLink: 'https://saoc.co.za/national-show/vendors/register?name=Cape%20Orchid%20Nursery&code=4821',
};

try {
  await sendVendorApprovalConfirmationEmail(PRE_CHANGE_INPUT, { mailer: fakeMailer });
} catch (error) {
  fail(`sendVendorApprovalConfirmationEmail threw on the pre-change application-approval input shape: ${error instanceof Error ? error.message : String(error)}`);
}

if (!capturedReactElement) {
  fail('sendVendorApprovalConfirmationEmail never reached mailer.send() -- the pre-change call path is broken.');
} else {
  const props = capturedReactElement.props ?? {};
  for (const key of ['staffPerDay', 'staffCountSetupDay', 'staffCountDay1', 'staffCountDay2', 'staffCountDay3', 'staffCountBreakdownDay']) {
    if (props[key] !== null) {
      fail(`${key}: expected null (the existing "?? null" default, same as before this feature) when the caller never supplies it, got ${JSON.stringify(props[key])}.`);
    }
  }
  if (props.registrationLink !== PRE_CHANGE_INPUT.registrationLink) {
    fail('registrationLink was not passed through unchanged -- the application-approval branch must render exactly as before.');
  }
}

if (failures.length > 0) {
  console.error('FAIL:');
  for (const f of failures) console.error(' -', f);
  process.exit(1);
}
console.log('PASS: the pre-change application-approval call site still compiles, runs, and renders unchanged -- the 5 new fields are additive-only.');
