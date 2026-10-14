// Static source check -- no dev server. The full /register form must never fall through to a
// native GET (which would put every field, including PII, in the URL). Asserts: the <form> in
// VendorRegisterForm has method="post", and the submit button's disabled expression references
// the hydration flag so a pre-hydration submit is impossible.
//
// Run as: node contracts/checks/vendor-register-p2-f1/check-no-native-get.mjs
// Optional arg: <formSourcePath> (used to mutation-prove against old source).

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const formPath = process.argv[2] ?? resolve(repoRoot, 'components/vendors/VendorRegisterForm.tsx');
const src = readFileSync(formPath, 'utf8');

const failures = [];
const formTag = src.match(/<form\b[^>]*>/s)?.[0] ?? '';
if (!/\bmethod="post"/.test(formTag)) failures.push('<form> does not have method="post"');
if (!/const hydrated = useSyncExternalStore\([^)]*,\s*\(\) => true,\s*\(\) => false\)/.test(src)) {
  failures.push('hydrated flag (client true / server false) is missing');
}
const button = src.match(/<button\b[^>]*type="submit"[^>]*>|<button\b[^>]*>/s)?.[0] ?? '';
if (!/disabled=\{[^}]*!hydrated[^}]*\}/.test(button)) {
  failures.push('submit button disabled expression does not reference !hydrated');
}

if (failures.length > 0) {
  console.error('FAIL check-no-native-get:\n - ' + failures.join('\n - '));
  process.exit(1);
}
console.log('PASS check-no-native-get');
