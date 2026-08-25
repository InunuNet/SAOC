// A3 — structural. Proves lib/vendor-register-response.ts's VENDOR_FIELD_LABELS map contains a
// 'vendorCategory' key with a non-empty human-readable label, and
// components/vendors/VendorRegisterStatusBanner.tsx still renders the 'validation-error'
// descriptor kind's fieldErrors through humaniseFieldError inside a role="alert" container.
//
// Run as: node contracts/checks/vendorcategory-aria-required-enforcement-f1/check-error-display-pattern.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const RESPONSE_FILE = path.join(REPO_ROOT, 'lib/vendor-register-response.ts');
const BANNER_FILE = path.join(REPO_ROOT, 'components/vendors/VendorRegisterStatusBanner.tsx');

const responseSource = readFileSync(RESPONSE_FILE, 'utf8');
const bannerSource = readFileSync(BANNER_FILE, 'utf8');

const labelMatch = responseSource.match(/vendorCategory:\s*['"`]([^'"`]+)['"`]/);
if (!labelMatch || labelMatch[1].trim().length === 0) {
  console.error(
    `FAIL: VENDOR_FIELD_LABELS in ${RESPONSE_FILE} has no non-empty 'vendorCategory' entry — ` +
      'the raw internal validator error string would leak to users instead of a humanised label.',
  );
  process.exit(1);
}

if (!bannerSource.includes('role="alert"')) {
  console.error(`FAIL: ${BANNER_FILE} no longer renders a role="alert" container.`);
  process.exit(1);
}
if (!bannerSource.includes("descriptor.kind === 'validation-error'")) {
  console.error(
    `FAIL: ${BANNER_FILE} no longer branches on descriptor.kind === 'validation-error'.`,
  );
  process.exit(1);
}
if (!/humaniseFieldError\s*\(\s*message\s*\)/.test(bannerSource)) {
  console.error(
    `FAIL: ${BANNER_FILE} no longer calls humaniseFieldError(message) when rendering ` +
      'validation-error fieldErrors.',
  );
  process.exit(1);
}

// Fail closed against a second/duplicate error-rendering path for fieldErrors introduced
// elsewhere under components/vendors/.
import { readdirSync } from 'node:fs';
const VENDORS_DIR = path.join(REPO_ROOT, 'components/vendors');
const offenders = [];
for (const entry of readdirSync(VENDORS_DIR, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.tsx')) continue;
  if (entry.name === 'VendorRegisterStatusBanner.tsx') continue;
  const contents = readFileSync(path.join(VENDORS_DIR, entry.name), 'utf8');
  if (/fieldErrors\.map/.test(contents)) {
    offenders.push(`${entry.name}: contains "fieldErrors.map"`);
  }
}
if (offenders.length > 0) {
  console.error('FAIL: possible duplicate error-display surface(s) found:');
  for (const o of offenders) console.error(`  - ${o}`);
  process.exit(1);
}

console.log(
  `PASS: VENDOR_FIELD_LABELS.vendorCategory = "${labelMatch[1]}"; ` +
    'VendorRegisterStatusBanner still routes validation-error fieldErrors through ' +
    'humaniseFieldError inside a role="alert" container, with no duplicate rendering path.',
);
process.exit(0);
