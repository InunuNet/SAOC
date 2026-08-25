// A2 — structural. Proves the `if (clientErrors.length > 0)` block inside handleSubmit
// (components/vendors/VendorRegisterForm.tsx) contains a `return` statement in its own body —
// i.e. an invalid form genuinely halts execution rather than merely setting error state and
// falling through to the fetch call below it. Isolates the specific if-block by brace matching
// (not a whole-function or whole-file grep for "return"), so a `return` elsewhere in
// handleSubmit (e.g. the honeypot branch, or the top-of-function submitting guard) cannot
// satisfy this check by accident.
//
// Run as: node contracts/checks/vendor-form-client-validation-gate-f1/check-early-return-blocks-submit.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const TARGET = path.join(REPO_ROOT, 'components/vendors/VendorRegisterForm.tsx');

const source = readFileSync(TARGET, 'utf8');

const ifIdx = source.indexOf('if (clientErrors.length > 0)');
if (ifIdx === -1) {
  console.error(
    'FAIL: "if (clientErrors.length > 0)" not found in VendorRegisterForm.tsx — the client ' +
      'error-count gate itself is missing.',
  );
  process.exit(1);
}

const openBraceIdx = source.indexOf('{', ifIdx);
if (openBraceIdx === -1) {
  console.error('FAIL: no opening brace found after "if (clientErrors.length > 0)".');
  process.exit(1);
}

// Brace-depth match to find the block's closing brace.
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
  console.error('FAIL: could not find matching closing brace for the clientErrors if-block.');
  process.exit(1);
}

const blockBody = source.slice(openBraceIdx + 1, closeBraceIdx);

if (!/\breturn\s*;/.test(blockBody)) {
  console.error(
    `FAIL: no "return;" statement found inside the "if (clientErrors.length > 0)" block body:\n` +
      `${blockBody}`,
  );
  process.exit(1);
}

console.log('PASS: "if (clientErrors.length > 0)" block body contains a return statement.');
process.exit(0);
