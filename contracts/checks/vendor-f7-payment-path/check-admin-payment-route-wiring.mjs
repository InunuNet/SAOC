#!/usr/bin/env node
// F7 (vendor-registration) -- A10: THE F8-LESSON assertion, applied to the new admin payment
// route. Same technique as F6's check-route-wiring.mjs and
// contracts/checks/ticketing-show-window-lookup/check-comp-route-wiring.mjs: a source-level
// discriminator, self-tested against a frozen KNOWN-UNWIRED fixture (must reject) and this
// contract's own architect-authored WIRED golden (must accept), before it is ever trusted
// against the real repository file.
//
// Requires: imports hasCapability from '@/lib/admin-auth', awaits a real
// resolveShowWindowLookup(NATIONAL_SHOW_ID, now) call assigned to lookupShowWindow, and passes
// hasCapability(session.decodedToken, NATIONAL_SHOW_ID, 'review-vendor-applications', { now,
// lookupShowWindow }) verbatim -- the SAME capability F6 already gates its review UI with, not
// a new one. Additionally requires decideVendorPaymentUpdate( is imported from
// '@/lib/vendor-payment' and called (not reimplemented inline), and that the Firestore write
// is ref.update(decision.patch), never ref.set(...).
//
// DEFEATING MUTATION: deleting the hasCapability call entirely; swapping
// 'review-vendor-applications' for a more widely held capability; omitting the `opts` argument
// or passing an inline `() => null` lookup; reimplementing the payment decision inline instead
// of calling decideVendorPaymentUpdate(); or changing `ref.update(` to `ref.set(`.
//
// Run as: node --import tsx/esm contracts/checks/vendor-f7-payment-path/check-admin-payment-route-wiring.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const failures = [];

function isCapabilityGated(source) {
  const importsHasCapability =
    /import\s*\{[^}]*\bhasCapability\b[^}]*\}\s*from\s*['"]@\/lib\/admin-auth['"]/.test(source);

  const importsResolver =
    /import\s*\{[^}]*\bresolveShowWindowLookup\b[^}]*\}\s*from\s*['"]@\/lib\/show-window-lookup['"]/.test(
      source,
    );

  const awaitsRealCall =
    /const\s+lookupShowWindow\s*=\s*await\s+resolveShowWindowLookup\s*\(\s*NATIONAL_SHOW_ID\s*,\s*now\s*\)/.test(
      source,
    );

  const callsHasCapability =
    /hasCapability\(\s*session\.decodedToken\s*,\s*NATIONAL_SHOW_ID\s*,\s*'review-vendor-applications'\s*,\s*\{\s*now\s*,\s*lookupShowWindow\s*\}\s*\)/.test(
      source,
    );

  return importsHasCapability && importsResolver && awaitsRealCall && callsHasCapability;
}

function isAdditivePaymentWiring(source) {
  const importsDecision =
    /import\s*\{[^}]*\bdecideVendorPaymentUpdate\b[^}]*\}\s*from\s*['"]@\/lib\/vendor-payment['"]/.test(
      source,
    );
  const callsDecision = /decideVendorPaymentUpdate\(\s*\{/.test(source);
  const updatesNotSets = /ref\.update\(\s*decision\.patch\s*\)/.test(source) && !/ref\.set\(/.test(source);

  return importsDecision && callsDecision && updatesNotSets;
}

const predicate = (source) => isCapabilityGated(source) && isAdditivePaymentWiring(source);

const unwiredFixturePath = path.join(__dirname, 'fixtures/vendors-payment-route-unwired.fixture.ts.txt');
const wiredGoldenPath = path.join(
  REPO_ROOT,
  'contracts/golden/vendor-f7-payment-path/vendors-payment-route-wired.expected.ts.txt',
);
const realPath = path.join(REPO_ROOT, 'app/api/admin/vendors/[id]/payment/route.ts');

const unwired = readFileSync(unwiredFixturePath, 'utf8');
const wired = readFileSync(wiredGoldenPath, 'utf8');

if (predicate(unwired)) {
  failures.push(
    'SELF-TEST FAILED -- the discriminator reports the KNOWN-UNWIRED fixture as wired. ' +
      'The discriminator is broken and cannot be trusted against the real file.',
  );
} else if (!predicate(wired)) {
  failures.push(
    "SELF-TEST FAILED -- the discriminator reports this contract's own architect-authored " +
      'WIRED golden as unwired. The discriminator is broken and cannot be trusted against the real file.',
  );
} else {
  let realSource;
  try {
    realSource = readFileSync(realPath, 'utf8');
  } catch (error) {
    failures.push(`Could not read ${realPath}: ${error.message}`);
  }
  if (realSource !== undefined && !predicate(realSource)) {
    failures.push(
      `${realPath} does not pass the capability-gate + additive-payment-wiring discriminator. ` +
        `Compare against ${wiredGoldenPath} for the exact expected wiring.`,
    );
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: app/api/admin/vendors/[id]/payment/route.ts imports hasCapability, awaits a real ' +
    "resolveShowWindowLookup() call, and passes the result into hasCapability(..., " +
    "'review-vendor-applications', { now, lookupShowWindow }) verbatim; it also imports and " +
    'calls the real decideVendorPaymentUpdate() (never reimplemented inline) and applies its ' +
    'patch via ref.update(), never ref.set(). The discriminator passed its self-test (rejects ' +
    'the known-unwired fixture, accepts the architect-authored wired golden) before checking ' +
    'the real file.',
);
process.exit(0);
