#!/usr/bin/env node
// contract-stand-payment-link-visibility -- A2: static proof that
// components/admin/VendorReviewTable.tsx (the ONLY admin surface listing vendor submissions,
// per app/admin/vendors/*) wires a control that calls the resend-payment-link route and
// surfaces its paymentUrl to the operator (display and/or copy-to-clipboard) -- so the
// committee has a way to get a working payment link tonight that does not depend on email.
//
// Deliberately grep-based, not a DOM-render test: this repo's other admin-table checks
// (e.g. contracts/checks/vendor-f7-payment-path/check-admin-payment-route-wiring.mjs) use the
// same static-wiring-proof style for this component family. A component exceeding 150 lines
// must be split per this project's coding.md -- if @dev extracts a
// VendorStandPaymentLinkControl.tsx sub-component, update SOURCE_FILES below to include it
// rather than loosening this check.
//
// Run as: node contracts/checks/vendor-stand-payment-link-visibility/check-review-table-wires-payment-link-control.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_FILES = ['components/admin/VendorReviewTable.tsx'];

const failures = [];
function assert(condition, label) {
  if (!condition) failures.push(label);
}

const sources = SOURCE_FILES.map((relPath) => {
  const fullPath = path.join(__dirname, '../../../', relPath);
  try {
    return { relPath, text: readFileSync(fullPath, 'utf8') };
  } catch {
    return { relPath, text: '' };
  }
});
const combined = sources.map((s) => s.text).join('\n');

assert(
  /resend-payment-link/.test(combined),
  `expected one of ${JSON.stringify(SOURCE_FILES)} to call the existing POST /api/admin/vendors/[id]/resend-payment-link route (reuse, not a new route) -- found no reference to "resend-payment-link".`,
);
assert(
  /paymentUrl/.test(combined),
  `expected the component to read a "paymentUrl" field from the route's JSON response -- found no reference to "paymentUrl".`,
);
assert(
  /clipboard/i.test(combined),
  `expected a copy-to-clipboard affordance (navigator.clipboard or equivalent) so an operator can hand the URL to a vendor without email -- found no "clipboard" reference.`,
);
assert(
  /approved/.test(combined) && /VendorStandOrderStatus|standPaymentStatus/.test(combined),
  `expected the payment-link control to be gated on submission status "approved" and the existing standPaymentStatus (not shown for a submission that isn't approved, or a stand already paid) -- reuse the component's existing standPaymentStatusById prop rather than inventing a second one.`,
);

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  'PASS: components/admin/VendorReviewTable.tsx wires a payment-link control that calls the ' +
    'resend-payment-link route, reads paymentUrl from its response, offers copy-to-clipboard, ' +
    'and is gated on approved/unpaid status.',
);
process.exit(0);
