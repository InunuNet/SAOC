#!/usr/bin/env node
// A4 -- structural + accessibility completeness of the form's real presentational fieldset
// components, proven by real react-dom/server output (renderToStaticMarkup), not a source grep.
// For every one of the 31 fields in field-spec.golden.json: a real, labelled control exists;
// the label text matches (whitespace-normalized); the control (or its `<fieldset>`, for group
// types) carries `required`/`aria-required="true"` if and only if the golden marks it required.
//
// ID CONTRACT (this is the wiring the fieldset components must implement -- see README):
//   - single controls (text/tel/email/url/number/textarea/single checkbox):
//       id="vendor-register-<key>", referenced by a `<label htmlFor="vendor-register-<key>">`.
//   - group controls (checkbox-group/boolean-radio/select-radio):
//       outer `<fieldset id="vendor-register-<key>">` with a `<legend>` holding the field's
//       label text; each option is `<input id="vendor-register-<key>-<optionValue>">` with its
//       own `<label htmlFor="...">`; the fieldset itself carries `aria-required="true"` when
//       the field is required (native `required` is not meaningful on a `<fieldset>`).
//
// DEFEATING MUTATION: a field silently missing from the rendered fieldsets entirely; a label
// present but not connected via htmlFor/id (screen reader announces nothing for that control);
// `required` on an optional field or missing from a required one; a group's aria-required
// inverted relative to field-spec.golden.json.
//
// Run as: node --import tsx/esm contracts/checks/vendor-form-ui/check-fieldset-render-completeness.mjs

import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

import '../vendor-form-ui/stubs/module-alias-patch.cjs';

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

const golden = JSON.parse(
  readFileSync(new URL('../../golden/vendor-form-ui/field-spec.golden.json', import.meta.url), 'utf8'),
);

const rawState = JSON.parse(
  readFileSync(new URL('./fixtures/form-state-full.fixture.json', import.meta.url), 'utf8'),
);
delete rawState._comment;

const noop = () => {};
const commonProps = { state: rawState, onFieldChange: noop, disabled: false };

const sections = [
  ['contact', VendorContactFieldset],
  ['category', VendorCategoryFieldset],
  ['booth', VendorBoothFieldset],
  ['marketing', VendorMarketingFieldset],
  ['payment', VendorPaymentFieldset],
];

const html = sections
  .map(([, Component]) => renderToStaticMarkup(React.createElement(Component, commonProps)))
  .join('\n');

// renderToStaticMarkup correctly HTML-entity-encodes text content (e.g. "&" -> "&amp;"), so
// the termsAccepted golden label ("...Vendor Terms & Conditions...") can only be matched
// against rendered output after decoding entities back out -- otherwise a correct render is
// indistinguishable from a mislabelled one to this check.
const decodeEntities = (s) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'");
const stripTags = (s) => decodeEntities(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const normalize = (s) => s.replace(/\s+/g, ' ').trim();

const failures = [];
const GROUP_TYPES = new Set(['checkbox-group', 'boolean-radio', 'select-radio']);

for (const field of golden.fields) {
  const { key, label, htmlType, required } = field;
  const id = `vendor-register-${key}`;

  if (GROUP_TYPES.has(htmlType)) {
    const fieldsetRe = new RegExp(`<fieldset[^>]*id="${id}"[^>]*>([\\s\\S]*?)</fieldset>`, 'i');
    const m = html.match(fieldsetRe);
    if (!m) {
      failures.push(`"${key}": no <fieldset id="${id}"> found in rendered output`);
      continue;
    }
    const fieldsetHtml = m[0];
    const legendMatch = fieldsetHtml.match(/<legend[^>]*>([\s\S]*?)<\/legend>/i);
    if (!legendMatch || normalize(stripTags(legendMatch[1])) !== normalize(label)) {
      failures.push(
        `"${key}": <legend> text does not match golden label. Expected "${label}", got ` +
          `"${legendMatch ? normalize(stripTags(legendMatch[1])) : '(no legend)'}"`,
      );
    }
    const hasAriaRequired = /aria-required="true"/i.test(fieldsetHtml);
    if (required && !hasAriaRequired) {
      failures.push(`"${key}": required group field is missing aria-required="true" on its <fieldset>`);
    }
    if (!required && hasAriaRequired) {
      failures.push(`"${key}": optional group field must not carry aria-required="true"`);
    }
    for (const option of field.options ?? []) {
      const optId = `${id}-${option.value}`;
      if (!html.includes(`id="${optId}"`)) {
        failures.push(`"${key}": option "${option.value}" missing an input with id="${optId}"`);
      }
      if (!html.includes(`for="${optId}"`)) {
        failures.push(`"${key}": option "${option.value}" missing a <label for="${optId}">`);
      }
    }
    continue;
  }

  // Single control.
  const labelRe = new RegExp(`<label[^>]*for="${id}"[^>]*>([\\s\\S]*?)</label>`, 'i');
  const labelMatch = html.match(labelRe);
  if (!labelMatch) {
    failures.push(`"${key}": no <label for="${id}"> found in rendered output`);
    continue;
  }
  if (normalize(stripTags(labelMatch[1])) !== normalize(label)) {
    failures.push(
      `"${key}": label text does not match golden. Expected "${label}", got ` +
        `"${normalize(stripTags(labelMatch[1]))}"`,
    );
  }
  const controlRe = new RegExp(`<(input|textarea|select)[^>]*id="${id}"[^>]*>`, 'i');
  const controlMatch = html.match(controlRe);
  if (!controlMatch) {
    failures.push(`"${key}": no input/textarea/select with id="${id}" found`);
    continue;
  }
  const controlTag = controlMatch[0];
  const hasRequired = /\brequired\b/i.test(controlTag);
  if (required && !hasRequired) {
    failures.push(`"${key}": required field is missing the "required" attribute`);
  }
  if (!required && hasRequired) {
    failures.push(`"${key}": optional field must not carry the "required" attribute`);
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log('PASS: all 31 fields render as labelled controls with correct required/aria-required marking.');
process.exit(0);
