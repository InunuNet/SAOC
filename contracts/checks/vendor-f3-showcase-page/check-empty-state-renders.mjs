#!/usr/bin/env node
// A3 — VendorEmptyState renders sane, meaningful copy for the zero-nurseries starting state
// (the mission's own framing: "zero nurseries seeded yet is the normal starting state, not
// an error" — F3 Done criterion). Real react-dom/server render, no props (this component takes
// none — it is static copy, same category as VendorIntro), checked against visible text.
//
// DEFEATING MUTATION: VendorEmptyState throwing when rendered with no props; returning null
// (which would make the zero-nursery page silently blank — indistinguishable from a broken
// page, exactly the "not an error" framing this feature exists to avoid); rendering placeholder
// text like "Loading..." or the literal words "undefined"/"[object Object]" instead of an
// actual message.

import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { VendorEmptyState } from '../../../components/vendors/VendorEmptyState.tsx';

const failures = [];
const stripTags = (html) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

let html;
try {
  html = renderToStaticMarkup(React.createElement(VendorEmptyState));
} catch (error) {
  failures.push(`VendorEmptyState threw when rendered with no props: ${error.message}`);
}

if (html !== undefined) {
  const text = stripTags(html);

  if (text.length < 20) {
    failures.push(
      `VendorEmptyState's visible text is only ${text.length} chars ("${text}") — expected a ` +
        'real message, not an empty or near-empty render',
    );
  }
  if (/\b(undefined|null|\[object Object\])\b/.test(text)) {
    failures.push(`VendorEmptyState leaks a literal placeholder value into its text: "${text}"`);
  }
  if (!/nurser/i.test(text)) {
    failures.push(
      `VendorEmptyState's text does not mention "nursery"/"nurseries" — got: "${text}" — this ` +
        'should read as specific to the vendor showcase, not a generic empty-state string',
    );
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log('PASS: VendorEmptyState renders a real, on-topic message with no props.');
process.exit(0);
