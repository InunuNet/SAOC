#!/usr/bin/env node
// A2 — INBOUND NOTIFICATION VERIFICATION + TAMPER SUITE. Ozow's notify/redirect response carries
// the SAME hash mechanism in reverse (README §1): SiteCode, TransactionId, TransactionReference,
// Amount, Status, Optional1-5, CurrencyCode, IsTest, StatusMessage, private key appended,
// lowercased, SHA512'd — posted back as the field named 'Hash' (NOT 'HashCheck' — that name is
// only used on the outbound side; a verifier that looks for 'HashCheck' on an inbound POST would
// silently find nothing and must fail closed, case 6).
//
// WHAT MAKES THIS FAIL: the module not existing; a tampered field (amount, status) still
// verifying because the digest wasn't actually recomputed; a missing/empty Hash field verifying
// anyway; a wrong-secret digest accepted; posted field order not preserved into `raw`; the
// outbound field order reused for inbound verification (there is only one Ozow algorithm, but the
// FIELD SET differs — TransactionId and Status exist only inbound, BankReference/CancelUrl/etc.
// only outbound; reusing the wrong order/field-set here is the Ozow-specific analogue of the
// PayFast ticketing-F10 defect this project has hit before).
//
// Run as: npx tsx contracts/checks/ozow-m1-f1/check-inbound-verify.mjs

import { createOzowProvider } from '../../../lib/payments/ozow.ts';
import { golden, makeReporter, fakeNotifyRequest } from './_golden.mjs';

const r = makeReporter('A2 inbound verify + tamper suite');
const g = golden.inbound;
const creds = golden.credentials;

const provider = createOzowProvider({
  env: { OZOW_SANDBOX_SITE_CODE: creds.siteCode, OZOW_SANDBOX_PRIVATE_KEY: creds.privateKey },
});

// Case 1 — POSITIVE CONTROL. The genuine Complete notification verifies.
const completeReq = fakeNotifyRequest({ ...g.complete.fields, Hash: g.complete.hashCheck });
const completeResult = await provider.verifyNotification(completeReq);
r.ok('case 1: genuine Complete notification verifies', completeResult.verified === true, JSON.stringify(completeResult));
if (completeResult.verified) {
  r.eq('case 1: reference', completeResult.notification.reference, g.complete.fields.TransactionReference);
  r.eq('case 1: rawStatus', completeResult.notification.rawStatus, 'Complete');
  r.eq('case 1: gatewayPaymentId', completeResult.notification.gatewayPaymentId, g.complete.fields.TransactionId);
  r.eq('case 1: grossAmount', completeResult.notification.grossAmount, g.complete.fields.Amount);
  r.eq('case 1: grossAmountCents', completeResult.notification.grossAmountCents, 25000);
}

// Case 2 — Cancelled and Error notifications also verify (verification is about authenticity,
// never about the outcome being "good news" — mapStatus, not verifyNotification, decides meaning).
const cancelledResult = await provider.verifyNotification(
  fakeNotifyRequest({ ...g.cancelled.fields, Hash: g.cancelled.hashCheck })
);
r.ok('case 2: genuine Cancelled notification verifies', cancelledResult.verified === true, JSON.stringify(cancelledResult));
const errorResult = await provider.verifyNotification(fakeNotifyRequest({ ...g.error.fields, Hash: g.error.hashCheck }));
r.ok('case 2: genuine Error notification verifies', errorResult.verified === true, JSON.stringify(errorResult));

// Case 3 — TAMPERED AMOUNT with the ORIGINAL (now-stale) hash must be rejected. This is the
// assertion that decides whether someone can inflate/deflate a settled amount post-hoc.
const tamperedResult = await provider.verifyNotification(
  fakeNotifyRequest({ ...g.tamperedAmount.fields, Hash: g.tamperedAmount.hashCheck })
);
r.ok('case 3: tampered amount rejected', tamperedResult.verified === false, JSON.stringify(tamperedResult));
if (tamperedResult.verified === false) r.eq('case 3: reason', tamperedResult.reason, 'signature-mismatch');

// Case 4 — REVERSED FIELD ORDER REPLAY. An attacker who knows the algorithm but guesses the wrong
// field order produces a real SHA512 digest that must still be rejected against the correct
// (posted-order) fields.
const reversedResult = await provider.verifyNotification(
  fakeNotifyRequest({ ...g.complete.fields, Hash: g.reversedFieldOrderHash })
);
r.ok('case 4: reversed-field-order digest rejected', reversedResult.verified === false, JSON.stringify(reversedResult));

// Case 5 — WRONG SECRET. A digest computed with a different private key must be rejected even
// though the fields are genuine.
const wrongSecretResult = await provider.verifyNotification(
  fakeNotifyRequest({ ...g.complete.fields, Hash: g.wrongSecretHash })
);
r.ok('case 5: wrong-secret digest rejected', wrongSecretResult.verified === false, JSON.stringify(wrongSecretResult));

// Case 6 — MISSING / EMPTY Hash field fails closed, before any digest comparison, never treated
// as "no signature required".
const { Hash: _drop, ...noHashFields } = { ...g.complete.fields, Hash: g.complete.hashCheck };
const missingHashResult = await provider.verifyNotification(fakeNotifyRequest(noHashFields));
r.ok('case 6: missing Hash field rejected', missingHashResult.verified === false, JSON.stringify(missingHashResult));
if (missingHashResult.verified === false) r.eq('case 6: reason', missingHashResult.reason, 'missing-signature');

const emptyHashResult = await provider.verifyNotification(fakeNotifyRequest({ ...g.complete.fields, Hash: '' }));
r.ok('case 6: empty Hash field rejected', emptyHashResult.verified === false, JSON.stringify(emptyHashResult));

// Case 7 — FAIL-CLOSED ON MISSING PRIVATE KEY. Without OZOW_SANDBOX_PRIVATE_KEY configured, even
// a genuinely correct notification must refuse — never compute a digest against `undefined`.
const unconfiguredProvider = createOzowProvider({ env: { OZOW_SANDBOX_SITE_CODE: creds.siteCode } });
const unconfiguredResult = await unconfiguredProvider.verifyNotification(
  fakeNotifyRequest({ ...g.complete.fields, Hash: g.complete.hashCheck })
);
r.ok('case 7: missing private key fails closed', unconfiguredResult.verified === false, JSON.stringify(unconfiguredResult));
if (unconfiguredResult.verified === false) r.eq('case 7: reason', unconfiguredResult.reason, 'not-configured');

r.done();
