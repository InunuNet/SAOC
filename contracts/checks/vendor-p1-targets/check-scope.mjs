// F7 -- the diff against base d2071be5 touches only the files this feature is allowed to touch.
// "Change no other copy" is enforced structurally: a file outside this list is a scope breach.
//
// Run as: node contracts/checks/vendor-p1-targets/check-scope.mjs

import { execFileSync } from 'node:child_process';

const BASE = 'd2071be5';
const ALLOWED_EXACT = new Set([
  // label rename
  'app/(marketing)/national-show/vendors/page.tsx',
  'app/(marketing)/national-show/page.tsx',
  'components/show/ShowSectionNav.tsx',
  'components/chrome/nav-config.ts',
  'content/national-show-routes.json',
  'scripts/generate-nos-route-manifest.ts',
  // tap targets
  'components/vendors/VendorCheckboxField.tsx',
  'components/vendors/VendorCheckboxGroupField.tsx',
  'components/vendors/VendorRegistrationCodeEntryForm.tsx',
  // label rename follow-up (Brad: "Exhibitors and Vendors" everywhere)
  'app/(marketing)/national-show/vendors/loading.tsx',
  'components/vendors/VendorEmptyState.tsx',
  // payment invalid-link action
  'app/(marketing)/national-show/vendors/payment/page.tsx',
]);
const ALLOWED_PREFIXES = ['contracts/checks/vendor-p1-targets/', 'docs/', '.agent/memory/'];

const changed = execFileSync('git', ['diff', '--name-only', BASE], { encoding: 'utf8' }).split('\n').filter(Boolean);
const breaches = changed.filter((f) => !ALLOWED_EXACT.has(f) && !ALLOWED_PREFIXES.some((p) => f.startsWith(p)));
if (breaches.length > 0) {
  for (const f of breaches) console.error(`FAIL: out-of-scope change vs ${BASE}: ${f}`);
  process.exit(1);
}
console.log(`OK (${changed.length} changed files, all in scope)`);
