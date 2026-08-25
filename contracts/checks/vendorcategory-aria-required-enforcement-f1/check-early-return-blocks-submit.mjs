// A2 — structural. Proves that in components/vendors/VendorRegisterForm.tsx, the call to
// validateVendorRegisterFormClientSide(state) inside handleSubmit occurs at an earlier line
// number than the fetch('/api/vendors/register', ...) call in the same function, and that the
// `if (clientErrors.length > 0)` block contains a `return` statement. Proves an empty
// vendorCategory (which the validator flags per A1) genuinely halts submission rather than
// merely setting error state and falling through.
//
// Run as: node contracts/checks/vendorcategory-aria-required-enforcement-f1/check-early-return-blocks-submit.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const TARGET = path.join(REPO_ROOT, 'components/vendors/VendorRegisterForm.tsx');

const source = readFileSync(TARGET, 'utf8');
const lines = source.split('\n');

const handleSubmitStartIdx = lines.findIndex((line) =>
  /async function handleSubmit\s*\(/.test(line),
);
if (handleSubmitStartIdx === -1) {
  console.error(`FAIL: no "async function handleSubmit(" found in ${TARGET}`);
  process.exit(1);
}

let depth = 0;
let started = false;
let handleSubmitEndIdx = -1;
for (let i = handleSubmitStartIdx; i < lines.length; i++) {
  for (const ch of lines[i]) {
    if (ch === '{') {
      depth += 1;
      started = true;
    } else if (ch === '}') {
      depth -= 1;
    }
  }
  if (started && depth === 0) {
    handleSubmitEndIdx = i;
    break;
  }
}
if (handleSubmitEndIdx === -1) {
  console.error(`FAIL: could not find closing brace of handleSubmit in ${TARGET}`);
  process.exit(1);
}

const bodyLines = lines.slice(handleSubmitStartIdx, handleSubmitEndIdx + 1);
const bodySource = bodyLines.join('\n');

const validationLineOffset = bodyLines.findIndex((line) =>
  line.includes('validateVendorRegisterFormClientSide('),
);
const fetchLineOffset = bodyLines.findIndex((line) =>
  line.includes("fetch('/api/vendors/register'"),
);

if (validationLineOffset === -1) {
  console.error(
    'FAIL: validateVendorRegisterFormClientSide(...) call not found inside handleSubmit — ' +
      'the client validation gate has been removed from the submit path.',
  );
  process.exit(1);
}
if (fetchLineOffset === -1) {
  console.error(
    "FAIL: fetch('/api/vendors/register', ...) call not found inside handleSubmit — cannot " +
      'compare ordering (this itself may indicate the submit path was restructured).',
  );
  process.exit(1);
}
if (validationLineOffset >= fetchLineOffset) {
  console.error(
    `FAIL: validateVendorRegisterFormClientSide(...) call (handleSubmit-relative line ` +
      `${validationLineOffset}) does not precede the fetch(...) call (line ${fetchLineOffset}) — ` +
      'validation ordering regression.',
  );
  process.exit(1);
}

const ifIdx = bodySource.indexOf('if (clientErrors.length > 0)');
if (ifIdx === -1) {
  console.error(
    'FAIL: "if (clientErrors.length > 0)" not found in handleSubmit — the client error-count ' +
      'gate itself is missing.',
  );
  process.exit(1);
}

const openBraceIdx = bodySource.indexOf('{', ifIdx);
if (openBraceIdx === -1) {
  console.error('FAIL: no opening brace found after "if (clientErrors.length > 0)".');
  process.exit(1);
}

let blockDepth = 0;
let closeBraceIdx = -1;
for (let i = openBraceIdx; i < bodySource.length; i++) {
  if (bodySource[i] === '{') blockDepth += 1;
  else if (bodySource[i] === '}') {
    blockDepth -= 1;
    if (blockDepth === 0) {
      closeBraceIdx = i;
      break;
    }
  }
}
if (closeBraceIdx === -1) {
  console.error('FAIL: could not find matching closing brace for the clientErrors if-block.');
  process.exit(1);
}

const blockBody = bodySource.slice(openBraceIdx + 1, closeBraceIdx);
if (!/\breturn\s*;/.test(blockBody)) {
  console.error(
    `FAIL: no "return;" statement found inside the "if (clientErrors.length > 0)" block body:\n` +
      `${blockBody}`,
  );
  process.exit(1);
}

console.log(
  'PASS: validateVendorRegisterFormClientSide(...) precedes fetch(...) in handleSubmit, and the ' +
    'clientErrors.length > 0 block returns before reaching it.',
);
process.exit(0);
