#!/usr/bin/env node
// F13 follow-up (vendor-gated-registration-flow, M2) -- A42: STANDING regression guard for the
// general invariant behind both A40 (vendorCategoryOther) and A41 (waterRequired): every field
// buildVendorSubmission (lib/vendor-submissions.ts) copies from `input` into the persisted
// vendorSubmissions document must be named somewhere in validateVendorSubmissionInput's body.
// A field that is written but never referenced by the validator is a field a direct POST can
// set to any shape at all -- exactly the defect class that produced both A40 and A41, found
// twice on this mission by set-difference-diffing the 89 written fields against the validator's
// source, once by @dev by hand and once independently by this check's own author. This makes
// that diff a standing, cheap, automated gate instead of something a dev happens to remember to
// re-run by hand.
//
// Method: parse buildVendorSubmission's return object for every `fieldName: input.fieldName,`
// line (the field is WRITTEN from raw input), parse validateVendorSubmissionInput's body for
// every quoted 'fieldName' string literal and every `record.fieldName` property access (the
// field is REFERENCED by the validator, in a require/optional/pattern check), and fail if any
// written field is not referenced. This is source-level, not behavioural -- deliberately so:
// it exists to catch a new field being ADDED to buildVendorSubmission without any matching
// validation ever being written, which a behavioural check cannot anticipate for a field that
// does not exist yet. A40 and A41 remain the behavioural proofs for the two fields this check
// already found; this is the tripwire for the next one.
//
// KNOWN, INTENTIONAL EXCLUSIONS (not written from `input.*`, so never appear in the parsed
// written-fields set in the first place -- listed here so the exclusion is visible, not
// silent): `status` and `submittedAt` are always system-forced (never read from `input`, see
// buildVendorSubmission's own doc comment) and must NEVER be settable by a submitter at all --
// them being unreferenced by the validator is correct, not a gap.
//
// FAILS ON: any field appearing in buildVendorSubmission's `fieldName: input.fieldName,`
// return-object lines that does not also appear as a quoted string literal or `record.<field>`
// access anywhere in validateVendorSubmissionInput's body.
//
// Run as: node contracts/checks/vendor-gated-registration-flow-m2/check-every-persisted-field-is-validated.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SOURCE_PATH = path.join(ROOT, 'lib/vendor-submissions.ts');
const src = readFileSync(SOURCE_PATH, 'utf8');

const failures = [];

const buildMatch = src.match(
  /export function buildVendorSubmission\([\s\S]*?\): Omit<VendorSubmission, 'id'> \{\n([\s\S]*?)\n\}\n/,
);
if (!buildMatch) {
  failures.push(
    'SETUP FAILURE: could not locate buildVendorSubmission\'s return object in ' +
      `${SOURCE_PATH} -- the function's shape changed enough that this check's parser no longer ` +
      'matches it. Update the parser, do not delete the check.',
  );
}

const validateMatch = src.match(
  /export function validateVendorSubmissionInput\(input: unknown\): \{\n {2}valid: boolean;\n {2}errors: string\[\];\n\} \{\n([\s\S]*?)\n {2}return \{ valid: errors\.length === 0, errors \};\n\}/,
);
if (!validateMatch) {
  failures.push(
    "SETUP FAILURE: could not locate validateVendorSubmissionInput's body in " +
      `${SOURCE_PATH} -- the function's shape changed enough that this check's parser no longer ` +
      'matches it. Update the parser, do not delete the check.',
  );
}

if (failures.length === 0) {
  const buildBody = buildMatch[1];
  const written = new Set(
    Array.from(buildBody.matchAll(/^\s*(\w+): input\.\w+,/gm)).map((m) => m[1]),
  );
  if (written.size === 0) {
    failures.push(
      'SETUP FAILURE: parsed zero written fields out of buildVendorSubmission -- the parser ' +
        'regex no longer matches the field-copy line shape. This check would otherwise pass ' +
        'vacuously, proving nothing.',
    );
  }

  const validateBody = validateMatch[1];
  const referenced = new Set([
    ...Array.from(validateBody.matchAll(/'(\w+)'/g)).map((m) => m[1]),
    ...Array.from(validateBody.matchAll(/record\.(\w+)/g)).map((m) => m[1]),
  ]);

  const unvalidated = Array.from(written)
    .filter((f) => !referenced.has(f))
    .sort();

  if (unvalidated.length > 0) {
    failures.push(
      `${unvalidated.length} field(s) are written by buildVendorSubmission from raw input but ` +
        `never referenced by validateVendorSubmissionInput: ${unvalidated.join(', ')}. Each is a ` +
        'field a direct POST can set to any shape at all -- add a matching validate*() call, ' +
        "or if the field is deliberately deprecated-in-place and no longer copied from input, " +
        'confirm buildVendorSubmission truly does not read it from input any more.',
    );
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: every field buildVendorSubmission copies from raw input is referenced somewhere in ' +
    "validateVendorSubmissionInput's body.",
);
process.exit(0);
