#!/usr/bin/env node
// vendor-invite F1 — A5: behavioural proof of the real
// validateVendorApplicationInviteInput() (lib/vendor-applications.ts). Proves it rejects a
// missing/empty businessName/contactPersonName/contactEmail, rejects an over-maxlength
// businessName/contactPersonName, rejects a malformed contactEmail, ACCEPTS a minimal valid
// 3-field payload, and — the discriminator proving this is genuinely the smaller invite
// validator rather than validateVendorApplicationInput reused under a new name — accepts that
// same minimal payload even though it carries no vendorCategory and no indicativeBoothCount
// at all.
//
// Run as: npx tsx contracts/checks/vendor-invite/check-invite-validator-behavior.mjs

const { validateVendorApplicationInviteInput } = await import('../../../lib/vendor-applications.ts');

const failures = [];

const VALID_MINIMAL = {
  businessName: 'Highveld Orchid Nursery',
  contactPersonName: 'Thandi Nkosi',
  contactEmail: 'thandi@highveldorchids.example',
};

// (1) The discriminating case: a minimal, valid 3-field payload with NO vendorCategory and NO
// indicativeBoothCount at all must be ACCEPTED. If this validator were secretly
// validateVendorApplicationInput under a new name, this would fail.
{
  const result = validateVendorApplicationInviteInput(VALID_MINIMAL);
  if (!result.valid) {
    failures.push(`(1) expected a minimal 3-field payload (no vendorCategory/indicativeBoothCount) to be valid, got errors: ${JSON.stringify(result.errors)}`);
  }
}

// (2) Missing/empty required fields are each rejected.
for (const field of ['businessName', 'contactPersonName', 'contactEmail']) {
  const input = { ...VALID_MINIMAL, [field]: '' };
  const result = validateVendorApplicationInviteInput(input);
  if (result.valid) {
    failures.push(`(2) expected an empty '${field}' to be rejected, but validation passed`);
  }
  const inputMissing = { ...VALID_MINIMAL };
  delete inputMissing[field];
  const resultMissing = validateVendorApplicationInviteInput(inputMissing);
  if (resultMissing.valid) {
    failures.push(`(2) expected a missing '${field}' key to be rejected, but validation passed`);
  }
}

// (3) Over-maxlength businessName (>200) and contactPersonName (>150) are rejected.
{
  const result = validateVendorApplicationInviteInput({
    ...VALID_MINIMAL,
    businessName: 'x'.repeat(201),
  });
  if (result.valid) failures.push('(3) expected a 201-character businessName to be rejected');
}
{
  const result = validateVendorApplicationInviteInput({
    ...VALID_MINIMAL,
    contactPersonName: 'x'.repeat(151),
  });
  if (result.valid) failures.push('(3) expected a 151-character contactPersonName to be rejected');
}

// (4) A malformed contactEmail is rejected.
{
  const result = validateVendorApplicationInviteInput({
    ...VALID_MINIMAL,
    contactEmail: 'not-an-email',
  });
  if (result.valid) failures.push('(4) expected a malformed contactEmail to be rejected');
}

// (5) Non-object input is rejected without throwing.
{
  let threw = false;
  let result;
  try {
    result = validateVendorApplicationInviteInput(null);
  } catch {
    threw = true;
  }
  if (threw) failures.push('(5) validateVendorApplicationInviteInput(null) threw instead of returning { valid: false }');
  else if (result.valid) failures.push('(5) expected null input to be rejected');
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: validateVendorApplicationInviteInput() accepts a minimal 3-field payload with no ' +
    'vendorCategory/indicativeBoothCount, and rejects missing/empty/over-length/malformed ' +
    'fields and non-object input.',
);
process.exit(0);
