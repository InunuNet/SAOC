// A1 — structural. Proves VendorFormField.tsx accepts a maxLength prop and forwards it as the
// maxLength attribute on BOTH the <textarea> branch and the <input> branch (the component
// renders one or the other depending on htmlType) -- a regression that wires only one branch
// must fail this check.
//
// Run as: node contracts/checks/vendor-form-maxlength-and-phone-pattern-f1/check-formfield-maxlength-prop.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const TARGET = path.join(REPO_ROOT, 'components/vendors/VendorFormField.tsx');

const source = readFileSync(TARGET, 'utf8');
const failures = [];

if (!/maxLength\?:\s*number/.test(source)) {
  failures.push(`FAIL: VendorFormFieldProps does not declare an optional maxLength?: number prop in ${TARGET}.`);
}

if (!/\{\s*[\s\S]*?fieldKey,[\s\S]*?\}\s*:\s*VendorFormFieldProps/.test(source) || !/\bmaxLength,?\n/.test(source)) {
  failures.push('FAIL: maxLength is not destructured from VendorFormFieldProps in the component signature.');
}

// Isolate the <textarea ...> tag and the <input ...> tag bodies to check each independently.
const textareaMatch = source.match(/<textarea\b[\s\S]*?\/>/);
const inputMatch = source.match(/<input\b[\s\S]*?\/>/);

if (!textareaMatch) {
  failures.push('FAIL: could not locate a <textarea ... /> element in VendorFormField.tsx.');
} else if (!/maxLength=\{maxLength\}/.test(textareaMatch[0])) {
  failures.push(
    `FAIL: <textarea> branch does not forward maxLength={maxLength}. Textarea JSX:\n${textareaMatch[0]}`,
  );
}

if (!inputMatch) {
  failures.push('FAIL: could not locate an <input ... /> element in VendorFormField.tsx.');
} else if (!/maxLength=\{maxLength\}/.test(inputMatch[0])) {
  failures.push(
    `FAIL: <input> branch does not forward maxLength={maxLength}. Input JSX:\n${inputMatch[0]}`,
  );
}

if (failures.length > 0) {
  for (const f of failures) console.error(f);
  process.exit(1);
}

console.log(
  'PASS: VendorFormField.tsx declares a maxLength prop and forwards it to both the <textarea> ' +
    'and <input> branches.',
);
process.exit(0);
