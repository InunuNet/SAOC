#!/usr/bin/env node
// A6 -- VendorRegisterStatusBanner and VendorRegisterSuccess render legibly for every real
// response shape, proven end-to-end: this check calls the REAL describeVendorRegistrationResponse()
// (same function A5 gates directly) against the same real fixture bodies, then renders the REAL
// presentational components against that live descriptor output via react-dom/server -- proving
// the wiring between the pure response logic and the UI, not just that each half works in
// isolation.
//
// DEFEATING MUTATION: a banner that renders only a generic "Something went wrong" for every
// error kind, discarding the real fieldErrors/retryAfterLabel content; a success state that
// never displays the returned `id` (the submitter has no reference number to quote if they
// need to follow up); missing role="alert"/role="status" (screen-reader users get no
// notification that the page state changed after submit).
//
// Run as: node --import tsx/esm contracts/checks/vendor-form-ui/check-status-banner-render.mjs

import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

import '../vendor-form-ui/stubs/module-alias-patch.cjs';

const { describeVendorRegistrationResponse } = await import('../../../lib/vendor-register-response.ts');
const { VendorRegisterStatusBanner } = await import(
  '../../../components/vendors/VendorRegisterStatusBanner.tsx'
);
const { VendorRegisterSuccess } = await import('../../../components/vendors/VendorRegisterSuccess.tsx');

const failures = [];

function loadFixture(name) {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
}
const stripTags = (s) => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

// --- success: VendorRegisterSuccess, not the banner. ---
{
  const { status, body } = loadFixture('api-response-success.fixture.json');
  const descriptor = describeVendorRegistrationResponse(status, body);
  const html = renderToStaticMarkup(React.createElement(VendorRegisterSuccess, { descriptor }));
  const text = stripTags(html);
  if (!text.includes(body.id)) {
    failures.push(`VendorRegisterSuccess output does not display the confirmation id "${body.id}"`);
  }
  if (!/role="status"/i.test(html)) {
    failures.push('VendorRegisterSuccess root is missing role="status" (screen readers get no announcement)');
  }
  if (text.length < 20) {
    failures.push('VendorRegisterSuccess renders suspiciously little text for a confirmation state');
  }
}

// --- validation-error, rate-limited, error: all via VendorRegisterStatusBanner. ---
const errorCases = [
  ['api-response-validation.fixture.json', 'validation-error'],
  ['api-response-ratelimit.fixture.json', 'rate-limited'],
  ['api-response-servererror.fixture.json', 'error'],
];

for (const [fixtureName, expectedKind] of errorCases) {
  const { status, body } = loadFixture(fixtureName);
  const descriptor = describeVendorRegistrationResponse(status, body);
  if (descriptor.kind !== expectedKind) {
    failures.push(`${fixtureName}: descriptor.kind expected "${expectedKind}", got "${descriptor.kind}" (A5 should already catch this -- fix that first)`);
    continue;
  }
  const html = renderToStaticMarkup(React.createElement(VendorRegisterStatusBanner, { descriptor }));
  const text = stripTags(html);

  if (!/role="alert"/i.test(html)) {
    failures.push(`${fixtureName}: banner root is missing role="alert" for kind "${expectedKind}"`);
  }

  if (expectedKind === 'validation-error') {
    for (const message of body.fieldErrors) {
      if (!text.includes(message)) {
        failures.push(`validation-error banner: missing real fieldErrors message "${message}"`);
      }
    }
  }

  if (expectedKind === 'rate-limited') {
    if (!/minute|minutes|hour|hours/i.test(text)) {
      failures.push('rate-limited banner: no legible time unit (minute/hour) in rendered text');
    }
  }

  if (expectedKind === 'error') {
    if (!text.includes(descriptor.message)) {
      failures.push(`error banner: rendered text does not include descriptor.message ("${descriptor.message}")`);
    }
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log('PASS: VendorRegisterStatusBanner and VendorRegisterSuccess render legible, real content for every response shape.');
process.exit(0);
