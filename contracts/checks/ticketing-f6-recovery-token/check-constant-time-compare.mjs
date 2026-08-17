#!/usr/bin/env node
// F6 (ticketing-foundation) — design constraint 2: constant-time comparison for signature
// verification. Genuine timing-side-channel measurement is not attempted here (flaky and
// noise-dominated on a shared CI machine — see the golden README's "What this contract does
// NOT prove" for why that's a deliberate scope line, not an oversight). Instead this proves,
// behaviourally, that verifyRecoveryToken() ROUTES its signature comparison through the
// injectable `compare` parameter rather than performing a separate, hardcoded `===` check that
// would make the injected parameter dead code.
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f6-recovery-token/check-constant-time-compare.mjs

import { randomBytes } from 'node:crypto';
import { constantTimeEqual, mintRecoveryToken, verifyRecoveryToken } from '../../../lib/recovery-token.ts';

const failures = [];
const NOW = new Date('2027-03-01T00:00:00Z');
const SECRET = randomBytes(32).toString('hex');

// --- constantTimeEqual() itself, as a direct unit ---

if (constantTimeEqual(Buffer.from('same-bytes'), Buffer.from('same-bytes')) !== true) {
  failures.push('(1a) constantTimeEqual() returned false for two identical buffers.');
}
if (constantTimeEqual(Buffer.from('short'), Buffer.from('a-longer-buffer')) !== false) {
  failures.push('(1b) constantTimeEqual() did not return false for unequal-length buffers.');
}
try {
  const result = constantTimeEqual(Buffer.from('aaaaa'), Buffer.from('bbbbb'));
  if (result !== false) {
    failures.push('(1c) constantTimeEqual() returned true for two different, equal-length buffers.');
  }
} catch (err) {
  failures.push(`(1c) constantTimeEqual() threw on equal-length, different buffers instead of returning false: ${err}.`);
}
try {
  constantTimeEqual(Buffer.from('short'), Buffer.from('much-longer-buffer-here'));
} catch (err) {
  failures.push(`(1b) constantTimeEqual() threw on unequal-length buffers instead of returning false: ${err}.`);
}

// --- default comparison correctly rejects a corrupted signature ---

const minted = mintRecoveryToken({ orderId: 'order-ct-1', secret: SECRET, now: NOW });
const [payloadSegment, signatureSegment] = minted.token.split('.');
const corruptedSignature = flipOneHexChar(signatureSegment);
const corruptedToken = `${payloadSegment}.${corruptedSignature}`;

const defaultResult = verifyRecoveryToken({ token: corruptedToken, secret: SECRET, now: NOW });
if (defaultResult.ok) {
  failures.push('(2) With NO compare override, a corrupted-signature token verified successfully — the default comparison is broken.');
}

// --- the injected-compare proof: a spy that always approves must be trusted, not overridden by
// a separate internal check ---

let spyWasCalled = false;
let spyReceivedBuffers = true;
const alwaysApprove = (a, b) => {
  spyWasCalled = true;
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) spyReceivedBuffers = false;
  return true;
};

const spyResult = verifyRecoveryToken({
  token: corruptedToken,
  secret: SECRET,
  now: NOW,
  compare: alwaysApprove,
});

if (!spyWasCalled) {
  failures.push('(3) Injecting a `compare` function had no effect — verifyRecoveryToken() never called it. The comparison is not actually routed through the injectable parameter (a defeating `sigHex === expectedHex` mutation would produce exactly this symptom).');
}
if (spyWasCalled && !spyReceivedBuffers) {
  failures.push('(4) The injected `compare` function was called with non-Buffer arguments — expected two Buffer instances (the constant-time-safe comparison contract).');
}
if (spyWasCalled && !spyResult.ok) {
  failures.push('(5) A corrupted-signature token was still refused even though the injected `compare` spy always returns true. This means verifyRecoveryToken() performs its OWN separate signature check in addition to (or instead of) the injected `compare` result — the injectable parameter is decorative, not authoritative. Defeating mutation: replace the `compare(...)` call with a direct `sigHex === expectedHex` comparison.');
}

function flipOneHexChar(hex) {
  const chars = hex.split('');
  const target = chars[0];
  chars[0] = target === '0' ? '1' : '0';
  return chars.join('');
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: constantTimeEqual() is correct on equal/unequal/unequal-length buffers without ' +
    'throwing; the default (uninjected) comparison correctly rejects a corrupted signature; ' +
    'and verifyRecoveryToken() genuinely routes signature comparison through the injectable ' +
    '`compare` parameter — an always-approve spy is trusted rather than overridden by a ' +
    'separate hardcoded check, proving the injectable hook is load-bearing, not decorative.',
);
process.exit(0);
