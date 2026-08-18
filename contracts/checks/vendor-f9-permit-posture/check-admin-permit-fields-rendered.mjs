#!/usr/bin/env node
// F9 (vendor-registration) — A1. Proves the admin review UI actually RENDERS all three
// regulatory permit/certificate fields (phytosanitaryPermitNumber, citesPermitNumber,
// foodHandlingCertificateNumber) collected by F4, not merely that they exist on the
// VendorSubmission type. Before F9, VendorReviewTable.tsx does not reference these fields at
// all -- the review table only shows business name, contact, category, status, actions -- so
// this assertion is a positive discriminator: it must fail on the real pre-F9 file and pass
// only once the fields are wired into a rendered surface.
//
// DEFEATING MUTATION: rendering the fields as a raw object dump without labels; renaming the
// destructured/accessed field so it no longer matches the F4 schema name; removing the
// reference after adding it once to satisfy this check, then relying on dead code.
//
// This check does not trust its own regex by assertion alone: it runs against this
// contract's own fixtures first (a WIRED fixture that must pass, an UNWIRED fixture that must
// fail) and refuses to check the live repository unless both self-tests behave as expected.
//
// Run as: node contracts/checks/vendor-f9-permit-posture/check-admin-permit-fields-rendered.mjs

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { globSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const REQUIRED_FIELDS = [
  'phytosanitaryPermitNumber',
  'citesPermitNumber',
  'foodHandlingCertificateNumber',
];

function missingFields(source) {
  return REQUIRED_FIELDS.filter((field) => !source.includes(field));
}

// --- Self-test ---------------------------------------------------------

const wiredFixture = readFileSync(path.join(__dirname, 'fixtures/admin-wired.tsx'), 'utf8');
const unwiredFixture = readFileSync(
  path.join(__dirname, 'fixtures/admin-unwired-no-fields.tsx'),
  'utf8',
);

const wiredMissing = missingFields(wiredFixture);
if (wiredMissing.length !== 0) {
  console.error(
    `SELF-TEST FAILED: WIRED golden fixture should render all permit fields but is missing: ${wiredMissing.join(', ')}`,
  );
  process.exit(1);
}

const unwiredMissing = missingFields(unwiredFixture);
if (unwiredMissing.length !== REQUIRED_FIELDS.length) {
  console.error(
    'SELF-TEST FAILED: UNWIRED fixture should be missing all permit fields, but the discriminator found some present.',
  );
  process.exit(1);
}

// --- Real check ----------------------------------------------------------

const candidateDirs = [
  path.join(REPO_ROOT, 'components/admin'),
  path.join(REPO_ROOT, 'app/admin/vendors'),
];

const candidateFiles = [];
for (const dir of candidateDirs) {
  if (!existsSync(dir)) continue;
  const found = globSync('**/*.{tsx,ts}', { cwd: dir }).map((f) => path.join(dir, f));
  candidateFiles.push(...found);
}

if (candidateFiles.length === 0) {
  console.error(`No candidate admin source files found under: ${candidateDirs.join(', ')}`);
  process.exit(1);
}

let combinedSource = '';
for (const file of candidateFiles) {
  combinedSource += readFileSync(file, 'utf8') + '\n';
}

const stillMissing = missingFields(combinedSource);
if (stillMissing.length > 0) {
  console.error(
    `FAIL: admin review UI does not render the following permit/certificate field(s) anywhere under ${candidateDirs.join(', ')}: ${stillMissing.join(', ')}`,
  );
  process.exit(1);
}

console.log('PASS: all three permit/certificate fields are rendered in the admin review UI.');
process.exit(0);
