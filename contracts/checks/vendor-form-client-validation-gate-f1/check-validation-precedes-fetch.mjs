// A1 — structural. Proves validateVendorRegisterFormClientSide(state) is called INSIDE
// handleSubmit, at an earlier line number than the fetch('/api/vendors/register', ...) call,
// in components/vendors/VendorRegisterForm.tsx. A source grep for "validateVendorRegisterForm
// ClientSide" alone would pass even if the call were moved to a different, unrelated function
// or removed from the submit path entirely — this check isolates the handleSubmit function body
// first, then locates both calls within it and compares line numbers, and fails closed (does
// NOT pass) if either call is missing from that body.
//
// Run as: node contracts/checks/vendor-form-client-validation-gate-f1/check-validation-precedes-fetch.mjs

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

// Find the matching closing brace of handleSubmit by brace-depth counting from its opening line.
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

console.log(
  `PASS: validateVendorRegisterFormClientSide(...) at handleSubmit line ${validationLineOffset} ` +
    `precedes fetch('/api/vendors/register', ...) at line ${fetchLineOffset}.`,
);
process.exit(0);
