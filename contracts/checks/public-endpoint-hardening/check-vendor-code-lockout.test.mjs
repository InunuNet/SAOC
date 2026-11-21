// Public-endpoint hardening F7: a stranger cannot lock a vendor out of code registration.
//
// Before: 5 wrong codes (the vendor's business name is public) set registrationCodeLockedAt with no
// expiry, so the vendor was shut out until the show office reissued. Now every 5th failure is a
// 15 minute soft lock, the lock only becomes permanent at 25 cumulative failures (the brute-force
// ceiling), and one client IP can record at most 5 failures per vendor per 24 hours before it is
// refused with the existing 429 without touching Firestore.
//
// Run as: npx tsx --test --experimental-test-module-mocks \
//   contracts/checks/public-endpoint-hardening/check-vendor-code-lockout.test.mjs

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  VENDOR_REGISTRATION_CODE_HARD_LOCK_THRESHOLD,
  VENDOR_REGISTRATION_CODE_LOCK_COOLDOWN_MS,
  recordFailedVendorRegistrationCodeAttempt,
  verifyVendorRegistrationCode,
} from '../../../lib/vendor-registration-code.ts';
import {
  GENERIC_CODE_VERIFICATION_ERROR_MESSAGE,
  handleVendorRegistrationCodeVerification,
} from '../../../lib/vendor-registration-code-verify-handler.ts';
import { createInMemoryVendorRegistrationCodeVerifyRateLimitStore } from '../../../lib/vendor-registration-code-verify-rate-limit.ts';

const NOW = new Date('2027-03-01T10:00:00Z');
const MIN = 60 * 1000;

const candidate = (over = {}) => ({
  id: 'app1',
  status: 'approved',
  registrationCodeId: '4821',
  registrationCodeNameSlug: 'orchidsbyann',
  registrationCodeExpiresAt: new Date('2027-03-10T00:00:00Z'),
  registrationCodeConsumedAt: null,
  registrationCodeLockedAt: null,
  registrationCodeFailedAttempts: 0,
  ...over,
});

const verify = (c, now = NOW) =>
  verifyVendorRegistrationCode({ typedNameSlug: 'orchidsbyann', typedCodeId: '4821' }, [c], now).ok;

test('legitimate vendor: correct code verifies when never locked', () => {
  assert.equal(verify(candidate()), true);
});

test('soft lock: locked for the cooldown, then the right code works again', () => {
  const locked = candidate({ registrationCodeLockedAt: NOW, registrationCodeFailedAttempts: 5 });
  assert.equal(verify(locked, new Date(NOW.getTime() + 1 * MIN)), false);
  const after = new Date(NOW.getTime() + VENDOR_REGISTRATION_CODE_LOCK_COOLDOWN_MS + 1);
  assert.equal(verify(locked, after), true);
});

test('hard ceiling: at 25 cumulative failures the lock never expires', () => {
  const locked = candidate({
    registrationCodeLockedAt: NOW,
    registrationCodeFailedAttempts: VENDOR_REGISTRATION_CODE_HARD_LOCK_THRESHOLD,
  });
  assert.equal(verify(locked, new Date(NOW.getTime() + 365 * 24 * 60 * MIN)), false);
});

test('legacy permanent lock (no counter) stays permanent', () => {
  const legacy = candidate({ registrationCodeLockedAt: NOW, registrationCodeFailedAttempts: null });
  assert.equal(verify(legacy, new Date(NOW.getTime() + 365 * 24 * 60 * MIN)), false);
});

function fakeRunner(initial) {
  const doc = { ...initial };
  return {
    doc,
    db: {
      runTransaction: async (fn) =>
        fn({
          get: async () => ({ data: () => ({ ...doc }) }),
          update: (_ref, patch) => Object.assign(doc, patch),
        }),
    },
  };
}

test('counter: soft lock on every 5th failure, no lock between, always set at 25', async () => {
  const { db, doc } = fakeRunner({});
  const lockedAt = [];
  for (let i = 1; i <= 26; i += 1) {
    const result = await recordFailedVendorRegistrationCodeAttempt(db, {}, { attemptedAt: NOW });
    if (result.locked) lockedAt.push(i);
  }
  assert.deepEqual(lockedAt, [5, 10, 15, 20, 25, 26]);
  assert.equal(doc.registrationCodeFailedAttempts, 26);
});

test('worst case per vendor: at most 25 guesses ever (was 5), at most 20 in the first hour', () => {
  // 5 guesses, lock for 15 min, repeated: the guesser gets 5 per 15 minutes, capped at 25 total.
  const guessesInFirstHour = 5 * Math.floor((60 * MIN) / (VENDOR_REGISTRATION_CODE_LOCK_COOLDOWN_MS)) ;
  assert.equal(guessesInFirstHour, 20);
  assert.equal(VENDOR_REGISTRATION_CODE_HARD_LOCK_THRESHOLD, 25);
});

function handlerHarness() {
  const store = createInMemoryVendorRegistrationCodeVerifyRateLimitStore();
  const io = { findCandidates: 0, recordFailed: 0 };
  const deps = (ip, now) => ({
    now,
    rateLimitKey: `vendor-register-code-verify-ip:${ip}`,
    clientIp: ip,
    getPriorAttempts: (key) => store.getPriorAttempts(key),
    recordAttempt: (key, at) => store.recordAttempt(key, at),
    findCandidates: async () => {
      io.findCandidates += 1;
      return [candidate()];
    },
    recordFailedAttempt: async () => {
      io.recordFailed += 1;
    },
    mintSession: () => ({ token: 't', expiresAt: new Date(NOW.getTime() + 30 * MIN) }),
  });
  return { io, deps };
}

const attempt = (h, ip, codeId, now) =>
  handleVendorRegistrationCodeVerification({ businessName: 'Orchids by Ann', codeId }, h.deps(ip, now));

test('attacker: one IP gets 5 failed guesses per vendor, then 429 with zero further writes', async () => {
  const h = handlerHarness();
  for (let i = 0; i < 5; i += 1) {
    const r = await attempt(h, '203.0.113.9', '0000', new Date(NOW.getTime() + i * MIN));
    assert.equal(r.status, 403);
    assert.equal(r.body.error, GENERIC_CODE_VERIFICATION_ERROR_MESSAGE);
  }
  assert.equal(h.io.recordFailed, 5);
  const blocked = await attempt(h, '203.0.113.9', '0000', new Date(NOW.getTime() + 6 * MIN));
  assert.equal(blocked.status, 429);
  assert.equal(h.io.recordFailed, 5, 'a refused guess must not advance the lockout counter');
  assert.equal(h.io.findCandidates, 5, 'a refused guess must not reach Firestore');
});

test('legitimate vendor on another IP is unaffected by the attacker and still gets in', async () => {
  const h = handlerHarness();
  for (let i = 0; i < 6; i += 1) {
    await attempt(h, '203.0.113.9', '0000', new Date(NOW.getTime() + i * MIN));
  }
  const ok = await attempt(h, '198.51.100.20', '4821', new Date(NOW.getTime() + 7 * MIN));
  assert.equal(ok.status, 200);
});

test('the per-IP failure window recovers after 24 hours', async () => {
  const h = handlerHarness();
  for (let i = 0; i < 5; i += 1) await attempt(h, '203.0.113.9', '0000', NOW);
  assert.equal((await attempt(h, '203.0.113.9', '4821', NOW)).status, 429);
  const later = new Date(NOW.getTime() + 24 * 60 * MIN + 1);
  assert.equal((await attempt(h, '203.0.113.9', '4821', later)).status, 200);
});
