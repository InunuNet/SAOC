// A6 — regression guard. Proves no duplicate/invented error-display pattern was introduced.
// Client-side validation errors (the 'validation-error' descriptor kind) must still render
// exclusively through VendorRegisterStatusBanner + humaniseFieldError — the same path used for
// server-side/rate-limit/network errors — with no second error-rendering component or inline
// error UI introduced anywhere under components/vendors/.
//
// Run as: node contracts/checks/vendor-form-client-validation-gate-f1/check-error-display-pattern-reused.mjs

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const FORM_FILE = path.join(REPO_ROOT, 'components/vendors/VendorRegisterForm.tsx');
const BANNER_FILE = path.join(REPO_ROOT, 'components/vendors/VendorRegisterStatusBanner.tsx');
const VENDORS_DIR = path.join(REPO_ROOT, 'components/vendors');

const formSource = readFileSync(FORM_FILE, 'utf8');
const bannerSource = readFileSync(BANNER_FILE, 'utf8');

// 1. VendorRegisterForm.tsx must render VendorRegisterStatusBanner for the descriptor, and must
// NOT contain any other block iterating fieldErrors directly (that would be a second,
// independent error-rendering path bypassing the banner).
if (!formSource.includes('<VendorRegisterStatusBanner')) {
  console.error(`FAIL: ${FORM_FILE} no longer renders <VendorRegisterStatusBanner ...>.`);
  process.exit(1);
}
if (/fieldErrors\.map/.test(formSource)) {
  console.error(
    `FAIL: ${FORM_FILE} contains a "fieldErrors.map" call outside VendorRegisterStatusBanner — ` +
      'a second, duplicate error-rendering path appears to have been introduced.',
  );
  process.exit(1);
}

// 2. VendorRegisterStatusBanner.tsx must still route the 'validation-error' kind's fieldErrors
// through humaniseFieldError(...), not render raw messages.
if (!bannerSource.includes("descriptor.kind === 'validation-error'")) {
  console.error(
    `FAIL: ${BANNER_FILE} no longer branches on descriptor.kind === 'validation-error'.`,
  );
  process.exit(1);
}
if (!/humaniseFieldError\s*\(\s*message\s*\)/.test(bannerSource)) {
  console.error(
    `FAIL: ${BANNER_FILE} no longer calls humaniseFieldError(message) when rendering ` +
      'validation-error fieldErrors — raw, unhumanised error messages may now be shown, or a ' +
      'different rendering path was introduced.',
  );
  process.exit(1);
}

// 3. No other file under components/vendors/ should independently reference fieldErrors.map or
// declare a new component whose name suggests a parallel error-display surface.
const suspiciousNamePattern = /error|banner|alert/i;
const offenders = [];
for (const entry of readdirSync(VENDORS_DIR, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.tsx')) continue;
  if (entry.name === 'VendorRegisterStatusBanner.tsx' || entry.name === 'VendorRegisterForm.tsx') {
    continue;
  }
  const filePath = path.join(VENDORS_DIR, entry.name);
  const contents = readFileSync(filePath, 'utf8');
  if (/fieldErrors\.map/.test(contents)) {
    offenders.push(`${entry.name}: contains "fieldErrors.map"`);
  }
  if (suspiciousNamePattern.test(entry.name) && entry.name !== 'VendorRegisterStatusBanner.tsx') {
    offenders.push(`${entry.name}: filename suggests a parallel error/banner/alert component`);
  }
}
if (offenders.length > 0) {
  console.error('FAIL: possible duplicate error-display surface(s) found:');
  for (const o of offenders) console.error(`  - ${o}`);
  process.exit(1);
}

console.log(
  'PASS: validation-error fieldErrors render exclusively through VendorRegisterStatusBanner + ' +
    'humaniseFieldError; no duplicate error-display component found under components/vendors/.',
);
process.exit(0);
