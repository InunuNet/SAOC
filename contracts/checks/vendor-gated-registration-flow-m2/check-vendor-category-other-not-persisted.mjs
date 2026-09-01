#!/usr/bin/env node
// F13 (vendor-gated-registration-flow, M2) -- A40: closes the gap A26 left open. A26 only
// proves validateVendorSubmissionInput no longer NAMES vendorCategoryOther -- that is exactly
// the assertion whose green state, before this mission's fix pass, coexisted with
// buildVendorSubmission still WRITING an unvalidated, attacker-controlled vendorCategoryOther
// string straight into the persisted vendorSubmissions document. Codex GPT-5.5 found this over
// a 28/28 green gate; A26 could not have caught it because "the validator doesn't mention the
// field" and "the builder doesn't persist the field" are two different, independently
// defeatable properties. This is this project's own audited "assertion satisfiable by
// something that isn't the real property" defect class, for the fourth time on this mission
// (see A17/A18/A25's own rewrite notes) -- so this check is written to prove the persisted
// property directly, not to re-grep the fixed source.
//
// BEHAVIOURAL, not structural: drives the real, fully-injectable handleVendorRegistration()
// (lib/vendor-registration-handler.ts) end to end with an injected write() that captures the
// EXACT document handed to it, POSTing a raw input that is otherwise fully valid but also
// carries vendorCategoryOther: 'X'.repeat(50000) -- an unbounded string that would have failed
// A26's now-removed maxLength check in the OLD, wrongly-blocking validator, and would have
// been written unbounded and unvalidated by the OLD, since-fixed buildVendorSubmission. Same
// injection technique as check-single-use-claim-is-atomic.mjs and
// check-application-approval-email-copy.mjs -- no Firebase Admin SDK, no network, no
// Firestore emulator required.
//
// FAILS ON: the captured document handed to write() containing a 'vendorCategoryOther' key at
// all (regardless of value -- even an empty string would mean the field survived the deprecate-
// in-place cut), OR the submission being rejected/errored for a reason unrelated to
// vendorCategoryOther (which would mean this check's own fixture is not exercising the real
// success path and is proving nothing).
//
// Run as: node --import tsx/esm contracts/checks/vendor-gated-registration-flow-m2/check-vendor-category-other-not-persisted.mjs

import { handleVendorRegistration } from '../../../lib/vendor-registration-handler.ts';

const failures = [];
const NOW = new Date('2027-02-01T00:00:00Z');

// A minimal, otherwise-fully-valid raw POST body -- every field validateVendorSubmissionInput
// actually requires, per lib/vendor-submissions.ts, plus the attacker-supplied
// vendorCategoryOther this check exists to prove is never persisted.
const rawInput = {
  businessName: 'Test Orchid Traders',
  contactPersonName: 'Jane Test',
  contactCellPhone: '0821234567',
  contactEmail: 'jane.test@example.com',
  productDescription: 'Assorted cymbidium and cattleya orchids.',
  physicalAddress: '123 Orchid Lane, Cape Town',
  emergencyContactName: 'John Test',
  emergencyContactCellPhone: '0837654321',
  vendorCategory: ['orchids'],
  boothCount: 1,
  boothSize: 'single', // M2 fix pass, 2026-09-01: boothSize is now required (lib/vendor-submissions.ts)
  powerRequired: false,
  termsAccepted: true,
  // The field under test: an unbounded, unvalidated attacker-supplied string that a direct
  // POST bypassing the UI can attach to any request body.
  vendorCategoryOther: 'X'.repeat(50000),
};

let capturedDoc = null;

const result = await handleVendorRegistration(rawInput, {
  now: NOW,
  rateLimitKey: 'contract-check-vendor-category-other-not-persisted',
  getPriorAttempts: () => [],
  recordAttempt: () => {},
  async write(doc) {
    capturedDoc = doc;
    return { id: 'contract-check-mock-id' };
  },
  async sendConfirmationEmail() {},
  onEmailError: () => {},
});

if (result.status !== 201 || !('success' in result.body) || result.body.success !== true) {
  failures.push(
    `SETUP FAILURE: the fixture input was rejected instead of succeeding -- ` +
      `status=${result.status}, body=${JSON.stringify(result.body)}. This check proves nothing ` +
      `unless the real success/write path actually ran.`,
  );
} else if (capturedDoc === null) {
  failures.push('SETUP FAILURE: write() was never called despite a 201 success response.');
} else if (Object.prototype.hasOwnProperty.call(capturedDoc, 'vendorCategoryOther')) {
  failures.push(
    `FAIL: the document handed to write() still contains a 'vendorCategoryOther' key ` +
      `(value: ${JSON.stringify(capturedDoc.vendorCategoryOther).slice(0, 80)}...). ` +
      `buildVendorSubmission is persisting an unvalidated, attacker-controlled field again.`,
  );
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  "PASS: a direct POST carrying an unbounded vendorCategoryOther succeeds (proving the real " +
    'success path ran) and the document actually handed to write() carries no ' +
    "'vendorCategoryOther' key at all.",
);
process.exit(0);
