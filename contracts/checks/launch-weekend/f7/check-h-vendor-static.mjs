#!/usr/bin/env node
// F7b-B1 - vendor apply form source rules (R32 / J4). Server validation is unchanged; copy is verbatim from the goldens.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { GOLDEN_DIR, read, readJson, report } from './_lib.mjs';

const copy = readJson(`${GOLDEN_DIR}/vendor-apply-copy.json`);
const problems = [];
const form = read('components/vendors/VendorApplyForm.tsx');
const field = read('components/vendors/VendorFormField.tsx');
const group = read('components/vendors/VendorCheckboxGroupField.tsx');

// client validation runs before any POST
const fetchAt = form.indexOf("fetch('/api/vendors/apply'");
const validateAt = form.search(/validateVendorApply\w*\(|validateVendorApplicationInput\(/);
if (fetchAt < 0) problems.push("VendorApplyForm: POST to /api/vendors/apply is gone");
if (validateAt < 0 || validateAt > fetchAt) problems.push('VendorApplyForm: no client-side validation call ahead of the fetch');
const between = fetchAt > 0 && validateAt >= 0 ? form.slice(validateAt, fetchAt) : '';
if (!/return\s*;/.test(between)) problems.push('VendorApplyForm: an invalid submit does not return before the fetch');

// error summary: role=alert, programmatically focusable, focused after an invalid submit
if (!/role=["']alert["']/.test(form)) problems.push('VendorApplyForm: no role="alert" error summary');
if (!/tabIndex=\{-1\}/.test(form) || !/\.focus\(/.test(form)) problems.push('VendorApplyForm: error summary is not focused (needs tabIndex={-1} and a .focus() call)');
if (!/href=\{?[`"']#vendor-register-/.test(form)) problems.push('VendorApplyForm: summary items do not link to their fields (#vendor-register-<key>)');

// field wiring
if (!/aria-describedby/.test(field) || !/aria-invalid/.test(field)) problems.push('VendorFormField: missing aria-describedby / aria-invalid wiring');
if (!/aria-describedby/.test(group) || !/aria-invalid/.test(group)) problems.push('VendorCheckboxGroupField: missing aria-describedby / aria-invalid wiring');
if (/aria-required/.test(group)) problems.push('VendorCheckboxGroupField: aria-required on a <fieldset> is invalid (axe aria-allowed-attr, critical); state "(required)" in the legend instead');
for (const [token, attr] of Object.entries({ organization: 'businessName', name: 'contactPersonName', email: 'contactEmail', tel: 'contactCellPhone' })) {
  if (!new RegExp(`autoComplete=["']${token}["']`).test(form + field)) problems.push(`autocomplete="${token}" missing for ${attr}`);
}
if (!/inputMode=["']numeric["']/.test(form + field)) problems.push('stands field: inputMode="numeric" missing');
if (!/min=\{1\}/.test(form)) problems.push('stands field: min={1} missing');
if (!form.includes(copy.requiredSentence)) problems.push(`VendorApplyForm: verbatim sentence missing: "${copy.requiredSentence}"`);
// R82 (nos-critique-r6 f3) supersedes launch-weekend F7 here: no visible "(required)" suffix; required inputs carry aria-required, and the one optional field says so in its own label.
if (/\(required\)/.test(form + field)) problems.push('labels: a "(required)" suffix is still produced by the form (R82 removed it)');
if (!/aria-required=\{required/.test(field)) problems.push('VendorFormField: required inputs must carry aria-required (R82)');
if (!form.includes('label="Trading name (if different, optional)"')) problems.push('labels: the tradingName label must read exactly "Trading name (if different, optional)" (R82)');

// contrast of borders and button
if (/border-rule\b/.test(field)) problems.push('VendorFormField: input border still uses border-rule (1.3:1); use an existing token that reaches 3:1 (muted 5.2:1, primary-700, ink)');
if (/border-rule\b/.test(group.match(/const checkboxClass[\s\S]*?;/)?.[0] ?? '')) problems.push('VendorCheckboxGroupField: checkbox border still uses border-rule');
if (/bg-accent[^"'`]*text-ivory|text-ivory[^"'`]*bg-accent/.test(form)) problems.push('VendorApplyForm: submit button is still text-ivory on bg-accent (2.94:1)');

// server validation untouched
const base = process.env.BASE_REF || 'origin/main';
try {
  const changed = execFileSync('git', ['diff', '--name-only', base, '--', 'lib/vendor-applications.ts', 'app/api/vendors/apply/route.ts', 'lib/vendor-submissions.ts'], { encoding: 'utf8' }).trim();
  if (changed) problems.push(`server validation files changed vs ${base}: ${changed.split('\n').join(', ')}`);
} catch (e) { console.error(`INFRA: git diff against ${base} failed (${e.message})`); process.exit(2); }
if (!existsSync('lib/vendor-apply-form-validation.ts')) problems.push('lib/vendor-apply-form-validation.ts not created (client validator mirroring validateVendorApplicationInput)');
report(problems, 'vendor apply form source rules hold');
