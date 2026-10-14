#!/usr/bin/env node
// Ozow documents BankReference as String(20), a hard cap; its sandbox silently redirects to
// pay.ozow.com/request-error on an over-length value. Vendor stand references are 42 chars
// (VSO-<20-char id>::<16-hex attempt>), so the outbound BankReference must be derived, while
// TransactionReference keeps the full value (settlement matches on it).
//
// WHAT MAKES THIS FAIL: a VSO reference passed through as BankReference unchanged (>20 chars,
// contains ':'); ticket-reference behaviour changed; the HashCheck computed over a different
// BankReference than the one sent; TransactionReference shortened.
//
// Run as: npx tsx contracts/checks/ozow-vso-bankref/check-ozow-vso-bankref.mjs

import { buildOzowConcatString, generateOzowHash, OZOW_OUTBOUND_FIELD_ORDER } from '../../../lib/ozow.ts';
import { createOzowProvider } from '../../../lib/payments/ozow.ts';
import { BOOKING_REF_PREFIX } from '../../../lib/booking-ref.ts';
import { buildVendorStandOrderReference } from '../../../lib/vendor-stand-orders.ts';
import { makeReporter } from '../ozow-m1-f1/_golden.mjs';

const r = makeReporter('ozow VSO BankReference <= 20');
const CAP = 20;
const creds = { siteCode: 'TEST-SITE', privateKey: 'test-private-key' };
const provider = createOzowProvider({
  env: { OZOW_SANDBOX_SITE_CODE: creds.siteCode, OZOW_SANDBOX_PRIVATE_KEY: creds.privateKey },
});
const base = {
  amountFormatted: '250.00',
  cancelUrl: 'https://example.test/cancel',
  returnUrl: 'https://example.test/return',
  notifyUrl: 'https://example.test/notify',
};

async function fieldsFor(reference) {
  try {
    const result = await provider.initiate({ ...base, reference });
    return result.ok ? result.fields : null;
  } catch (err) {
    return { threw: String(err) };
  }
}

// Case 1 — real 42-char VSO reference.
const submissionId = 'aB3dE5gH7jK9mN1pQ3sT';
const attemptId = '0123456789abcdef';
const vso = buildVendorStandOrderReference(submissionId, attemptId);
r.eq('case 1: fixture reference is 42 chars', vso.length, 42);
const vsoFields = await fieldsFor(vso);
r.ok('case 1: initiate succeeds', vsoFields && !vsoFields.threw, JSON.stringify(vsoFields));
if (vsoFields && !vsoFields.threw) {
  const bank = vsoFields.BankReference;
  r.ok(`case 1: BankReference <= ${CAP} chars`, bank.length <= CAP, `got ${bank.length}: ${bank}`);
  r.ok('case 1: BankReference has no ":"', !bank.includes(':'), bank);
  r.eq('case 1: BankReference is VSO- + attempt id', bank, `VSO-${attemptId}`);
  r.eq('case 1: TransactionReference keeps the full reference', vsoFields.TransactionReference, vso);

  // Case 3 — the hash is computed over the SAME derived BankReference that is sent.
  const { HashCheck, ...signed } = vsoFields;
  const expected = generateOzowHash(signed, OZOW_OUTBOUND_FIELD_ORDER, creds.privateKey);
  r.eq('case 3: HashCheck signs the sent (derived) BankReference', HashCheck, expected);
  const concat = buildOzowConcatString(signed, OZOW_OUTBOUND_FIELD_ORDER);
  r.ok('case 3: signed string contains the derived BankReference', concat.includes(bank));
}

// Shorter attempt id is used whole.
const shortFields = await fieldsFor(buildVendorStandOrderReference(submissionId, 'abc'));
r.eq('case 1: short attemptId used whole', shortFields?.BankReference, 'VSO-abc');

// Case 2 — ticket references unchanged: prefix stripped, random segment sent.
const ticket = `${BOOKING_REF_PREFIX}ABCDEFGHJKLM`;
const ticketFields = await fieldsFor(ticket);
r.eq('case 2: ticket BankReference is the random segment', ticketFields?.BankReference, 'ABCDEFGHJKLM');
r.eq('case 2: ticket TransactionReference is full', ticketFields?.TransactionReference, ticket);
const plain = await fieldsFor('SHORT-REF-1');
r.eq('case 2: short unknown reference passes through', plain?.BankReference, 'SHORT-REF-1');

// An unknown over-length shape must not be sent over-length.
const longUnknown = await fieldsFor('X'.repeat(30));
r.ok('case 4: unknown over-length reference throws, never sent', !!longUnknown?.threw, JSON.stringify(longUnknown));

r.done();
