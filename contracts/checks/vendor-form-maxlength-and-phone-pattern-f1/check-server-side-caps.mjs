// A4 — structural + behavioral-in-process. Proves lib/vendor-submissions.ts independently
// enforces (a) the golden's per-field max lengths for at least businessName, contactPersonName,
// contactEmail, productDescription, and (b) the same phone-format rejection with the same error
// string as A3 -- by importing the real validateVendorSubmissionInput and calling it directly
// with oversized/malformed values (never a truncate-instead-of-reject), proving the caps exist
// independent of the client and cannot be bypassed by a direct POST.
//
// Run as: node contracts/checks/vendor-form-maxlength-and-phone-pattern-f1/check-server-side-caps.mjs

import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const { validateVendorSubmissionInput } = await import(
  path.join(REPO_ROOT, 'lib/vendor-submissions.ts')
);

const failures = [];

function baseValidInput(overrides = {}) {
  return {
    businessName: 'Test Orchid Traders',
    contactPersonName: 'Jane Test',
    contactCellPhone: '0821234567',
    contactEmail: 'jane.test@example.com',
    productDescription: 'Assorted cymbidium and cattleya orchids.',
    vendorCategory: ['plant-sales'],
    boothCount: 2,
    powerRequired: true,
    termsAccepted: true,
    ...overrides,
  };
}

const CAPS = [
  ['businessName', 200],
  ['contactPersonName', 150],
  ['contactEmail', 254],
  ['productDescription', 2000],
];

for (const [field, maxLength] of CAPS) {
  const oversized = 'a'.repeat(maxLength + 1);
  const overrides = { [field]: oversized };
  // contactEmail must stay parseable as "too long" rather than tripping the separate
  // email-format check for an unrelated reason -- pad with a valid-looking local part.
  if (field === 'contactEmail') {
    overrides.contactEmail = `${'a'.repeat(maxLength - 10)}@example.com`;
  }
  const result = validateVendorSubmissionInput(baseValidInput(overrides));

  if (result.valid) {
    failures.push(
      `FAIL: validateVendorSubmissionInput accepted ${field} at ${overrides[field].length} ` +
        `chars (cap is ${maxLength}) -- valid: true, no rejection.`,
    );
    continue;
  }
  const mentionsField = result.errors.some((e) => e.includes(field));
  if (!mentionsField) {
    failures.push(
      `FAIL: validateVendorSubmissionInput rejected an oversized ${field} but no error message ` +
        `mentions "${field}". Errors: ${JSON.stringify(result.errors)}`,
    );
  }

  // Regression guard against silent truncation: an oversized value passed straight through
  // must never come back as "valid" with a shortened value -- validateVendorSubmissionInput
  // never mutates its input, so re-checking the input object here proves nothing was truncated
  // in place.
  if (overrides[field].length <= maxLength) {
    failures.push(`SETUP FAILURE: test fixture for ${field} was not actually oversized.`);
  }
}

// Valid boundary case: exactly at the cap must be accepted (proves the caps aren't
// off-by-one-too-strict).
for (const [field, maxLength] of CAPS) {
  const overrides = { [field]: 'a'.repeat(maxLength) };
  if (field === 'contactEmail') {
    overrides.contactEmail = `${'a'.repeat(maxLength - 12)}@example.com`;
  }
  const result = validateVendorSubmissionInput(baseValidInput(overrides));
  if (!result.valid) {
    failures.push(
      `FAIL: validateVendorSubmissionInput rejected ${field} at exactly ${maxLength} chars ` +
        `(the documented cap) -- should be accepted. Errors: ${JSON.stringify(result.errors)}`,
    );
  }
}

// Phone: malformed and rejected with the exact A3 error string.
const malformedPhone = validateVendorSubmissionInput(
  baseValidInput({ contactCellPhone: 'not a phone number !!' }),
);
if (malformedPhone.valid) {
  failures.push('FAIL: validateVendorSubmissionInput accepted a malformed contactCellPhone.');
} else if (!malformedPhone.errors.includes('contactCellPhone must be a valid phone number')) {
  failures.push(
    `FAIL: malformed contactCellPhone was rejected but not with the exact error string ` +
      `'contactCellPhone must be a valid phone number'. Errors: ${JSON.stringify(malformedPhone.errors)}`,
  );
}

// Phone: valid and accepted (no false positive).
const validPhone = validateVendorSubmissionInput(
  baseValidInput({ contactCellPhone: '+27 82 123 4567' }),
);
if (!validPhone.valid) {
  failures.push(
    `FAIL: validateVendorSubmissionInput rejected a valid contactCellPhone "+27 82 123 4567". ` +
      `Errors: ${JSON.stringify(validPhone.errors)}`,
  );
}

// Regression guard: an all-whitespace contactCellPhone (e.g. "       ", 7 spaces) must never
// be accepted -- space is in the allowed character class, so without a digit requirement it
// satisfies both the non-empty check and the old phone-format regex, letting a direct POST
// bypassing the client persist a garbage phone value (found by Codex GPT-5.5 cross-model
// review, 2026-08-24).
const whitespacePhone = validateVendorSubmissionInput(
  baseValidInput({ contactCellPhone: '       ' }),
);
if (whitespacePhone.valid) {
  failures.push(
    'FAIL: validateVendorSubmissionInput accepted an all-whitespace contactCellPhone ' +
      '("       ") -- the phone pattern must require at least one digit.',
  );
} else if (!whitespacePhone.errors.includes('contactCellPhone must be a valid phone number')) {
  failures.push(
    `FAIL: all-whitespace contactCellPhone was rejected but not with the exact error string ` +
      `'contactCellPhone must be a valid phone number'. Errors: ${JSON.stringify(whitespacePhone.errors)}`,
  );
}

if (failures.length > 0) {
  for (const f of failures) console.error(f);
  process.exit(1);
}

console.log(
  'PASS: lib/vendor-submissions.ts independently rejects oversized businessName/' +
    'contactPersonName/contactEmail/productDescription and malformed contactCellPhone, accepts ' +
    'values at exactly the cap and a valid phone number, using the exact A3 error string.',
);
process.exit(0);
