#!/usr/bin/env node
// F5 (vendor-registration) — design constraint 5, POPIA-relevant: no PII or credential value in
// logs. A console spy captures every console.* call across (a) a deps.write rejection, (b) a
// deps.sendConfirmationEmail rejection, and (c) a 429 rate-limit refusal. None of the captured
// log arguments, stringified, may contain the fixture's businessName, contactEmail,
// contactPersonName, or contactCellPhone values — only field names, generic messages, or error
// type information are permitted. Separately, lib/vendor-registration-confirmation.ts's module
// source is checked to contain zero `console.` call sites at all — it is the only place
// contactEmail is held outside the Firestore document itself.
//
// Defeating mutation: logging the full built VendorSubmission object (e.g.
// `console.error('write failed', built)`) on the write-failure path — the PII-content
// assertion on capture (a) would then fail.
//
// Run as: npx tsx contracts/checks/vendor-f5-register-route/check-no-pii-in-logs.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { handleVendorRegistration } from '../../../lib/vendor-registration-handler.ts';
import { VENDOR_REGISTER_RATE_LIMIT_MAX_ATTEMPTS } from '../../../lib/vendor-registration-rate-limit.ts';

const failures = [];
const NOW = new Date('2027-01-05T12:00:00Z');

const VALID_PAYLOAD = {
  businessName: 'Confidential Orchid Growers Pty Ltd',
  contactPersonName: 'Priya Naidoo',
  contactCellPhone: '+27831239876',
  contactEmail: 'priya.naidoo@confidential-orchids.example',
  productDescription: 'Vanda and Phalaenopsis hybrids',
  vendorCategory: ['plant-sales'],
  boothCount: 1,
  powerRequired: true,
  termsAccepted: true,
};

const PII_VALUES = [
  VALID_PAYLOAD.businessName,
  VALID_PAYLOAD.contactEmail,
  VALID_PAYLOAD.contactPersonName,
  VALID_PAYLOAD.contactCellPhone,
];

function stringifyArg(arg) {
  if (typeof arg === 'string') return arg;
  try {
    return JSON.stringify(arg, Object.getOwnPropertyNames(arg instanceof Error ? arg : arg ?? {}));
  } catch {
    return String(arg);
  }
}

function withConsoleSpy(fn) {
  const captured = [];
  const originals = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug,
  };
  for (const level of Object.keys(originals)) {
    console[level] = (...args) => {
      captured.push(args.map(stringifyArg).join(' '));
    };
  }
  return fn()
    .then((result) => ({ result, captured }))
    .finally(() => {
      for (const level of Object.keys(originals)) {
        console[level] = originals[level];
      }
    });
}

function assertNoPii(label, captured) {
  const joined = captured.join('\n');
  for (const value of PII_VALUES) {
    if (joined.includes(value)) {
      failures.push(
        `${label}: a captured console call contains the fixture PII value "${value}" -- ` +
          `full captured output: ${JSON.stringify(captured)}.`,
      );
    }
  }
}

// (a) deps.write rejects.
{
  const { captured } = await withConsoleSpy(() =>
    handleVendorRegistration(VALID_PAYLOAD, {
      now: NOW,
      rateLimitKey: 'vendor-register-ip:203.0.113.5',
      getPriorAttempts: () => [],
      recordAttempt: () => {},
      write: async () => {
        throw new Error('firestore write failed (fixture)');
      },
      sendConfirmationEmail: async () => {},
      onEmailError: () => {},
    }),
  );
  assertNoPii('(a) deps.write rejection', captured);
}

// (b) deps.sendConfirmationEmail rejects.
{
  const { captured } = await withConsoleSpy(() =>
    handleVendorRegistration(VALID_PAYLOAD, {
      now: NOW,
      rateLimitKey: 'vendor-register-ip:203.0.113.6',
      getPriorAttempts: () => [],
      recordAttempt: () => {},
      write: async () => ({ id: 'write-id-b' }),
      sendConfirmationEmail: async () => {
        throw new Error('resend delivery failed (fixture)');
      },
      onEmailError: (error) => {
        // Realistic caller behaviour: log the failure, but never the payload.
        console.error('confirmation email failed', error instanceof Error ? error.message : error);
      },
    }),
  );
  assertNoPii('(b) deps.sendConfirmationEmail rejection', captured);
}

// (c) 429 rate-limit refusal.
{
  const rateLimitedKey = 'vendor-register-ip:203.0.113.7';
  const priorAttempts = Array.from({ length: VENDOR_REGISTER_RATE_LIMIT_MAX_ATTEMPTS }, (_, i) => ({
    key: rateLimitedKey,
    at: new Date(NOW.getTime() - (i + 1) * 60 * 1000),
  }));
  const { captured } = await withConsoleSpy(() =>
    handleVendorRegistration(VALID_PAYLOAD, {
      now: NOW,
      rateLimitKey: rateLimitedKey,
      getPriorAttempts: () => priorAttempts,
      recordAttempt: () => {},
      write: async () => ({ id: 'unexpected-write-c' }),
      sendConfirmationEmail: async () => {},
      onEmailError: () => {},
    }),
  );
  assertNoPii('(c) 429 rate-limit refusal', captured);
}

// (d) Static source check: lib/vendor-registration-confirmation.ts must contain zero
// `console.` call sites anywhere in its body.
{
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const sourcePath = join(__dirname, '../../../lib/vendor-registration-confirmation.ts');
  const source = readFileSync(sourcePath, 'utf8');
  if (/console\s*\./.test(source)) {
    failures.push(
      '(d) lib/vendor-registration-confirmation.ts contains a `console.` call site -- ' +
        'this module holds contactEmail/businessName outside the Firestore document and must ' +
        'never log anything.',
    );
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: no captured console.* call across a write rejection, an email rejection, or a 429 ' +
    'refusal contains the fixture\'s businessName/contactEmail/contactPersonName/contactCellPhone ' +
    'values, and lib/vendor-registration-confirmation.ts contains zero console.* call sites.',
);
process.exit(0);
