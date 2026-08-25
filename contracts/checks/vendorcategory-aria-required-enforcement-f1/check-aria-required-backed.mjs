// A5 — structural. Proves components/vendors/VendorCategoryFieldset.tsx passes `required` to
// its VendorCheckboxGroupField for the vendorCategory field, and
// components/vendors/VendorCheckboxGroupField.tsx renders aria-required="true" on the outer
// <fieldset> when `required` is true. Proves the ARIA contract stays truthful given A1-A4 now
// genuinely back it with enforcement on both sides of the form.
//
// Run as: node contracts/checks/vendorcategory-aria-required-enforcement-f1/check-aria-required-backed.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const FIELDSET_FILE = path.join(REPO_ROOT, 'components/vendors/VendorCategoryFieldset.tsx');
const GROUP_FILE = path.join(REPO_ROOT, 'components/vendors/VendorCheckboxGroupField.tsx');

const fieldsetSource = readFileSync(FIELDSET_FILE, 'utf8');
const groupSource = readFileSync(GROUP_FILE, 'utf8');

const categoryCallIdx = fieldsetSource.indexOf('fieldKey="vendorCategory"');
if (categoryCallIdx === -1) {
  console.error(`FAIL: no fieldKey="vendorCategory" usage found in ${FIELDSET_FILE}.`);
  process.exit(1);
}

// The VendorCheckboxGroupField JSX call for vendorCategory is the nearest preceding
// <VendorCheckboxGroupField up to the next JSX tag close (">" of the self-closing/opening tag
// after the props). Isolate that one JSX element's prop text.
const tagOpenIdx = fieldsetSource.lastIndexOf('<VendorCheckboxGroupField', categoryCallIdx);
if (tagOpenIdx === -1) {
  console.error(`FAIL: could not locate the <VendorCheckboxGroupField ...> tag opening before fieldKey="vendorCategory".`);
  process.exit(1);
}
const tagCloseIdx = fieldsetSource.indexOf('/>', categoryCallIdx);
if (tagCloseIdx === -1) {
  console.error('FAIL: could not locate the closing "/>" of the vendorCategory VendorCheckboxGroupField element.');
  process.exit(1);
}
const elementProps = fieldsetSource.slice(tagOpenIdx, tagCloseIdx);

if (!/\brequired\b(?!=)/.test(elementProps) && !/required\s*=\s*{true}/.test(elementProps)) {
  console.error(
    `FAIL: the vendorCategory <VendorCheckboxGroupField ...> element does not pass a truthy ` +
      `"required" prop:\n${elementProps}`,
  );
  process.exit(1);
}

if (!/aria-required=\{required \? ['"`]true['"`] : undefined\}/.test(groupSource)) {
  console.error(
    `FAIL: ${GROUP_FILE} no longer renders aria-required derived from the "required" prop on ` +
      'the outer <fieldset> (expected pattern: aria-required={required ? \'true\' : undefined}).',
  );
  process.exit(1);
}

console.log(
  'PASS: VendorCategoryFieldset passes required for vendorCategory, and ' +
    'VendorCheckboxGroupField renders aria-required="true" on the fieldset from that prop.',
);
process.exit(0);
