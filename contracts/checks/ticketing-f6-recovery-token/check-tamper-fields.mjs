#!/usr/bin/env node
// F6 (ticketing-foundation) — design constraint 4: tamper on every field. Flipping the orderId,
// the expiry, or a single byte of the signature must all be refused. A token whose payload
// changed but whose signature was not recomputed must never verify. Each mutation below starts
// from ONE real, valid, minted token and decodes/re-encodes only the targeted field — the
// signature segment is left untouched in the orderId/expiry mutations specifically to prove the
// verification catches a payload change the attacker didn't (couldn't, without the secret) also
// re-sign.
//
// This test assumes the token format `${base64url(JSON.stringify({o, e}))}.${signatureHex}` —
// the format specified in the contract's feature description. If the implementation's payload
// encoding differs, this check's payload-decode step will itself fail loudly (a malformed
// parse), which is a legitimate contract mismatch to surface, not a silent false pass.
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f6-recovery-token/check-tamper-fields.mjs

import { randomBytes } from 'node:crypto';
import { mintRecoveryToken, verifyRecoveryToken } from '../../../lib/recovery-token.ts';

const failures = [];
const NOW = new Date('2027-03-01T00:00:00Z');
const SECRET = randomBytes(32).toString('hex');

const minted = mintRecoveryToken({ orderId: 'order-tamper-1', secret: SECRET, now: NOW });
const [payloadSegment, signatureSegment] = minted.token.split('.');

if (!payloadSegment || !signatureSegment) {
  console.error(`FAIL: (setup) Minted token '${minted.token}' does not have the expected '<payload>.<signature>' shape.`);
  process.exit(1);
}

// Positive control: the untampered token verifies. If this fails, every mutant below is
// meaningless (verification would already be broken with no tampering at all).
{
  const control = verifyRecoveryToken({ token: minted.token, secret: SECRET, now: NOW });
  if (!control.ok) {
    failures.push(`(control) The untampered, freshly-minted token failed to verify: ${JSON.stringify(control)}.`);
  }
}

let decodedPayload;
try {
  decodedPayload = JSON.parse(Buffer.from(payloadSegment, 'base64url').toString('utf8'));
} catch (err) {
  console.error(`FAIL: (setup) Could not decode/parse the token's payload segment as base64url JSON: ${err}. If lib/recovery-token.ts uses a different payload encoding, this check needs updating to match — see the header comment.`);
  process.exit(1);
}

function reencode(payload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

// (1) Flip the orderId in the decoded payload, re-encode, keep the ORIGINAL signature.
{
  const tamperedPayload = { ...decodedPayload, o: `${decodedPayload.o}-TAMPERED` };
  const tamperedToken = `${reencode(tamperedPayload)}.${signatureSegment}`;
  const result = verifyRecoveryToken({ token: tamperedToken, secret: SECRET, now: NOW });
  if (result.ok) {
    failures.push('(1) A token with a tampered orderId (original signature reused) still verified successfully.');
  } else if (result.reason !== 'bad-signature') {
    failures.push(`(1) A token with a tampered orderId was refused with reason '${result.reason}', expected 'bad-signature'.`);
  }
}

// (2) Flip the expiry in the decoded payload (push it far into the future — the interesting
// attack is an attacker trying to EXTEND their own access), re-encode, keep the ORIGINAL
// signature.
{
  const tamperedPayload = { ...decodedPayload, e: decodedPayload.e + 1000 * 60 * 60 * 24 * 3650 };
  const tamperedToken = `${reencode(tamperedPayload)}.${signatureSegment}`;
  const result = verifyRecoveryToken({ token: tamperedToken, secret: SECRET, now: NOW });
  if (result.ok) {
    failures.push('(2) A token with a tampered (extended) expiry, original signature reused, still verified successfully.');
  } else if (result.reason !== 'bad-signature') {
    failures.push(`(2) A token with a tampered expiry was refused with reason '${result.reason}', expected 'bad-signature'.`);
  }
}

// (3) Flip a single hex character in the signature segment, payload untouched.
{
  const chars = signatureSegment.split('');
  const target = chars[0];
  chars[0] = target === '0' ? '1' : '0';
  const tamperedSignature = chars.join('');
  const tamperedToken = `${payloadSegment}.${tamperedSignature}`;
  const result = verifyRecoveryToken({ token: tamperedToken, secret: SECRET, now: NOW });
  if (result.ok) {
    failures.push('(3) A token with one flipped hex character in its signature still verified successfully.');
  } else if (result.reason !== 'bad-signature') {
    failures.push(`(3) A token with a single flipped signature byte was refused with reason '${result.reason}', expected 'bad-signature'.`);
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: an untampered token verifies; tampering the orderId, tampering the expiry, or ' +
    'flipping one hex character of the signature — each with the rest of the token left ' +
    "exactly as minted — is refused with reason 'bad-signature' in all three cases.",
);
process.exit(0);
