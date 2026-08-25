// A3 — structural. Proves lib/vendor-register-form-validation.ts defines a phone-format check
// matching the golden's ^[0-9+\-() ]{7,20}$ pattern and that validateVendorRegisterFormClientSide
// pushes the exact error string 'contactCellPhone must be a valid phone number' when
// contactCellPhone is non-empty and fails that check -- wired into the SAME function/errors
// array as the existing checks, only when the field is non-empty (no double-error on empty).
//
// Run as: node contracts/checks/vendor-form-maxlength-and-phone-pattern-f1/check-phone-validator-wired.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const TARGET = path.join(REPO_ROOT, 'lib/vendor-register-form-validation.ts');

const source = readFileSync(TARGET, 'utf8');
const failures = [];

const EXACT_ERROR = 'contactCellPhone must be a valid phone number';

if (!source.includes('[0-9+\\-() ]{7,20}')) {
  failures.push(
    `FAIL: no phone-format regex matching the golden's ^[0-9+\\-() ]{7,20}$ pattern found in ${TARGET}.`,
  );
}

if (!source.includes(EXACT_ERROR)) {
  failures.push(`FAIL: exact error string "${EXACT_ERROR}" not found in ${TARGET}.`);
}

// Isolate the exported function body to prove the push happens inside it, not in some other
// standalone function called separately.
const fnIdx = source.search(/export function validateVendorRegisterFormClientSide\s*\(/);
if (fnIdx === -1) {
  failures.push(`FAIL: validateVendorRegisterFormClientSide export not found in ${TARGET}.`);
} else {
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
  const fnBody = source.slice(openBraceIdx + 1, closeBraceIdx);

  if (!fnBody.includes(EXACT_ERROR)) {
    failures.push(
      `FAIL: validateVendorRegisterFormClientSide's body does not push the exact error string ` +
        `"${EXACT_ERROR}" -- phone validation may be wired into a second, standalone function ` +
        `instead. Function body:\n${fnBody}`,
    );
  }

  if (!/errors\.push/.test(fnBody) || (fnBody.match(/errors\.push/g) ?? []).length < 2) {
    failures.push(
      'FAIL: validateVendorRegisterFormClientSide does not appear to use the shared `errors` ' +
        'array with multiple pushes (expected the existing checks plus the new phone check).',
    );
  }

  // The phone-format push must be guarded so it only fires when contactCellPhone is non-empty
  // (else block, or an explicit non-empty condition), not unconditionally alongside the
  // required-field check.
  const phoneErrorIdx = fnBody.indexOf(EXACT_ERROR);
  if (phoneErrorIdx !== -1) {
    const surrounding = fnBody.slice(Math.max(0, phoneErrorIdx - 400), phoneErrorIdx);
    if (!/else if|else\s*\{|trim\(\)\s*!==\s*''/.test(surrounding)) {
      failures.push(
        'FAIL: the phone-format error push does not appear to be guarded behind a non-empty ' +
          `check (expected an else-if / non-empty guard near the push). Context:\n${surrounding}`,
      );
    }
  }
}

if (failures.length > 0) {
  for (const f of failures) console.error(f);
  process.exit(1);
}

console.log(
  'PASS: lib/vendor-register-form-validation.ts defines the golden phone regex and pushes the ' +
    'exact error string from within validateVendorRegisterFormClientSide, guarded to only fire ' +
    'on a non-empty, malformed contactCellPhone.',
);
process.exit(0);
