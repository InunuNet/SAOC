// Pins POST /api/vendors/register/verify-code to the atomic verification path.
//
// The race tests prove verifyVendorRegistrationCodeAtomically is safe, but nothing else would
// notice the route going back to the old shape (verify on a pre-read snapshot, then a separate
// recordFailedAttempt), which type-checks and passes them. This is a source assertion: the route
// must hand the handler `verifyAtomically` backed by verifyVendorRegistrationCodeAtomically, and
// must not pass the old `recordFailedAttempt` dependency or call the standalone recorder.
//
// Run as: npx tsx --test --experimental-test-module-mocks \
//   contracts/checks/vendor-code-verify-race/check-route-uses-atomic-path.test.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const ROUTE = new URL('../../../app/api/vendors/register/verify-code/route.ts', import.meta.url);

// Comments mention the old names while explaining the fix, so judge code only.
const code = readFileSync(ROUTE, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

test('the route imports and calls verifyVendorRegistrationCodeAtomically', () => {
  assert.match(code, /import\s*\{[^}]*\bverifyVendorRegistrationCodeAtomically\b[^}]*\}\s*from/);
  assert.match(code, /\bverifyVendorRegistrationCodeAtomically\s*\(/);
});

test('the route passes verifyAtomically to the handler', () => {
  assert.match(code, /\bverifyAtomically\s*:/);
});

test('the route does not pass the old record-after-verify dependency', () => {
  assert.doesNotMatch(code, /\brecordFailedAttempt\s*:/);
  assert.doesNotMatch(code, /\brecordFailedVendorRegistrationCodeAttempt\b/);
});
