// Golden for SEC-22: lib/vendor-stand-payment-link.ts (link record, revocation, initiate decision,
// named numbers) and the token module's nonce + TTL cap. Frozen by @architect; @dev never edits it.
// Run: pnpm exec tsx .agent/memory/project/specs/sec-stand-orders/goldens/stand-payment-link.golden.ts
// Pure modules, no Firestore I/O (Timestamp is constructed only as a value).
import assert from 'node:assert/strict';
import { Timestamp } from 'firebase-admin/firestore';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../../../..');
const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const NOW = new Date('2026-11-01T10:00:00.000Z');
const ts = (ms: number) => Timestamp.fromMillis(ms);

async function main() {
  const link = await import(path.join(ROOT, 'lib/vendor-stand-payment-link.ts'));
  const token = await import(path.join(ROOT, 'lib/vendor-stand-payment-token.ts'));
  const {
    STAND_PAYMENT_ATTEMPT_WINDOW_MINUTES,
    STAND_PAYMENT_LIMITS,
    buildStandPaymentLinkRecord,
    buildStandPaymentLinkRevocation,
    decideStandLinkUse,
    decideStandInitiate,
  } = link;
  const SECRET = 'golden-secret-not-real';

  // 1. Named numbers (spec.md D4, D5, D6). Changing one is a spec change, not a code tweak.
  assert.equal(STAND_PAYMENT_ATTEMPT_WINDOW_MINUTES, 30);
  assert.deepEqual({ ...STAND_PAYMENT_LIMITS }, { ipRequests: 12, ipWindowMs: 15 * MIN, tokenRequests: 6, tokenWindowMs: 60 * MIN });
  assert.ok(Object.isFrozen(STAND_PAYMENT_LIMITS));
  assert.equal(token.VENDOR_STAND_PAYMENT_TOKEN_DEFAULT_TTL_MS, 30 * DAY, 'default TTL is the existing 30 days');
  assert.equal(token.VENDOR_STAND_PAYMENT_TOKEN_MAX_TTL_MS, 30 * DAY, 'the cap equals the default: no mint may outlive it');

  // 2. Token: carries a nonce, verify returns it, mint cannot exceed the cap.
  {
    const a = token.mintVendorStandPaymentToken({ vendorSubmissionId: 'sub1', secret: SECRET, now: NOW });
    const b = token.mintVendorStandPaymentToken({ vendorSubmissionId: 'sub1', secret: SECRET, now: NOW });
    assert.match(a.nonce, /^[0-9a-f]{32}$/);
    assert.notEqual(a.nonce, b.nonce);
    const verified = token.verifyVendorStandPaymentToken({ token: a.token, secret: SECRET, now: NOW });
    assert.equal(verified.ok, true);
    assert.equal(verified.nonce, a.nonce);
    assert.equal(verified.vendorSubmissionId, 'sub1');
    assert.equal(a.expiresAt.getTime(), NOW.getTime() + 30 * DAY);
    const huge = token.mintVendorStandPaymentToken({ vendorSubmissionId: 'sub1', secret: SECRET, now: NOW, ttlMs: 365 * DAY });
    assert.equal(huge.expiresAt.getTime(), NOW.getTime() + 30 * DAY, 'ttlMs above the cap is clamped');
    const short = token.mintVendorStandPaymentToken({ vendorSubmissionId: 'sub1', secret: SECRET, now: NOW, ttlMs: 60 * MIN });
    assert.equal(short.expiresAt.getTime(), NOW.getTime() + 60 * MIN, 'a shorter ttl is honoured');
    for (const bad of [0, -1, NaN, Infinity]) {
      assert.throws(() => token.mintVendorStandPaymentToken({ vendorSubmissionId: 'sub1', secret: SECRET, now: NOW, ttlMs: bad }), RangeError, `ttl ${bad}`);
    }
    assert.deepEqual(token.verifyVendorStandPaymentToken({ token: a.token, secret: SECRET, now: new Date(NOW.getTime() + 30 * DAY) }), { ok: false, reason: 'expired' });
    assert.equal(token.verifyVendorStandPaymentToken({ token: a.token, secret: 'other', now: NOW }).ok, false);
  }

  // 3. buildStandPaymentLinkRecord: exact keys, no undefined, revokedAt null.
  const record = buildStandPaymentLinkRecord({ nonce: 'n1', now: NOW, expiresAt: new Date(NOW.getTime() + 30 * DAY), issuedBy: 'admin@saoc.example' });
  assert.deepEqual(Object.keys(record).sort(), ['expiresAt', 'issuedAt', 'issuedBy', 'nonce', 'revokedAt', 'revokedBy']);
  assert.equal(record.nonce, 'n1');
  assert.equal(record.revokedAt, null);
  assert.equal(record.revokedBy, null);
  assert.equal(record.issuedBy, 'admin@saoc.example');
  assert.equal(buildStandPaymentLinkRecord({ nonce: 'n1', now: NOW, expiresAt: NOW, issuedBy: null }).issuedBy, null);
  assert.equal(buildStandPaymentLinkRecord({ nonce: 'n1', now: NOW, expiresAt: NOW, issuedBy: undefined }).issuedBy, null, 'undefined is coalesced to null');
  for (const value of Object.values(record)) assert.notEqual(value, undefined);

  // 4. decideStandLinkUse. Stored shape read back from Firestore has Timestamps; Dates also work.
  const stored = (over: Record<string, unknown> = {}) => ({
    nonce: 'n1', issuedAt: ts(NOW.getTime()), expiresAt: ts(NOW.getTime() + DAY), issuedBy: null, revokedAt: null, revokedBy: null, ...over,
  });
  const decide = (record: unknown, tokenNonce = 'n1', now = NOW) => decideStandLinkUse({ tokenNonce, record, now });
  assert.deepEqual(decide(stored()), { ok: true, legacy: false });
  assert.deepEqual(decide(record), { ok: true, legacy: false }, 'a freshly built record with Date fields');
  assert.deepEqual(decide(undefined), { ok: true, legacy: true }, 'migration window: a submission approved before F5 has no record');
  assert.deepEqual(decide(null), { ok: true, legacy: true });
  assert.deepEqual(decide(stored(), 'old-nonce'), { ok: false, reason: 'superseded' });
  assert.deepEqual(decide(stored({ revokedAt: ts(NOW.getTime() - MIN) })), { ok: false, reason: 'revoked' });
  assert.deepEqual(decide(stored({ revokedAt: ts(NOW.getTime() - MIN) }), 'old-nonce'), { ok: false, reason: 'revoked' }, 'revoked wins over superseded');
  assert.deepEqual(decide(stored({ revokedAt: new Date(NOW.getTime() - MIN) })), { ok: false, reason: 'revoked' });
  assert.deepEqual(decide(stored({ revokedAt: true })), { ok: false, reason: 'revoked' }, 'any non-null revokedAt revokes');
  assert.deepEqual(decide(stored({ expiresAt: ts(NOW.getTime()) })), { ok: false, reason: 'expired' }, 'expiry is exclusive: now >= expiresAt is expired');
  assert.deepEqual(decide(stored({ expiresAt: ts(NOW.getTime() + 1) })), { ok: true, legacy: false });
  for (const garbage of ['x', 7, true, [], {}, { nonce: 5, expiresAt: ts(NOW.getTime() + DAY) }, stored({ nonce: '' }), stored({ expiresAt: 'tomorrow' }), stored({ expiresAt: undefined }), stored({ expiresAt: NaN })]) {
    assert.deepEqual(decide(garbage), { ok: false, reason: 'malformed-record' }, `garbage ${JSON.stringify(garbage)}`);
  }

  // 5. Resend supersedes; revoke kills every link, including legacy ones with no record.
  {
    const first = buildStandPaymentLinkRecord({ nonce: 'first', now: NOW, expiresAt: new Date(NOW.getTime() + 30 * DAY), issuedBy: null });
    const second = buildStandPaymentLinkRecord({ nonce: 'second', now: NOW, expiresAt: new Date(NOW.getTime() + 30 * DAY), issuedBy: null });
    assert.equal(decide(first, 'first').ok, true);
    assert.deepEqual(decide(second, 'first'), { ok: false, reason: 'superseded' });
    assert.equal(decide(second, 'second').ok, true);

    const revoked = buildStandPaymentLinkRevocation({ existing: second, now: NOW, revokedBy: 'admin@saoc.example', freshNonce: 'unused' });
    assert.equal(revoked.nonce, 'second', 'a revoke of a valid record keeps its identity');
    assert.deepEqual(decide(revoked, 'second'), { ok: false, reason: 'revoked' });
    assert.equal(revoked.revokedBy, 'admin@saoc.example');
    assert.deepEqual(Object.keys(revoked).sort(), Object.keys(second).sort());
    for (const value of Object.values(revoked)) assert.notEqual(value, undefined);

    const legacyRevoked = buildStandPaymentLinkRevocation({ existing: undefined, now: NOW, revokedBy: null, freshNonce: 'fresh' });
    assert.equal(legacyRevoked.nonce, 'fresh');
    assert.deepEqual(decide(legacyRevoked, 'whatever-a-legacy-token-carried'), { ok: false, reason: 'revoked' });
    const malformedRevoked = buildStandPaymentLinkRevocation({ existing: { nonce: 5 }, now: NOW, revokedBy: null, freshNonce: 'fresh2' });
    assert.equal(malformedRevoked.nonce, 'fresh2');
    assert.deepEqual(decide(malformedRevoked, 'x'), { ok: false, reason: 'revoked' });

    const reissued = buildStandPaymentLinkRecord({ nonce: 'third', now: NOW, expiresAt: new Date(NOW.getTime() + 30 * DAY), issuedBy: null });
    assert.equal(decide(reissued, 'third').ok, true, 'resend after a revoke makes a working link again');
    assert.deepEqual(decide(reissued, 'second'), { ok: false, reason: 'superseded' });
  }

  // 6. decideStandInitiate. The in-flight window is 30 minutes from the attempt's createdAt,
  //    regardless of any gateway Pending report (SEC-22). Live mode only counts a stamped order.
  const LIVE = { liveMode: true };
  const TEST = { liveMode: false };
  const init = (order: unknown, mode = TEST, now = NOW) => decideStandInitiate({ order, now, ...mode });
  const pending = (ageMs: number, over: Record<string, unknown> = {}) => ({ status: 'pending', createdAt: ts(NOW.getTime() - ageMs), gatewayPending: null, ...over });
  assert.deepEqual(init(undefined), { ok: true });
  assert.deepEqual(init(null, LIVE), { ok: true });
  assert.deepEqual(init({ status: 'paid' }), { ok: false, reason: 'already-paid' }, 'test mode: any paid order');
  assert.deepEqual(init({ status: 'paid', issuedInTestMode: false }, LIVE), { ok: false, reason: 'already-paid' });
  assert.deepEqual(init({ status: 'paid', issuedInTestMode: true }, LIVE), { ok: true }, 'live: a test-stamped paid order may be paid again for real');
  assert.deepEqual(init({ status: 'paid' }, LIVE), { ok: true }, 'live: the 2 untagged prod orders may be paid again for real');
  assert.deepEqual(init(pending(29 * MIN)), { ok: false, reason: 'attempt-in-flight' });
  assert.deepEqual(init(pending(30 * MIN - 1)), { ok: false, reason: 'attempt-in-flight' });
  assert.deepEqual(init(pending(30 * MIN)), { ok: true }, 'the window is exclusive at 30 minutes');
  assert.deepEqual(init(pending(3 * 60 * MIN)), { ok: true });
  assert.deepEqual(init(pending(-2 * MIN)), { ok: false, reason: 'attempt-in-flight' }, 'small forward clock skew still counts');
  assert.deepEqual(init(pending(-10 * MIN)), { ok: true }, 'a createdAt far in the future is malformed, never a lockout');
  assert.deepEqual(init({ status: 'pending' }), { ok: true }, 'missing createdAt cannot lock a vendor out');
  assert.deepEqual(init({ status: 'pending', createdAt: 'now' }), { ok: true });
  assert.deepEqual(init(pending(0, { status: 'failed' })), { ok: true }, 'a failed attempt never blocks a retry');
  assert.deepEqual(init(pending(0, { status: 'cancelled' })), { ok: true });
  assert.deepEqual(init(pending(5 * 60 * MIN, { gatewayPending: { rawStatus: 'Pending', attemptId: 'a', at: ts(NOW.getTime() - 60 * MIN) } })), { ok: false, reason: 'pending-hold' }, 'gateway Pending holds long after the 30 minute window');
  assert.deepEqual(init(pending(5 * 60 * MIN, { gatewayPending: { at: ts(NOW.getTime() - 80 * 60 * MIN) } })), { ok: true }, 'a 72 hour hold has lapsed');
  assert.deepEqual(init(pending(1 * MIN, { gatewayPending: { at: ts(NOW.getTime() - 1) } })), { ok: false, reason: 'pending-hold' }, 'pending-hold outranks in-flight');
  assert.deepEqual(init({ ...pending(1 * MIN), status: 'paid', issuedInTestMode: false }, LIVE), { ok: false, reason: 'already-paid' }, 'already-paid outranks the rest');

  console.log('stand-payment-link.golden.ts: all assertions passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
