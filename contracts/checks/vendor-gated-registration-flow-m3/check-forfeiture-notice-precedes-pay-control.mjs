#!/usr/bin/env node
// vendor-gated-registration-flow M3/F29 (A58) -- behavioural proof (real react-dom/server
// output, same technique as A9/A52) that VendorStandPaymentForm.tsx renders
// lib/vendor-stand-forfeiture-notice.ts's VENDOR_STAND_FORFEITURE_NOTICE constant VERBATIM,
// and that its position in the rendered HTML precedes the "Pay Now" control. Also checks the
// component source for a second, driftable inline copy of the sentence.
//
// Run as: node --import tsx/esm contracts/checks/vendor-gated-registration-flow-m3/check-forfeiture-notice-precedes-pay-control.mjs

import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

import { VendorStandPaymentForm } from '../../../components/vendors/VendorStandPaymentForm.tsx';
import { VENDOR_STAND_FORFEITURE_NOTICE } from '../../../lib/vendor-stand-forfeiture-notice.ts';

const failures = [];
function assert(condition, label) {
  if (!condition) failures.push(label);
}

const html = renderToStaticMarkup(
  React.createElement(VendorStandPaymentForm, { token: 'fake-token', businessName: 'Fynbos Pottery' }),
);

const noticeIndex = html.indexOf(VENDOR_STAND_FORFEITURE_NOTICE);
assert(
  noticeIndex !== -1,
  'the rendered page does not contain VENDOR_STAND_FORFEITURE_NOTICE verbatim -- either it is missing, paraphrased, or truncated.',
);

const payControlIndex = html.indexOf('Pay Now');
assert(payControlIndex !== -1, 'the rendered page does not contain a "Pay Now" control.');

if (noticeIndex !== -1 && payControlIndex !== -1) {
  assert(
    noticeIndex < payControlIndex,
    `the forfeiture notice (index ${noticeIndex}) does not precede the "Pay Now" control (index ${payControlIndex}) in DOM order.`,
  );
}

// --- No second, driftable inline copy of the sentence in the component's own source -----------
const componentSource = readFileSync(
  new URL('../../../components/vendors/VendorStandPaymentForm.tsx', import.meta.url),
  'utf8',
);
const inlineOccurrences = componentSource.split(VENDOR_STAND_FORFEITURE_NOTICE).length - 1;
assert(
  inlineOccurrences === 0,
  `VendorStandPaymentForm.tsx contains the forfeiture-notice sentence retyped inline (found ${inlineOccurrences} occurrence(s)) instead of importing it solely from lib/vendor-stand-forfeiture-notice.ts.`,
);
assert(
  /from ['"]@\/lib\/vendor-stand-forfeiture-notice['"]/.test(componentSource),
  'VendorStandPaymentForm.tsx does not import VENDOR_STAND_FORFEITURE_NOTICE from lib/vendor-stand-forfeiture-notice.ts.',
);

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  'PASS: VendorStandPaymentForm renders the forfeiture notice verbatim, positioned before the ' +
    '"Pay Now" control, sourced only from lib/vendor-stand-forfeiture-notice.ts with no second ' +
    'inline copy.',
);
process.exit(0);
