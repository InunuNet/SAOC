#!/usr/bin/env node
// F1 (vendor-registration-form-rebuild) — zero-authorization proof, mirroring F4/F6/F7's own:
// (a) lib/vendor-submissions.ts imports neither '@/lib/admin-auth' nor '@/lib/admin-roles' (or
// any relative-path spelling of either); (b) a VendorSubmission built with every new F1 field
// populated, JSON round-tripped, carries no admin/roles/capability-flavoured key.
//
// Run as:
//   node --import tsx/esm .agent/memory/project/specs/vendor-registration-form-rebuild/checks/check-zero-authorization.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { buildVendorSubmission } from '../../../../../../lib/vendor-submissions.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const failures = [];
function fail(msg) {
  failures.push(msg);
}

const SUBMISSIONS_FILE = path.join(__dirname, '../../../../../../lib/vendor-submissions.ts');
const source = readFileSync(SUBMISSIONS_FILE, 'utf8');

const FORBIDDEN_IMPORT_PATTERNS = [
  /from\s+['"]@\/lib\/admin-auth['"]/,
  /from\s+['"]@\/lib\/admin-roles['"]/,
  /from\s+['"]\.\.?\/.*admin-auth['"]/,
  /from\s+['"]\.\.?\/.*admin-roles['"]/,
];

for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
  if (pattern.test(source)) {
    fail(`lib/vendor-submissions.ts matches forbidden import pattern: ${pattern}`);
  }
}

const FORBIDDEN_KEY_FRAGMENTS = ['admin', 'role', 'capability', 'grant'];

function collectKeys(obj, out = new Set()) {
  if (obj && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      out.add(key);
      collectKeys(value, out);
    }
  }
  return out;
}

async function main() {
  const submission = buildVendorSubmission(
    {
      businessName: 'Cape Orchid Nursery',
      contactPersonName: 'Jane Vendor',
      contactCellPhone: '0821234567',
      contactEmail: 'jane@capeorchid.example',
      vendorCategory: ['plant-sales'],
      productDescription: 'Cattleya and Cymbidium hybrids.',
      boothCount: 1,
      powerRequired: true,
      termsAccepted: true,
      businessEntityType: 'sole-proprietor',
      emergencyContactName: 'Sipho Dlamini',
      emergencyContactCellPhone: '0834445555',
      gasOrHeatEquipmentUsed: true,
      hasPublicLiabilityInsurance: true,
      productLiabilityInsuranceStatus: 'not-applicable',
    },
    new Date(),
  );

  const roundTripped = JSON.parse(JSON.stringify(submission));
  const keys = collectKeys(roundTripped);

  for (const key of keys) {
    const lower = key.toLowerCase();
    for (const fragment of FORBIDDEN_KEY_FRAGMENTS) {
      if (lower.includes(fragment)) {
        fail(`Built submission carries an authorization-flavoured key "${key}" (matches "${fragment}").`);
      }
    }
  }

  if (failures.length > 0) {
    failures.forEach((f) => console.error(`FAIL: ${f}`));
    console.error(`\n${failures.length} assertion(s) failed.`);
    process.exit(1);
  }

  console.log(
    'PASS: lib/vendor-submissions.ts imports neither admin-auth nor admin-roles, and a built ' +
      'VendorSubmission using every new F1 field carries no admin/role/capability/grant-flavoured key.',
  );
  process.exit(0);
}

main().catch((err) => {
  console.error('FAIL: unexpected error:', err);
  process.exit(1);
});
