// A1 — structural. Proves lib/vendor-register-form-validation.ts's
// validateVendorRegisterFormClientSide contains a conditional on
// state.vendorCategory.length === 0 that pushes an error string containing "vendorCategory"
// into the returned errors array. A whole-file grep for "vendorCategory" alone would pass even
// if the check were weakened to a warning or moved somewhere that never affects the returned
// errors — this isolates the specific if-block guarding the push.
//
// Run as: node contracts/checks/vendorcategory-aria-required-enforcement-f1/check-validator-rejects-empty-category.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const TARGET = path.join(REPO_ROOT, 'lib/vendor-register-form-validation.ts');

const source = readFileSync(TARGET, 'utf8');

const ifIdx = source.indexOf('if (state.vendorCategory.length === 0)');
if (ifIdx === -1) {
  console.error(
    `FAIL: "if (state.vendorCategory.length === 0)" not found in ${TARGET} — the empty-array ` +
      'guard on vendorCategory appears to be missing or was rewritten.',
  );
  process.exit(1);
}

const openBraceIdx = source.indexOf('{', ifIdx);
if (openBraceIdx === -1) {
  console.error('FAIL: no opening brace found after the vendorCategory length check.');
  process.exit(1);
}

let depth = 0;
let closeBraceIdx = -1;
for (let i = openBraceIdx; i < source.length; i++) {
  if (source[i] === '{') depth += 1;
  else if (source[i] === '}') {
    depth -= 1;
    if (depth === 0) {
      closeBraceIdx = i;
      break;
    }
  }
}
if (closeBraceIdx === -1) {
  console.error('FAIL: could not find matching closing brace for the vendorCategory if-block.');
  process.exit(1);
}

const blockBody = source.slice(openBraceIdx + 1, closeBraceIdx);

if (!/errors\.push\(\s*['"`][^'"`]*vendorCategory[^'"`]*['"`]/.test(blockBody)) {
  console.error(
    `FAIL: the "if (state.vendorCategory.length === 0)" block body does not contain an ` +
      `errors.push(...) call with a string mentioning "vendorCategory":\n${blockBody}`,
  );
  process.exit(1);
}

console.log(
  'PASS: validateVendorRegisterFormClientSide pushes a vendorCategory error when ' +
    'state.vendorCategory.length === 0.',
);
process.exit(0);
