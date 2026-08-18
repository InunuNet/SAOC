#!/usr/bin/env node
// Verifies that a named guard function call is used as the CONDITION of a JSX ternary
// immediately preceding a given fieldKey's <VendorFormField>. Guards against the mutation
// class this project has been burned by before: a check that only proves the guard function
// is CALLED somewhere in the file, not that its result actually gates the field.
//
// Usage: node check-conditional-render.mjs <file> <guardCallText> <fieldKey>
// Example: node check-conditional-render.mjs components/vendors/VendorBoothFieldset.tsx \
//   "isElectricalLoadApplicable(state)" electricalLoad

import { readFileSync } from 'node:fs';

const [, , file, guardCall, fieldKey] = process.argv;

if (!file || !guardCall || !fieldKey) {
  console.error('usage: check-conditional-render.mjs <file> <guardCallText> <fieldKey>');
  process.exit(2);
}

const source = readFileSync(file, 'utf8');

// The guard call must appear immediately after a `{` (JSX expression start) and immediately
// before a `?` (ternary), and the fieldKey attribute for VendorFormField must appear within a
// bounded window after that `?` -- bounded so an unrelated guard/field pair elsewhere in the
// file can't accidentally satisfy the match.
const pattern = new RegExp(
  `\\{\\s*${escapeRegex(guardCall)}\\s*\\?[\\s\\S]{0,400}?fieldKey=["']${escapeRegex(fieldKey)}["']`,
);

if (!pattern.test(source)) {
  console.error(
    `FAIL: ${file} does not gate fieldKey="${fieldKey}" behind {${guardCall} ? ... } within 400 chars.`,
  );
  process.exit(1);
}

console.log(`PASS: ${fieldKey} is gated behind ${guardCall} in ${file}`);

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
