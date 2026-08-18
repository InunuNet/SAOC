#!/usr/bin/env node
// A5 -- lib/vendor-register-response.ts's describeVendorRegistrationResponse(status, body) maps
// each of the FOUR real response shapes handleVendorRegistration() can return (see
// contracts/contract-vendor-f5-register-route.yaml's VendorRegistrationHandlerResult) into a
// discriminated-union descriptor the UI renders. Fed real fixture bodies (the 400 fixture's
// fieldErrors were captured verbatim from a live call to the real validateVendorSubmissionInput()
// -- see fixtures/api-response-validation.fixture.json's _comment).
//
// DEFEATING MUTATION: collapsing 429 and 500 into the same generic "error" kind (a rate-limited
// submitter then sees no indication they should wait, and may hammer retry); dropping
// fieldErrors from the validation-error descriptor (submitter sees "something went wrong" with
// no indication which of the 9 required fields was the problem); a retryAfterLabel that never
// mentions a time unit (a raw millisecond number is not legible copy).
//
// Run as: npx tsx contracts/checks/vendor-form-ui/check-response-descriptor.mjs

import { readFileSync } from 'node:fs';

import {
  describeVendorRegistrationResponse,
  formatRetryAfter,
} from '../../../lib/vendor-register-response.ts';

const failures = [];

function loadFixture(name) {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
}

// --- 201 success ---
{
  const { status, body } = loadFixture('api-response-success.fixture.json');
  const d = describeVendorRegistrationResponse(status, body);
  if (d.kind !== 'success') failures.push(`201 fixture: expected kind "success", got "${d.kind}"`);
  if (d.id !== body.id) failures.push(`201 fixture: descriptor.id (${d.id}) !== response body.id (${body.id})`);
  if (typeof d.message !== 'string' || d.message.trim().length === 0) {
    failures.push('201 fixture: descriptor.message must be a non-empty string');
  }
}

// --- 400 validation error, real fieldErrors ---
{
  const { status, body } = loadFixture('api-response-validation.fixture.json');
  const d = describeVendorRegistrationResponse(status, body);
  if (d.kind !== 'validation-error') {
    failures.push(`400 fixture: expected kind "validation-error", got "${d.kind}"`);
  }
  if (JSON.stringify(d.fieldErrors) !== JSON.stringify(body.fieldErrors)) {
    failures.push(
      `400 fixture: descriptor.fieldErrors must be the REAL fieldErrors array pass-through, ` +
        `not reformatted/dropped. Expected ${JSON.stringify(body.fieldErrors)}, got ` +
        `${JSON.stringify(d.fieldErrors)}`,
    );
  }
}

// --- 429 rate-limited ---
{
  const { status, body } = loadFixture('api-response-ratelimit.fixture.json');
  const d = describeVendorRegistrationResponse(status, body);
  if (d.kind !== 'rate-limited') failures.push(`429 fixture: expected kind "rate-limited", got "${d.kind}"`);
  if (d.retryAfterMs !== body.retryAfterMs) {
    failures.push(`429 fixture: descriptor.retryAfterMs (${d.retryAfterMs}) !== body.retryAfterMs (${body.retryAfterMs})`);
  }
  if (typeof d.retryAfterLabel !== 'string' || !/\d/.test(d.retryAfterLabel)) {
    failures.push('429 fixture: descriptor.retryAfterLabel must be a string containing a number');
  }
  if (!/minute|minutes|hour|hours/i.test(d.retryAfterLabel)) {
    failures.push(
      `429 fixture: descriptor.retryAfterLabel ("${d.retryAfterLabel}") must name a legible ` +
        `time unit (minute/hour), not a raw millisecond count`,
    );
  }
}

// --- 500 / generic server error ---
{
  const { status, body } = loadFixture('api-response-servererror.fixture.json');
  const d = describeVendorRegistrationResponse(status, body);
  if (d.kind !== 'error') failures.push(`500 fixture: expected kind "error", got "${d.kind}"`);
  if (typeof d.message !== 'string' || d.message.trim().length === 0) {
    failures.push('500 fixture: descriptor.message must be a non-empty string');
  }
}

// --- Network failure (fetch threw, no status/body at all -- status 0 by this contract's
// convention, matching how TicketPurchaseForm's own catch block already treats a thrown fetch). ---
{
  const d = describeVendorRegistrationResponse(0, undefined);
  if (d.kind !== 'error') failures.push(`network-failure case: expected kind "error", got "${d.kind}"`);
}

// --- formatRetryAfter is a real, independently-callable pure function (not inlined only inside
// describeVendorRegistrationResponse), producing a legible label for a range of durations. ---
for (const ms of [60_000, 3_600_000, 3_421_000]) {
  const label = formatRetryAfter(ms);
  if (typeof label !== 'string' || !/\d/.test(label) || !/minute|minutes|hour|hours/i.test(label)) {
    failures.push(`formatRetryAfter(${ms}) did not produce a legible time label, got: ${JSON.stringify(label)}`);
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log('PASS: describeVendorRegistrationResponse() correctly discriminates all real response shapes.');
process.exit(0);
