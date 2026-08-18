#!/usr/bin/env node
// F5 (vendor-registration) — design constraint 6: zero authorization meaning. Static source
// check that none of lib/vendor-registration-handler.ts, lib/vendor-registration-rate-limit.ts,
// lib/vendor-registration-confirmation.ts, or app/api/vendors/register/route.ts import
// lib/admin-auth.ts or lib/admin-roles.ts. Runtime check: a successful
// handleVendorRegistration() result's body object has exactly the keys `success` and `id` — no
// `status`, no `roles`, no echoed submission fields, no admin-flavoured key of any kind.
//
// Run as: npx tsx contracts/checks/vendor-f5-register-route/check-zero-authorization-meaning.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { handleVendorRegistration } from '../../../lib/vendor-registration-handler.ts';

const failures = [];
const __dirname = dirname(fileURLToPath(import.meta.url));

const FORBIDDEN_IMPORT_PATTERN =
  /from\s+['"](@\/lib\/admin-auth|@\/lib\/admin-roles|\.\.?\/.*admin-auth|\.\.?\/.*admin-roles)['"]/;

const SOURCE_FILES = [
  '../../../lib/vendor-registration-handler.ts',
  '../../../lib/vendor-registration-rate-limit.ts',
  '../../../lib/vendor-registration-confirmation.ts',
  '../../../app/api/vendors/register/route.ts',
];

// (a) Static import-graph check across all four new/changed files.
for (const relativePath of SOURCE_FILES) {
  const absolutePath = join(__dirname, relativePath);
  let source;
  try {
    source = readFileSync(absolutePath, 'utf8');
  } catch (error) {
    failures.push(`(a) could not read ${relativePath}: ${error instanceof Error ? error.message : String(error)}.`);
    continue;
  }
  if (FORBIDDEN_IMPORT_PATTERN.test(source)) {
    failures.push(
      `(a) ${relativePath} imports lib/admin-auth.ts or lib/admin-roles.ts -- this feature must ` +
        'have zero authorization meaning; see golden README "Zero-authorization posture carried through".',
    );
  }
}

// (b) Runtime check: a successful result's body has exactly the keys `success` and `id`.
{
  const NOW = new Date('2027-01-05T12:00:00Z');
  const VALID_PAYLOAD = {
    businessName: 'Test Nursery',
    contactPersonName: 'Jane Grower',
    contactCellPhone: '+27821234567',
    contactEmail: 'jane@example.com',
    productDescription: 'Cymbidium and Cattleya orchids',
    vendorCategory: ['plant-sales'],
    boothCount: 1,
    powerRequired: true,
    termsAccepted: true,
  };

  const result = await handleVendorRegistration(VALID_PAYLOAD, {
    now: NOW,
    rateLimitKey: 'vendor-register-ip:203.0.113.5',
    getPriorAttempts: () => [],
    recordAttempt: () => {},
    write: async () => ({ id: 'zero-auth-write-id' }),
    sendConfirmationEmail: async () => {},
    onEmailError: () => {},
  });

  if (result.status !== 201) {
    failures.push(`(b) expected status 201 for a valid submission, got ${result.status} -- cannot verify body shape.`);
  } else {
    const keys = Object.keys(result.body).sort();
    const expectedKeys = ['id', 'success'];
    if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) {
      failures.push(
        `(b) a successful result body must have exactly the keys [id, success], got ${JSON.stringify(keys)}.`,
      );
    }
    if (result.body.success !== true) {
      failures.push(`(b) expected body.success === true, got ${JSON.stringify(result.body.success)}.`);
    }
    if (result.body.id !== 'zero-auth-write-id') {
      failures.push(`(b) expected body.id === 'zero-auth-write-id', got ${JSON.stringify(result.body.id)}.`);
    }
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: none of the four F5 files import lib/admin-auth.ts or lib/admin-roles.ts, and a ' +
    'successful handleVendorRegistration() result body has exactly the keys [id, success] -- no ' +
    'status, roles, or echoed submission fields.',
);
process.exit(0);
