#!/usr/bin/env node
// F4 (vendor-registration) — zero-authorization proof, mirroring ticketing-f5-buyers's A6
// (shape carries no authorization meaning) and its "no import" proof for lib/buyers.ts. See
// golden README "Zero-authorization property, mirrored from ticketing-f5-buyers" for why F4
// cannot yet run the ticketing-f5-buyers-style A3/A4 pair (real token -> real hasCapability()
// call) -- F6's capability gate doesn't exist yet.
//
// Run as: node --import tsx/esm contracts/checks/vendor-f4-submissions-model/check-zero-authorization.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { buildVendorSubmission } from '../../../lib/vendor-submissions.ts';

const failures = [];
const NOW = new Date('2027-02-14T09:30:00Z');

const MINIMAL = {
  businessName: 'Cape Orchid Nursery',
  contactPersonName: 'Jane Vendor',
  contactCellPhone: '0821234567',
  contactEmail: 'jane@capeorchid.example',
  vendorCategory: ['plant-sales'],
  productDescription: 'Cattleya and Cymbidium hybrids.',
  boothCount: 1,
  powerRequired: true,
  termsAccepted: true,
};

const CAPABILITY_KEY_PATTERN = /^(admin|roles|capabilit)/i;

// (a) A built VendorSubmission, serialised through JSON (the same shape a Firestore document
// read would produce), must carry no admin/roles/capability-named key -- checked at every
// status value including 'approved', since 'approved' is the status a future admin-approval
// mutation is most likely to accidentally overload with authorization meaning.
for (const status of ['submitted', 'under-review', 'approved', 'rejected']) {
  const built = buildVendorSubmission(MINIMAL, NOW);
  built.status = status; // simulate every lifecycle state a document could be read back in
  const roundTripped = JSON.parse(JSON.stringify(built));
  const suspiciousKeys = Object.keys(roundTripped).filter((k) => CAPABILITY_KEY_PATTERN.test(k));
  if (suspiciousKeys.length > 0) {
    failures.push(
      `(a) status:"${status}": VendorSubmission carries authorization-flavoured key(s) ${JSON.stringify(suspiciousKeys)} -- ` +
        'a vendorSubmissions document must never itself carry admin/roles/capability meaning.',
    );
  }
}

// (b) Static import-graph check: lib/vendor-submissions.ts must not import lib/admin-auth.ts
// or lib/admin-roles.ts, by any import path spelling (alias or relative).
{
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const sourcePath = join(__dirname, '../../../lib/vendor-submissions.ts');
  const source = readFileSync(sourcePath, 'utf8');

  const forbiddenImportPattern = /from\s+['"](@\/lib\/admin-auth|@\/lib\/admin-roles|\.\.?\/.*admin-auth|\.\.?\/.*admin-roles)['"]/;
  if (forbiddenImportPattern.test(source)) {
    failures.push(
      '(b) lib/vendor-submissions.ts imports lib/admin-auth.ts or lib/admin-roles.ts -- this module must not ' +
        'have the means to consult or grant a capability; see golden README.',
    );
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: a built VendorSubmission carries no admin/roles/capability-named key at any status value, ' +
    'and lib/vendor-submissions.ts imports neither lib/admin-auth.ts nor lib/admin-roles.ts.',
);
process.exit(0);
