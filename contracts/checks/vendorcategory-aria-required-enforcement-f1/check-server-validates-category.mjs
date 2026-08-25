// A4 — structural. Proves lib/vendor-submissions.ts's validateVendorSubmissionInput
// independently rejects an empty vendorCategory array server-side (i.e. the server does not
// rely solely on the client-side gate proven by A1/A2), and that validateVendorCategory is
// actually invoked from within validateVendorSubmissionInput rather than merely defined and
// left unused.
//
// Run as: node contracts/checks/vendorcategory-aria-required-enforcement-f1/check-server-validates-category.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const TARGET = path.join(REPO_ROOT, 'lib/vendor-submissions.ts');

const source = readFileSync(TARGET, 'utf8');

if (!/function validateVendorCategory\s*\(/.test(source)) {
  console.error(`FAIL: validateVendorCategory(...) function no longer defined in ${TARGET}.`);
  process.exit(1);
}

const fnIdx = source.search(/function validateVendorCategory\s*\(/);
const openBraceIdx = source.indexOf('{', fnIdx);
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
  console.error('FAIL: could not find matching closing brace for validateVendorCategory.');
  process.exit(1);
}
const fnBody = source.slice(openBraceIdx + 1, closeBraceIdx);

if (!/!Array\.isArray\(value\)\s*\|\|\s*value\.length === 0/.test(fnBody)) {
  console.error(
    `FAIL: validateVendorCategory no longer rejects a non-array or empty-array value:\n${fnBody}`,
  );
  process.exit(1);
}
if (!/errors\.push\(\s*['"`][^'"`]*vendorCategory[^'"`]*['"`]/.test(fnBody)) {
  console.error(
    `FAIL: validateVendorCategory's empty/invalid-array branch does not push an error string ` +
      `mentioning "vendorCategory":\n${fnBody}`,
  );
  process.exit(1);
}

if (!/validateVendorCategory\(\s*record\.vendorCategory\s*,\s*errors\s*\)/.test(source)) {
  console.error(
    `FAIL: validateVendorCategory(record.vendorCategory, errors) is not called anywhere in ` +
      `${TARGET} — the server-side check may be defined but never wired into ` +
      'validateVendorSubmissionInput.',
  );
  process.exit(1);
}

console.log(
  'PASS: validateVendorCategory rejects a non-array/empty vendorCategory with a ' +
    'vendorCategory-labelled error, and is called from validateVendorSubmissionInput.',
);
process.exit(0);
