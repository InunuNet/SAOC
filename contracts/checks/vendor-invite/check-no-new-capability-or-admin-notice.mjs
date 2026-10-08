#!/usr/bin/env node
// vendor-invite F1 — A8: ABSENCE proof across every new/edited file this feature touches.
// Encodes two decisions from goldens/README.md as structural checks so a future edit cannot
// silently violate either without this contract being revisited:
//
//   (1) No capability string other than the EXISTING 'review-vendor-applications' appears
//       anywhere in the new files — this feature introduces no new admin capability.
//   (2) None of the three existing admin-notice sender modules
//       (vendor-application-admin-notice, vendor-submission-admin-notice,
//       vendor-payment-admin-notice) is imported anywhere — "no admin notice fires on
//       invite" (goldens/README.md, "Why no admin notice on invite").
//
// Run as: node contracts/checks/vendor-invite/check-no-new-capability-or-admin-notice.mjs

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const TARGET_FILES = [
  'lib/vendor-applications.ts',
  'lib/vendor-application-invite-eligibility.ts',
  'app/api/admin/vendors/applications/invite/route.ts',
  'components/admin/VendorInviteForm.tsx',
];

const ADMIN_NOTICE_MODULES = [
  'vendor-application-admin-notice',
  'vendor-submission-admin-notice',
  'vendor-payment-admin-notice',
];

const CAPABILITY_CALL_RE = /hasCapability\s*\([^)]*?['"]([a-z0-9-]+)['"]/gs;

const failures = [];

// ALL FOUR target files must exist by the time this assertion runs (phase 4, post-
// implementation) — requiring "at least one" would let this check report a false PASS merely
// because lib/vendor-applications.ts pre-exists from an earlier mission, before @dev has
// created app/api/admin/vendors/applications/invite/route.ts or
// components/admin/VendorInviteForm.tsx at all.
const missing = TARGET_FILES.filter((relPath) => !existsSync(path.join(REPO_ROOT, relPath)));
if (missing.length > 0) {
  console.error(`FAIL: not all target files exist yet — missing: ${missing.join(', ')}. Run after @dev has created every file this feature touches.`);
  process.exit(1);
}

for (const relPath of TARGET_FILES) {
  const fullPath = path.join(REPO_ROOT, relPath);
  const source = readFileSync(fullPath, 'utf8');

  for (const match of source.matchAll(CAPABILITY_CALL_RE)) {
    const capability = match[1];
    if (capability !== 'review-vendor-applications') {
      failures.push(`${relPath}: hasCapability(...) called with a capability other than the existing 'review-vendor-applications': '${capability}'`);
    }
  }

  for (const noticeModule of ADMIN_NOTICE_MODULES) {
    const importRe = new RegExp(`from\\s*['"][^'"]*${noticeModule}['"]`);
    if (importRe.test(source)) {
      failures.push(`${relPath}: imports the admin-notice module '${noticeModule}' — an invite must never fire an admin notice (goldens/README.md 'Why no admin notice on invite')`);
    }
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: no new capability string beyond the existing review-vendor-applications, and no ' +
    'admin-notice sender module is imported, across all target files found.',
);
process.exit(0);
