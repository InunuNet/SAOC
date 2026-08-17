#!/usr/bin/env node
// F6 (ticketing-foundation) — design constraint 5: expiry enforced with INJECTED time, not
// Date.now(). Mirrors F4's ShowWindowLookup pattern (lib/admin-auth.ts): both minting and
// verifying take an explicit `now`, so the inside-window and lapsed cases can be proven offline
// and deterministically, with no wall-clock sleep anywhere in this script.
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f6-recovery-token/check-expiry-injected-time.mjs

import { randomBytes } from 'node:crypto';
import { mintRecoveryToken, verifyRecoveryToken } from '../../../lib/recovery-token.ts';

const failures = [];
const SECRET = randomBytes(32).toString('hex');
const MINT_TIME = new Date('2027-03-01T00:00:00.000Z');
const TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days, fixed for this test regardless of the library's default

const minted = mintRecoveryToken({ orderId: 'order-expiry-1', secret: SECRET, now: MINT_TIME, ttlMs: TTL_MS });

const expectedExpiry = new Date(MINT_TIME.getTime() + TTL_MS);
if (minted.expiresAt.getTime() !== expectedExpiry.getTime()) {
  failures.push(`(setup) mintRecoveryToken() returned expiresAt ${minted.expiresAt.toISOString()}, expected ${expectedExpiry.toISOString()} (mint time + ttlMs).`);
}

const cases = [
  { label: 'at mint time', now: MINT_TIME, expectOk: true },
  { label: '1ms before expiry', now: new Date(MINT_TIME.getTime() + TTL_MS - 1), expectOk: true },
  { label: 'exactly at expiry (boundary)', now: new Date(MINT_TIME.getTime() + TTL_MS), expectOk: false },
  { label: '1ms after expiry', now: new Date(MINT_TIME.getTime() + TTL_MS + 1), expectOk: false },
  { label: '1 day after expiry', now: new Date(MINT_TIME.getTime() + TTL_MS + 1000 * 60 * 60 * 24), expectOk: false },
];

for (const testCase of cases) {
  const result = verifyRecoveryToken({ token: minted.token, secret: SECRET, now: testCase.now });
  if (result.ok !== testCase.expectOk) {
    failures.push(`(${testCase.label}) verifyRecoveryToken() at now=${testCase.now.toISOString()} returned ok=${result.ok}, expected ok=${testCase.expectOk}.`);
  }
  if (!testCase.expectOk && result.ok === false && result.reason !== 'expired') {
    failures.push(`(${testCase.label}) Expected refusal reason 'expired', got '${result.reason}'.`);
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: expiry is enforced purely via the injected `now` parameter — a token verifies at ' +
    "mint time and up to 1ms before its expiry, and is refused with reason 'expired' at the " +
    'exact expiry boundary and beyond. No wall-clock sleep, no Date.now() call, in this test.',
);
process.exit(0);
