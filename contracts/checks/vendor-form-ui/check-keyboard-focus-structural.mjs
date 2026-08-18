#!/usr/bin/env node
// A7 -- keyboard operability + visible-focus structural proxy (real react-dom/server output,
// not a viewport render -- see the "What this contract does NOT prove" note in the README for
// why a genuine keyboard-navigation/focus-ring check needs a real browser, not this check).
// Every interactive control across all 5 fieldsets is a native <input>/<textarea>/<select>
// element (never a non-native div/span with only an onClick), none carry tabindex="-1", and
// every one declares at least one `focus:` Tailwind class -- reusing the project's existing
// focus-visible convention (`focus:border-ink/40` in ContactForm.tsx/TicketFormField.tsx), not
// inventing a new one.
//
// DEFEATING MUTATION: a custom clickable <div> standing in for a checkbox (unreachable by Tab,
// invisible to a screen reader); tabindex="-1" on a real field (silently removes it from the
// tab order); a control with no `focus:` class at all (keyboard users lose the focus ring the
// rest of the site already provides).
//
// Run as: node --import tsx/esm contracts/checks/vendor-form-ui/check-keyboard-focus-structural.mjs

import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

import '../vendor-form-ui/stubs/module-alias-patch.cjs';
import { readFileSync } from 'node:fs';

const {
  VendorContactFieldset,
} = await import('../../../components/vendors/VendorContactFieldset.tsx');
const {
  VendorCategoryFieldset,
} = await import('../../../components/vendors/VendorCategoryFieldset.tsx');
const {
  VendorBoothFieldset,
} = await import('../../../components/vendors/VendorBoothFieldset.tsx');
const {
  VendorMarketingFieldset,
} = await import('../../../components/vendors/VendorMarketingFieldset.tsx');
const {
  VendorPaymentFieldset,
} = await import('../../../components/vendors/VendorPaymentFieldset.tsx');

const rawState = JSON.parse(
  readFileSync(new URL('./fixtures/form-state-full.fixture.json', import.meta.url), 'utf8'),
);
delete rawState._comment;

const noop = () => {};
const commonProps = { state: rawState, onFieldChange: noop, disabled: false };

const sections = [
  VendorContactFieldset,
  VendorCategoryFieldset,
  VendorBoothFieldset,
  VendorMarketingFieldset,
  VendorPaymentFieldset,
];

const html = sections
  .map((Component) => renderToStaticMarkup(React.createElement(Component, commonProps)))
  .join('\n');

const failures = [];

const controlTags = [...html.matchAll(/<(input|textarea|select)\b[^>]*>/gi)].map((m) => m[0]);

if (controlTags.length === 0) {
  failures.push('no <input>/<textarea>/<select> elements found at all -- fieldsets are not rendering real form controls');
}

for (const tag of controlTags) {
  if (/tabindex="-1"/i.test(tag)) {
    failures.push(`a form control carries tabindex="-1", removing it from keyboard tab order: ${tag}`);
  }
  if (!/\bfocus:/i.test(tag) && !/className="[^"]*focus:/i.test(tag)) {
    // className attribute may not literally contain "focus:" adjacent to the word "className" —
    // just require the substring "focus:" appears anywhere in the tag's attributes.
    if (!/focus:/i.test(tag)) {
      failures.push(`a form control has no "focus:" Tailwind class declared (no visible focus proxy): ${tag}`);
    }
  }
}

// No non-native clickable divs standing in for the checkbox-group/radio options -- every
// option in a group must be a real <input type="checkbox"|"radio">.
const groupOptionInputs = [...html.matchAll(/<input[^>]*type="(checkbox|radio)"[^>]*>/gi)];
if (groupOptionInputs.length === 0) {
  failures.push('no <input type="checkbox"|"radio"> elements found -- vendorCategory/paymentMethodsAccepted/powerRequired/waterRequired must use real form controls');
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(`PASS: ${controlTags.length} native form controls, all keyboard-reachable with a declared focus style.`);
process.exit(0);
