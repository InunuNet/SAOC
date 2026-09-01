#!/usr/bin/env node
// F15 (vendor-gated-registration-flow, M2) -- A29: the bio word-count validator rejects a
// 149-word and a 201-word input and accepts a 175-word input -- a real boundary proof, driving
// the real, exported validateVendorSubmissionInput() (lib/vendor-submissions.ts) end to end,
// not a grep for the numbers 150/200 appearing anywhere in the file (which would pass even if
// the check compared the wrong variable, or compared nothing at all). Mirrors
// check-water-required-validated.mjs's baseInput() pattern.
//
// FIELD/INTERFACE DECISION (flagged, not guessed silently): `bio` is the pre-existing field
// name (types/index.ts, already rendered by VendorMarketingFieldset.tsx with the STALE
// 50-100 word range in its label -- F15 corrects the range to 150-200, per the 26 Aug source
// doc's "Please write a short Vendor Description -- 150 to 200 words"). This check assumes
// `bio` stays OPTIONAL (its current `bio?: string` shape is unchanged by F15 -- only the
// boundary-validation behaviour changes) and that the 150/200-word bound applies only when a
// non-empty bio is actually supplied -- an omitted bio must still be accepted, since the
// source document does not asterisk this field as required and F15's own scope is "correct the
// bio word-count validator", not "make bio required". If that reading is wrong, this check's
// case (4) below will fail loudly (an omitted bio wrongly rejected) rather than silently
// passing on the wrong assumption.
//
// FAILS ON: either boundary case (149, 201 words) passing when it should fail, the valid case
// (175 words) failing, or an omitted bio being wrongly rejected once the new bound is added.
//
// Run as: npx tsx contracts/checks/vendor-gated-registration-flow-m2/check-bio-word-count-boundaries.mjs

import { validateVendorSubmissionInput } from '../../../lib/vendor-submissions.ts';

const failures = [];

// A minimal, otherwise-fully-valid raw input -- every field validateVendorSubmissionInput
// actually requires today, per lib/vendor-submissions.ts. Mirrors check-water-required-
// validated.mjs's baseInput() pattern exactly.
function baseInput(bioOverride) {
  const input = {
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
    powerRequired: false,
    termsAccepted: true,
  };
  if (bioOverride !== undefined) {
    input.bio = bioOverride;
  }
  return input;
}

// A word is a single whitespace-delimited token -- deliberately single-character ('w'), so the
// exact word count of each generated string is unambiguous AND the total character length
// (at most 201 * 2 - 1 = 401 chars) stays well under FIELD_MAX_LENGTHS.bio's separate
// character cap, which this check is not exercising and must not accidentally trip.
function wordsOf(count) {
  return Array.from({ length: count }, () => 'w').join(' ');
}

// (1) 149 words -- one word under the 150-word floor -- must be rejected, and the rejection
// must name 'bio' (proves the error is actually about bio, not an unrelated field).
{
  const result = validateVendorSubmissionInput(baseInput(wordsOf(149)));
  if (result.valid !== false) {
    failures.push('(1) a 149-word bio (one word under the 150-word floor) was accepted -- expected rejection.');
  } else if (!result.errors.some((e) => e.includes('bio'))) {
    failures.push(`(1) a 149-word bio was correctly rejected, but no reported error names 'bio' -- errors: ${JSON.stringify(result.errors)}.`);
  }
}

// (2) 201 words -- one word over the 200-word ceiling -- must be rejected, and the rejection
// must name 'bio'.
{
  const result = validateVendorSubmissionInput(baseInput(wordsOf(201)));
  if (result.valid !== false) {
    failures.push('(2) a 201-word bio (one word over the 200-word ceiling) was accepted -- expected rejection.');
  } else if (!result.errors.some((e) => e.includes('bio'))) {
    failures.push(`(2) a 201-word bio was correctly rejected, but no reported error names 'bio' -- errors: ${JSON.stringify(result.errors)}.`);
  }
}

// (3) 175 words -- comfortably inside [150, 200] -- must be accepted.
{
  const result = validateVendorSubmissionInput(baseInput(wordsOf(175)));
  if (result.valid !== true) {
    failures.push(`(3) a 175-word bio (inside the 150-200 word range) was wrongly rejected -- errors: ${JSON.stringify(result.errors)}.`);
  }
}

// (4) An omitted bio must still be accepted -- the word-count bound only applies once a bio is
// actually supplied; this must be additive tightening, not a regression forcing the field.
{
  const result = validateVendorSubmissionInput(baseInput(undefined));
  if (result.valid !== true) {
    failures.push(`(4) an omitted bio was wrongly rejected -- errors: ${JSON.stringify(result.errors)}. bio must stay optional.`);
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: validateVendorSubmissionInput() rejects a 149-word and a 201-word bio (both naming ' +
    "'bio' in the error), accepts a 175-word bio, and still accepts an omitted bio.",
);
process.exit(0);
