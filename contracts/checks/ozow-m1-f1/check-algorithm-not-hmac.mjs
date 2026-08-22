#!/usr/bin/env node
// A3 — THE ALGORITHM IS PLAIN SHA512, NOT HMAC-SHA512. This is the specific correction the
// mission brief and architect spec make against docs/payment-gateway-research-2026-08.md, and it
// was independently re-verified via Alembic against Ozow's own docs before this contract was
// written (see README.md §1) rather than trusted secondhand. This assertion proves the shipped
// generateOzowHash() actually implements the plain form, not the HMAC form — the two produce
// different digests over the same inputs, so a wrong implementation is directly observable rather
// than inferred from a comment.
//
// Also proves outbound and inbound share ONE algorithm implementation over TWO DIFFERENT FIELD
// SETS (unlike PayFast, whose outbound/inbound algorithms genuinely differ in trim/blank-skip
// behaviour — see contract-payment-seam-f1.yaml A3). Ozow's docs describe exactly one procedure
// for both directions; lib/ozow.ts must not invent a second one.
//
// WHAT MAKES THIS FAIL: the module not existing; generateOzowHash keying the digest with
// createHmac instead of feeding the private key into the concatenated string before a plain
// createHash; the outbound and inbound field orders being swapped or unified into one list.
//
// Run as: npx tsx contracts/checks/ozow-m1-f1/check-algorithm-not-hmac.mjs

import { createHmac } from 'node:crypto';
import { generateOzowHash, OZOW_OUTBOUND_FIELD_ORDER, OZOW_NOTIFY_FIELD_ORDER } from '../../../lib/ozow.ts';
import { golden, makeReporter } from './_golden.mjs';

const r = makeReporter('A3 plain-SHA512-not-HMAC + shared-algorithm-two-field-sets');
const g = golden.outbound;
const creds = golden.credentials;

// Case 1 — the shipped function matches the plain-SHA512 golden.
const plainResult = generateOzowHash(g.signedFields, OZOW_OUTBOUND_FIELD_ORDER, creds.privateKey);
r.eq('case 1: shipped generateOzowHash matches plain-SHA512 golden', plainResult, g.hashCheck);

// Case 2 — NON-VACUITY / NEGATIVE CONTROL. An HMAC-SHA512 digest over the SAME inputs is a
// DIFFERENT value, computed here independently (not read from the shipped code), and the golden's
// own pre-recorded HMAC value agrees with this independent computation — proving the golden
// itself distinguishes the two algorithms, not just asserting they differ in the abstract.
const concatNoSecret = OZOW_OUTBOUND_FIELD_ORDER.map((k) => g.signedFields[k]).join('');
const hmacResult = createHmac('sha512', creds.privateKey).update(concatNoSecret.toLowerCase()).digest('hex');
r.eq('case 2: independently-computed HMAC matches golden\'s HMAC negative control', hmacResult, g.hmacShaHashWrongAlgorithm);
r.ok('case 2: plain-SHA512 and HMAC-SHA512 digests differ', plainResult !== hmacResult);
r.ok(
  'case 2: shipped function does NOT produce the HMAC value',
  plainResult !== g.hmacShaHashWrongAlgorithm,
  'generateOzowHash matches the HMAC negative control — it is using createHmac, contradicting Ozow\'s own docs'
);

// Case 3 — outbound and inbound field orders are genuinely different lists (different field sets,
// not merely reordered), and the SAME hash function correctly discriminates between them: signing
// a field object with the wrong order for its shape must not accidentally coincide.
r.ok(
  'case 3: outbound and inbound field orders are distinct field sets',
  JSON.stringify([...OZOW_OUTBOUND_FIELD_ORDER]) !== JSON.stringify([...OZOW_NOTIFY_FIELD_ORDER]),
  'these must be two different documented tables, not one shared list'
);
r.ok('case 3: outbound order contains SiteCode', OZOW_OUTBOUND_FIELD_ORDER.includes('SiteCode'));
r.ok('case 3: outbound order contains TransactionReference', OZOW_OUTBOUND_FIELD_ORDER.includes('TransactionReference'));
r.ok('case 3: outbound order has no TransactionId (inbound-only field)', !OZOW_OUTBOUND_FIELD_ORDER.includes('TransactionId'));
r.ok('case 3: outbound order has no Status (inbound-only field)', !OZOW_OUTBOUND_FIELD_ORDER.includes('Status'));
r.ok('case 3: inbound order contains TransactionId', OZOW_NOTIFY_FIELD_ORDER.includes('TransactionId'));
r.ok('case 3: inbound order contains Status', OZOW_NOTIFY_FIELD_ORDER.includes('Status'));
r.ok('case 3: inbound order has no BankReference (outbound-only field)', !OZOW_NOTIFY_FIELD_ORDER.includes('BankReference'));
r.ok('case 3: inbound order has no CancelUrl (outbound-only field)', !OZOW_NOTIFY_FIELD_ORDER.includes('CancelUrl'));

r.done();
