#!/usr/bin/env node
// vendor-invite F1 — A4: behavioural proof of the real buildVendorApplicationInvite()
// (lib/vendor-applications.ts). Proves: tradingName/vendorCategory/indicativeBoothCount are
// genuinely ABSENT own-properties (not undefined-valued) on the returned object when the
// caller's input never carried them; status/origin/reviewedBy/reviewedAt/submittedAt are
// exactly the forced values even when the input object attempts to smuggle its own
// status/origin/id/reviewedBy — proving the builder copies field-by-field and never spreads
// `{ ...input }`.
//
// Run as: npx tsx contracts/checks/vendor-invite/check-invite-builder-strips-undefined.mjs

const { buildVendorApplicationInvite } = await import('../../../lib/vendor-applications.ts');

const failures = [];

const now = new Date('2026-10-08T09:00:00.000Z');
const reviewerEmail = 'admin@saoc.co.za';

// (1) Absence, not undefined-valued presence, for every field an invite never supplies.
{
  const input = {
    businessName: 'Highveld Orchid Nursery',
    contactPersonName: 'Thandi Nkosi',
    contactEmail: 'thandi@highveldorchids.example',
  };
  const built = buildVendorApplicationInvite(input, reviewerEmail, now);

  for (const field of ['tradingName', 'vendorCategory', 'indicativeBoothCount']) {
    if (Object.prototype.hasOwnProperty.call(built, field)) {
      failures.push(`(1) expected '${field}' to be a genuinely absent own-property, but it is present (value: ${JSON.stringify(built[field])})`);
    }
  }

  if (built.status !== 'approved') failures.push(`(1) expected status 'approved', got ${JSON.stringify(built.status)}`);
  if (built.origin !== 'invited') failures.push(`(1) expected origin 'invited', got ${JSON.stringify(built.origin)}`);
  if (built.reviewedBy !== reviewerEmail) failures.push(`(1) expected reviewedBy ${JSON.stringify(reviewerEmail)}, got ${JSON.stringify(built.reviewedBy)}`);
  if (built.submittedAt?.getTime?.() !== now.getTime()) failures.push(`(1) expected submittedAt to equal the injected 'now', got ${JSON.stringify(built.submittedAt)}`);
  if (built.reviewedAt?.getTime?.() !== now.getTime()) failures.push(`(1) expected reviewedAt to equal the injected 'now', got ${JSON.stringify(built.reviewedAt)}`);
  if (built.businessName !== input.businessName) failures.push('(1) businessName was not copied through correctly');
  if (built.contactPersonName !== input.contactPersonName) failures.push('(1) contactPersonName was not copied through correctly');
  if (built.contactEmail !== input.contactEmail) failures.push('(1) contactEmail was not copied through correctly');
}

// (2) THE SPREAD-DEFEATING PROOF — a type-system-bypassing input that attempts to smuggle its
// own status/origin/id/reviewedBy must have every one of those attempts ignored. A builder
// that spreads `{ ...input }` anywhere would let one or more of these through.
{
  const maliciousInput = {
    businessName: 'Sneaky Co',
    contactPersonName: 'Someone',
    contactEmail: 'sneaky@example.com',
    status: 'declined',
    origin: 'public',
    id: 'attacker-chosen-id',
    reviewedBy: 'not-the-real-admin@example.com',
    reviewedAt: new Date('2000-01-01T00:00:00.000Z'),
    submittedAt: new Date('2000-01-01T00:00:00.000Z'),
  };
  const built = buildVendorApplicationInvite(maliciousInput, reviewerEmail, now);

  if (built.status !== 'approved') failures.push(`(2) smuggled status leaked through: got ${JSON.stringify(built.status)}`);
  if (built.origin !== 'invited') failures.push(`(2) smuggled origin leaked through: got ${JSON.stringify(built.origin)}`);
  if (Object.prototype.hasOwnProperty.call(built, 'id')) failures.push('(2) smuggled id leaked through onto the built object');
  if (built.reviewedBy !== reviewerEmail) failures.push(`(2) smuggled reviewedBy leaked through: got ${JSON.stringify(built.reviewedBy)}`);
  if (built.reviewedAt?.getTime?.() !== now.getTime()) failures.push('(2) smuggled reviewedAt leaked through');
  if (built.submittedAt?.getTime?.() !== now.getTime()) failures.push('(2) smuggled submittedAt leaked through');
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: buildVendorApplicationInvite() leaves tradingName/vendorCategory/indicativeBoothCount ' +
    'genuinely absent, forces status/origin/reviewedBy/reviewedAt/submittedAt regardless of a ' +
    'type-system-bypassing input, and copies the three real fields through correctly.',
);
process.exit(0);
