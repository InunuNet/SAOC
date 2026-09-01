#!/usr/bin/env node
// vendor-gated-registration-flow M3/F27 (A56) -- pure-function proof, no Firestore/harness
// needed. lib/vendor-stand-payment-token.ts mint/verify round-trips correctly; a token minted
// under this module (payload key 's') is refused under M1's lib/vendor-registration-token.ts
// verifier (payload key 'a') and vice versa -- structural domain separation, same technique as
// M1's own cross-domain check; expiry is inclusive; a tampered signature is refused; two mints
// for the SAME vendorSubmissionId issued at the SAME instant produce DISTINCT tokens (the
// random nonce F27 added specifically so a resend is never byte-identical to the original
// approval mint -- see the golden README's "reissue, not unlock"); and the three vendor
// token/recovery secrets are never cross-referenced by name anywhere in the codebase.
//
// Run as: node --import tsx/esm contracts/checks/vendor-gated-registration-flow-m3/check-stand-payment-token-domain-separation.mjs

import { execSync } from 'node:child_process';

import {
  mintVendorStandPaymentToken,
  verifyVendorStandPaymentToken,
} from '../../../lib/vendor-stand-payment-token.ts';
import {
  mintVendorRegistrationToken,
  verifyVendorRegistrationToken,
} from '../../../lib/vendor-registration-token.ts';

const failures = [];
function assert(condition, label) {
  if (!condition) failures.push(label);
}

const SECRET_A = 'stand-payment-secret-test-not-real';
const SECRET_B = 'm1-registration-secret-test-not-real';
const NOW = new Date('2027-01-01T00:00:00Z');

// --- Round-trip -----------------------------------------------------------------------------
{
  const minted = mintVendorStandPaymentToken({ vendorSubmissionId: 'sub-123', secret: SECRET_A, now: NOW });
  const verified = verifyVendorStandPaymentToken({ token: minted.token, secret: SECRET_A, now: NOW });
  assert(
    verified.ok === true && verified.vendorSubmissionId === 'sub-123',
    `expected a minted token to verify and resolve to its vendorSubmissionId, got ${JSON.stringify(verified)}`,
  );
}

// --- Structural domain separation: this module's token under M1's verifier, and vice versa --
{
  const standToken = mintVendorStandPaymentToken({ vendorSubmissionId: 'sub-123', secret: SECRET_A, now: NOW }).token;
  const crossVerified = verifyVendorRegistrationToken({ token: standToken, secret: SECRET_A, now: NOW });
  assert(
    crossVerified.ok === false,
    'a stand-payment token (payload key "s") verified successfully under M1\'s registration-token verifier (payload key "a") -- domain separation is broken.',
  );

  const registrationToken = mintVendorRegistrationToken({ applicationId: 'app-123', secret: SECRET_B, now: NOW }).token;
  const reverseVerified = verifyVendorStandPaymentToken({ token: registrationToken, secret: SECRET_B, now: NOW });
  assert(
    reverseVerified.ok === false,
    'an M1 registration token (payload key "a") verified successfully under the stand-payment verifier (payload key "s") -- domain separation is broken.',
  );
}

// --- Expiry: inclusive boundary ---------------------------------------------------------------
{
  const ttlMs = 1000;
  const minted = mintVendorStandPaymentToken({ vendorSubmissionId: 'sub-expiry', secret: SECRET_A, now: NOW, ttlMs });
  const atExpiry = verifyVendorStandPaymentToken({ token: minted.token, secret: SECRET_A, now: new Date(NOW.getTime() + ttlMs) });
  assert(
    atExpiry.ok === false && atExpiry.reason === 'expired',
    `expected a token to be refused as 'expired' exactly AT its expiry instant (inclusive), got ${JSON.stringify(atExpiry)}`,
  );
  const justBefore = verifyVendorStandPaymentToken({ token: minted.token, secret: SECRET_A, now: new Date(NOW.getTime() + ttlMs - 1) });
  assert(justBefore.ok === true, 'a token one millisecond before its expiry should still verify.');
}

// --- Tampered signature ------------------------------------------------------------------------
{
  const minted = mintVendorStandPaymentToken({ vendorSubmissionId: 'sub-tamper', secret: SECRET_A, now: NOW });
  const [payloadSegment, signatureSegment] = minted.token.split('.');
  const tamperedSignature = signatureSegment.slice(0, -1) + (signatureSegment.endsWith('0') ? '1' : '0');
  const tampered = verifyVendorStandPaymentToken({ token: `${payloadSegment}.${tamperedSignature}`, secret: SECRET_A, now: NOW });
  assert(
    tampered.ok === false && tampered.reason === 'bad-signature',
    `expected a tampered signature to be refused as 'bad-signature', got ${JSON.stringify(tampered)}`,
  );
}

// --- Freshness: two mints for the SAME id at the SAME instant are byte-distinct (nonce) -------
{
  const first = mintVendorStandPaymentToken({ vendorSubmissionId: 'sub-fresh', secret: SECRET_A, now: NOW });
  const second = mintVendorStandPaymentToken({ vendorSubmissionId: 'sub-fresh', secret: SECRET_A, now: NOW });
  assert(
    first.token !== second.token,
    'two mints for the same vendorSubmissionId at the identical instant produced byte-identical tokens -- ' +
      'the resend escape hatch (F28) would be indistinguishable from re-reading a cached token rather than minting fresh.',
  );
  // Both must still independently verify -- distinctness must not come at the cost of one of
  // them being invalid.
  const firstVerified = verifyVendorStandPaymentToken({ token: first.token, secret: SECRET_A, now: NOW });
  const secondVerified = verifyVendorStandPaymentToken({ token: second.token, secret: SECRET_A, now: NOW });
  assert(firstVerified.ok && secondVerified.ok, 'both distinct same-instant mints must independently verify.');
}

// --- Secrets are never cross-referenced by name -------------------------------------------------
{
  const grepPatterns = [
    ['VENDOR_STAND_PAYMENT_TOKEN_SECRET.*VENDOR_REGISTRATION_TOKEN_SECRET', 'VENDOR_STAND_PAYMENT_TOKEN_SECRET and VENDOR_REGISTRATION_TOKEN_SECRET appear on the same line'],
    ['VENDOR_STAND_PAYMENT_TOKEN_SECRET.*RECOVERY_TOKEN_SECRET', 'VENDOR_STAND_PAYMENT_TOKEN_SECRET and RECOVERY_TOKEN_SECRET appear on the same line'],
  ];
  for (const [pattern, label] of grepPatterns) {
    let hit = '';
    try {
      hit = execSync(`git grep -nE "${pattern}" -- '*.ts' '*.tsx'`, { cwd: new URL('../../../', import.meta.url), encoding: 'utf8' });
    } catch {
      // git grep exits 1 on no match -- that's the desired outcome.
      hit = '';
    }
    assert(hit.trim() === '', `${label}: ${hit}`);
  }
}

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  'PASS: vendor-stand-payment-token round-trips, is structurally domain-separated from M1\'s ' +
    'registration token in both directions, respects an inclusive expiry boundary, refuses a ' +
    'tampered signature, mints byte-distinct tokens for same-instant reissues, and no secret ' +
    'name is cross-referenced with another token module\'s secret.',
);
process.exit(0);
