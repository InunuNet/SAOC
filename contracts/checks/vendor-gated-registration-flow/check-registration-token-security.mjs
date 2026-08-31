#!/usr/bin/env node
// vendor-gated-registration-flow M1/F3 — real, executed security proof of
// lib/vendor-registration-token.ts, mirroring contracts/checks/ticketing-f6-recovery-token/
// check-forgery-resistance.mjs's exact method (real crypto.randomBytes secrets, real forged
// tokens, no mocking of the signature check). Proves:
//   1. A token minted with the real secret verifies and round-trips applicationId.
//   2. Plausible "derive the secret from public data" forgery strategies all fail.
//   3. A genuinely expired token is refused, even with the correct secret.
//   4. DOMAIN SEPARATION: a token minted by lib/recovery-token.ts's mintRecoveryToken (the
//      ticket-order-recovery token) does NOT verify as a vendor registration token, even when
//      an attacker controls both secrets equal to each other -- proving the two modules are
//      genuinely separate token schemes, not the same function reused across trust domains.
//
// Run as: node --import tsx/esm contracts/checks/vendor-gated-registration-flow/check-registration-token-security.mjs

import { randomBytes } from 'node:crypto';
import { mintVendorRegistrationToken, verifyVendorRegistrationToken } from '../../../lib/vendor-registration-token.ts';
import { mintRecoveryToken } from '../../../lib/recovery-token.ts';

const failures = [];
const NOW = new Date('2027-02-01T00:00:00Z');
const REAL_SECRET = randomBytes(32).toString('hex');
const APPLICATION_ID = 'application-security-check';

// 1. Real round trip.
{
  const minted = mintVendorRegistrationToken({ applicationId: APPLICATION_ID, secret: REAL_SECRET, now: NOW });
  const result = verifyVendorRegistrationToken({ token: minted.token, secret: REAL_SECRET, now: NOW });
  if (!result.ok) {
    failures.push(`(control) A token minted with the REAL secret failed to verify: ${JSON.stringify(result)}.`);
  } else if (result.applicationId !== APPLICATION_ID) {
    failures.push(`(control) Verified applicationId '${result.applicationId}' did not match minted '${APPLICATION_ID}'.`);
  }
}

// 2. Forgery resistance -- same guessed-secret strategies as the recovery-token contract.
const guessedSecrets = {
  'application id as secret': APPLICATION_ID,
  'empty string': '',
  'a different real-looking random secret': randomBytes(32).toString('hex'),
};
for (const [label, guessedSecret] of Object.entries(guessedSecrets)) {
  const forged = mintVendorRegistrationToken({ applicationId: APPLICATION_ID, secret: guessedSecret, now: NOW });
  const result = verifyVendorRegistrationToken({ token: forged.token, secret: REAL_SECRET, now: NOW });
  if (result.ok) {
    failures.push(`FORGERY SUCCEEDED using strategy '${label}'.`);
  }
}

// 3. Expiry is enforced.
{
  const minted = mintVendorRegistrationToken({ applicationId: APPLICATION_ID, secret: REAL_SECRET, now: NOW, ttlMs: 1000 });
  const afterExpiry = new Date(NOW.getTime() + 1000 * 60);
  const result = verifyVendorRegistrationToken({ token: minted.token, secret: REAL_SECRET, now: afterExpiry });
  if (result.ok) {
    failures.push('An expired token verified successfully -- expiry is not enforced.');
  } else if (result.reason !== 'expired') {
    failures.push(`Expired token was refused for the wrong reason: '${result.reason}', expected 'expired'.`);
  }
}

// 4. Domain separation from lib/recovery-token.ts -- a recovery token must never double as a
// vendor registration token, even under a shared secret (the strongest-case attacker).
{
  const sharedSecret = randomBytes(32).toString('hex');
  const recoveryToken = mintRecoveryToken({ orderId: APPLICATION_ID, secret: sharedSecret, now: NOW });
  const result = verifyVendorRegistrationToken({ token: recoveryToken.token, secret: sharedSecret, now: NOW });
  if (result.ok) {
    failures.push('DOMAIN SEPARATION FAILURE: a lib/recovery-token.ts order-recovery token verified as a valid vendor registration token.');
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: vendor registration tokens round-trip correctly under the real secret, resist every ' +
    'guessed-secret forgery strategy tried, correctly refuse an expired token, and are ' +
    'cryptographically distinct from lib/recovery-token.ts order-recovery tokens even under a ' +
    'shared secret.',
);
process.exit(0);
