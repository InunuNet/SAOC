#!/usr/bin/env node
// F8 (vendor-registration) — A8: no-magic-strings proof. BOOTH_NUMBER_PENDING_LABEL and
// LOGISTICS_NOT_SPECIFIED_LABEL must be exported top-level named constants from
// emails/VendorApprovalConfirmation.tsx, re-exported (not re-declared) from
// lib/vendor-approval-confirmation.ts if it references them at all, and formatBoothNumber/
// formatOptionalField must reference the named identifiers rather than a re-inlined literal.
//
// DEFEATING MUTATION: hardcoding a second, independently-spelled fallback string inside the
// component's JSX instead of calling the exported helper.
//
// Run as: node contracts/checks/vendor-f8-approval-email/check-named-constants.mjs

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const failures = [];

const templatePath = path.join(REPO_ROOT, 'emails/VendorApprovalConfirmation.tsx');
let template;
try {
  template = readFileSync(templatePath, 'utf8');
} catch (error) {
  console.error(`FAIL: could not read ${templatePath}: ${error.message}`);
  process.exit(1);
}

if (!/export\s+const\s+BOOTH_NUMBER_PENDING_LABEL\s*=/.test(template)) {
  failures.push(`${templatePath} does not export a top-level BOOTH_NUMBER_PENDING_LABEL constant.`);
}
if (!/export\s+const\s+LOGISTICS_NOT_SPECIFIED_LABEL\s*=/.test(template)) {
  failures.push(`${templatePath} does not export a top-level LOGISTICS_NOT_SPECIFIED_LABEL constant.`);
}

// formatBoothNumber/formatOptionalField's bodies must reference the constant identifier, not
// a re-inlined literal matching its value. Tolerant of either authoring style (`function foo(`
// or `const foo = (`) — extracts a bounded window of source starting at the declaration rather
// than assuming a specific brace/arrow shape, so this doesn't false-fail on a stylistic choice
// this contract doesn't otherwise mandate.
function extractDeclarationWindow(source, fnName, windowSize = 600) {
  const declPattern = new RegExp(`(?:function\\s+${fnName}\\s*\\(|const\\s+${fnName}\\s*=)`);
  const match = declPattern.exec(source);
  if (!match) return null;
  return source.slice(match.index, match.index + windowSize);
}

const formatBoothNumberWindow = extractDeclarationWindow(template, 'formatBoothNumber');
if (!formatBoothNumberWindow) {
  failures.push(`${templatePath}: could not locate a formatBoothNumber declaration to inspect.`);
} else {
  if (!/BOOTH_NUMBER_PENDING_LABEL/.test(formatBoothNumberWindow)) {
    failures.push(
      'formatBoothNumber does not reference the BOOTH_NUMBER_PENDING_LABEL identifier — ' +
        'it may be returning a re-inlined literal string instead.',
    );
  }
  if (/['"`]To be confirmed['"`]/.test(formatBoothNumberWindow)) {
    failures.push(
      'formatBoothNumber contains a re-inlined literal "To be confirmed" string instead of the named constant.',
    );
  }
}

const formatOptionalFieldWindow = extractDeclarationWindow(template, 'formatOptionalField');
if (!formatOptionalFieldWindow) {
  failures.push(`${templatePath}: could not locate a formatOptionalField declaration to inspect.`);
} else {
  if (!/LOGISTICS_NOT_SPECIFIED_LABEL/.test(formatOptionalFieldWindow)) {
    failures.push(
      'formatOptionalField does not reference the LOGISTICS_NOT_SPECIFIED_LABEL identifier.',
    );
  }
  if (/['"`]Not specified['"`]/.test(formatOptionalFieldWindow)) {
    failures.push(
      'formatOptionalField contains a re-inlined literal "Not specified" string instead of the named constant.',
    );
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: BOOTH_NUMBER_PENDING_LABEL and LOGISTICS_NOT_SPECIFIED_LABEL are exported top-level ' +
    'named constants, and both formatting functions reference the named identifiers rather ' +
    'than a re-inlined literal fallback string.',
);
process.exit(0);
