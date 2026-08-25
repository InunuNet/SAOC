// A2 — structural. Proves every one of the 21 fieldset call sites in the golden's table passes
// a maxLength prop to VendorFormField with EXACTLY the documented value, and that the 4
// number-typed fields (boothCount, tableCount, chairCount, staffPerDay) do NOT have a
// maxLength added (out of scope, would be a wasted no-op diff per the golden).
//
// Run as: node contracts/checks/vendor-form-maxlength-and-phone-pattern-f1/check-fieldset-maxlength-values.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const EXPECTED = [
  ['VendorContactFieldset.tsx', 'businessName', 200],
  ['VendorContactFieldset.tsx', 'tradingName', 200],
  ['VendorContactFieldset.tsx', 'contactPersonName', 150],
  ['VendorContactFieldset.tsx', 'contactCellPhone', 30],
  ['VendorContactFieldset.tsx', 'contactEmail', 254],
  ['VendorContactFieldset.tsx', 'physicalAddress', 500],
  ['VendorContactFieldset.tsx', 'cipcNumber', 50],
  ['VendorContactFieldset.tsx', 'vatNumber', 50],
  ['VendorContactFieldset.tsx', 'website', 300],
  ['VendorContactFieldset.tsx', 'socialMediaHandle', 200],
  ['VendorCategoryFieldset.tsx', 'productDescription', 2000],
  ['VendorCategoryFieldset.tsx', 'phytosanitaryPermitNumber', 100],
  ['VendorCategoryFieldset.tsx', 'citesPermitNumber', 100],
  ['VendorCategoryFieldset.tsx', 'foodHandlingCertificateNumber', 100],
  ['VendorCategoryFieldset.tsx', 'foodItemList', 1000],
  ['VendorBoothFieldset.tsx', 'electricalLoad', 100],
  ['VendorBoothFieldset.tsx', 'vehicleRegistrations', 150],
  ['VendorBoothFieldset.tsx', 'loadInSlot', 100],
  ['VendorBoothFieldset.tsx', 'loadOutSlot', 100],
  ['VendorMarketingFieldset.tsx', 'bio', 1000],
  ['VendorPaymentFieldset.tsx', 'paymentReference', 200],
];

const OUT_OF_SCOPE = [
  ['VendorBoothFieldset.tsx', 'boothCount'],
  ['VendorBoothFieldset.tsx', 'tableCount'],
  ['VendorBoothFieldset.tsx', 'chairCount'],
  ['VendorBoothFieldset.tsx', 'staffPerDay'],
];

const failures = [];
const sourceCache = new Map();

function getSource(file) {
  if (!sourceCache.has(file)) {
    sourceCache.set(
      file,
      readFileSync(path.join(REPO_ROOT, 'components/vendors', file), 'utf8'),
    );
  }
  return sourceCache.get(file);
}

// Extract the VendorFormField (or self-closing variant) call-site block for a given fieldKey --
// scans from `fieldKey="<key>"` to the matching closing `/>` of that JSX element.
function extractCallSite(source, fieldKey) {
  const keyIdx = source.indexOf(`fieldKey="${fieldKey}"`);
  if (keyIdx === -1) return null;
  // Walk backward to the opening `<VendorFormField`.
  const openIdx = source.lastIndexOf('<VendorFormField', keyIdx);
  if (openIdx === -1) return null;
  // Walk forward to the first `/>` after the fieldKey occurrence (call sites are single JSX
  // elements with no nested VendorFormField children).
  const closeIdx = source.indexOf('/>', keyIdx);
  if (closeIdx === -1) return null;
  return source.slice(openIdx, closeIdx + 2);
}

for (const [file, fieldKey, expectedMax] of EXPECTED) {
  const source = getSource(file);
  const block = extractCallSite(source, fieldKey);
  if (!block) {
    failures.push(`FAIL: could not find a VendorFormField call site for fieldKey="${fieldKey}" in ${file}.`);
    continue;
  }
  const maxLengthMatch = block.match(/maxLength=\{(\d+)\}/);
  if (!maxLengthMatch) {
    failures.push(`FAIL: ${file} fieldKey="${fieldKey}" has no maxLength={N} prop. Block:\n${block}`);
    continue;
  }
  const actual = Number(maxLengthMatch[1]);
  if (actual !== expectedMax) {
    failures.push(
      `FAIL: ${file} fieldKey="${fieldKey}" has maxLength={${actual}}, expected ${expectedMax}.`,
    );
  }
}

for (const [file, fieldKey] of OUT_OF_SCOPE) {
  const source = getSource(file);
  const block = extractCallSite(source, fieldKey);
  if (!block) {
    failures.push(`FAIL: could not find a VendorFormField call site for fieldKey="${fieldKey}" in ${file}.`);
    continue;
  }
  if (/maxLength=/.test(block)) {
    failures.push(
      `FAIL: ${file} fieldKey="${fieldKey}" (type=number, out of scope) has a maxLength prop -- ` +
        `a wasted no-op diff per the golden. Block:\n${block}`,
    );
  }
}

if (failures.length > 0) {
  for (const f of failures) console.error(f);
  process.exit(1);
}

console.log(
  `PASS: all ${EXPECTED.length} fieldset call sites carry the exact golden-table maxLength ` +
    `value, and all ${OUT_OF_SCOPE.length} number-typed fields carry none.`,
);
process.exit(0);
