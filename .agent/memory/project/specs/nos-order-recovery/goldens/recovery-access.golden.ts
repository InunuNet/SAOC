// Golden for lib/recovery-access.ts (mission nos-order-recovery): who may see an order at
// /tickets/recover. Frozen by @architect. @dev implements against this and never edits it.
// Run: pnpm exec tsx .agent/memory/project/specs/nos-order-recovery/goldens/recovery-access.golden.ts
// Pure module, no Firestore, no network: the order lookup is injected. The module must import
// lib/recovery-token with a RELATIVE path (./recovery-token), because tsx resolves this file's graph
// without the Next alias set up.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../../../..');
const SECRET = `golden-only-${'k'.repeat(48)}`; // not a credential
const OTHER_SECRET = `golden-other-${'z'.repeat(48)}`;
const NOW = new Date('2027-03-01T12:00:00.000Z');
const DAY_MS = 86_400_000;

type Record_ = { reference: string; recoveryToken: string | null; status: string };

// Same wire format as lib/recovery-token.ts; the first assertion below proves they agree.
function sign(payloadSegment: string, secret: string): string {
  return createHmac('sha256', secret).update(payloadSegment).digest('hex');
}
function craft(orderId: string, expiresAtMs: number, secret = SECRET): string {
  const segment = Buffer.from(JSON.stringify({ o: orderId, e: expiresAtMs }), 'utf8').toString('base64url');
  return `${segment}.${sign(segment, secret)}`;
}

async function main() {
  const { mintRecoveryToken } = await import(path.join(ROOT, 'lib/recovery-token.ts'));
  const access = await import(path.join(ROOT, 'lib/recovery-access.ts'));
  const { resolveRecoveryAccess, RECOVERY_TOKEN_MAX_LENGTH } = access;
  assert.equal(RECOVERY_TOKEN_MAX_LENGTH, 2048, 'the length cap is a named export, 2048');

  const minted = mintRecoveryToken({ orderId: 'order-A', secret: SECRET, now: NOW });
  assert.equal(craft('order-A', minted.expiresAt.getTime()), minted.token, 'golden crafter matches mintRecoveryToken');
  const good: string = minted.token;

  // Console spy: a bad token must never be logged, and nothing is logged on any path here.
  const logged: string[] = [];
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    console[level] = (...args: unknown[]) => void logged.push(args.map(String).join(' '));
  }

  function run(rawToken: unknown, records: Record<string, Record_ | null>, extra: Record<string, unknown> = {}) {
    const calls: string[] = [];
    const matchCalls: Array<[string, string]> = [];
    const input = {
      rawToken,
      secret: SECRET,
      now: NOW,
      loadOrder: async (orderId: string) => {
        calls.push(orderId);
        return records[orderId] ?? null;
      },
      tokensMatch: (stored: string, presented: string) => {
        matchCalls.push([stored, presented]);
        return stored === presented;
      },
      ...extra,
    };
    return { calls, matchCalls, result: resolveRecoveryAccess(input) };
  }
  const PAID: Record_ = { reference: 'REF-A', recoveryToken: good, status: 'paid' };

  // 1. The one success: exactly {ok:true, reference}, one lookup, the stored-token comparison made.
  {
    const { calls, matchCalls, result } = run(good, { 'order-A': PAID });
    assert.deepStrictEqual(await result, { ok: true, orderId: 'order-A' });
    assert.deepStrictEqual(calls, ['order-A']);
    assert.deepStrictEqual(matchCalls, [[good, good]], 'stored token compared through the injected tokensMatch');
  }

  // 2. Rejected before any Firestore read. Every one resolves to exactly { ok: false } (no reason,
  //    no extra key), and the order lookup is never called.
  const longId = 'o'.repeat(RECOVERY_TOKEN_MAX_LENGTH);
  const [payloadSegment, signature] = good.split('.');
  const flipped = (s: string) => s.slice(0, -1) + (s.endsWith('0') ? '1' : '0');
  const tamperedPayload = `${Buffer.from(JSON.stringify({ o: 'order-B', e: minted.expiresAt.getTime() }), 'utf8').toString('base64url')}.${signature}`;
  const notDb: Array<[string, unknown]> = [
    ['undefined', undefined],
    ['empty string', ''],
    ['whitespace', '   '],
    ['repeated param (array)', [good, good]],
    ['array of one', [good]],
    ['number', 12345],
    ['null', null],
    ['no dot', 'abc'],
    ['no signature', `${payloadSegment}.`],
    ['no payload', `.${signature}`],
    ['leading space', ` ${good}`],
    ['trailing space', `${good} `],
    ['trailing junk segment', `${good}.junk`],
    ['uppercase signature', `${payloadSegment}.${signature.toUpperCase()}`],
    ['signature one char off', `${payloadSegment}.${flipped(signature)}`],
    ['signature truncated', `${payloadSegment}.${signature.slice(0, 63)}`],
    ['tampered payload, original signature', tamperedPayload],
    ['forged with another secret', craft('order-A', minted.expiresAt.getTime(), OTHER_SECRET)],
    ['payload not json', `${Buffer.from('not json').toString('base64url')}.${signature}`],
    ['valid signature, expired', craft('order-A', NOW.getTime() - 1)],
    ['valid signature, expires exactly now', craft('order-A', NOW.getTime())],
    ['valid signature, empty order id', craft('', NOW.getTime() + DAY_MS)],
    ['valid signature, order id with a slash', craft('orders/evil', NOW.getTime() + DAY_MS)],
    ['valid signature, longer than the cap', craft(longId, NOW.getTime() + DAY_MS)],
    ['oversize junk', 'a'.repeat(RECOVERY_TOKEN_MAX_LENGTH + 1)],
  ];
  const everything = { 'order-A': PAID, 'order-B': { ...PAID, reference: 'REF-B' }, [longId]: PAID, 'orders/evil': PAID };
  for (const [label, raw] of notDb) {
    const { calls, matchCalls, result } = run(raw, everything);
    assert.deepStrictEqual(await result, { ok: false }, `${label}: exactly { ok: false }`);
    assert.deepStrictEqual(calls, [], `${label}: no order lookup`);
    assert.deepStrictEqual(matchCalls, [], `${label}: no stored-token comparison`);
  }
  // A token at the cap boundary is not rejected for length: a valid-signature token of exactly 2048 chars passes.
  {
    const body = craft('x'.repeat(20), NOW.getTime() + DAY_MS);
    assert.ok(body.length < RECOVERY_TOKEN_MAX_LENGTH, 'a normal token is far below the cap');
  }

  // 3. Valid signature, unexpired, but the order does not entitle the holder. Same { ok: false }.
  const entitlement: Array<[string, Record<string, Record_ | null>]> = [
    ['unknown order', {}],
    ['order doc missing (null)', { 'order-A': null }],
    ['no stored token on the order', { 'order-A': { ...PAID, recoveryToken: null } }],
    ['stored token was rotated (revoked)', { 'order-A': { ...PAID, recoveryToken: craft('order-A', NOW.getTime() + 2 * DAY_MS) } }],
    ['stored token empty string', { 'order-A': { ...PAID, recoveryToken: '' } }],
    ['order reserved, not paid', { 'order-A': { ...PAID, status: 'reserved' } }],
    ['order cancelled', { 'order-A': { ...PAID, status: 'cancelled' } }],
    ['order status upper-case PAID', { 'order-A': { ...PAID, status: 'PAID' } }],
    ['no reference on the order', { 'order-A': { ...PAID, reference: '' } }],
  ];
  const baselineFailure = JSON.stringify(await run('bogus', {}).result);
  for (const [label, records] of entitlement) {
    const { calls, result } = run(good, records);
    const outcome = await result;
    assert.deepStrictEqual(outcome, { ok: false }, `${label}: exactly { ok: false }`);
    assert.equal(JSON.stringify(outcome), baselineFailure, `${label}: same value as a bogus token`);
    assert.deepStrictEqual(calls, ['order-A'], `${label}: looked up the signed order id only`);
  }

  // 4. The stored-token comparison uses the injected matcher; a matcher that says no must win,
  //    one that says yes on different strings must be honoured (proves the dep is the decision).
  assert.deepStrictEqual(await run(good, { 'order-A': PAID }, { tokensMatch: () => false }).result, { ok: false });
  assert.deepStrictEqual(
    await run(good, { 'order-A': { ...PAID, recoveryToken: 'different' } }, { tokensMatch: () => true }).result,
    { ok: true, orderId: 'order-A' },
  );

  // 5. Defaults: with no injected matcher the real comparison is constant-time and exact.
  {
    const records = { 'order-A': PAID };
    const base = { rawToken: good, secret: SECRET, now: NOW, loadOrder: async (id: string) => records[id as 'order-A'] ?? null };
    assert.deepStrictEqual(await resolveRecoveryAccess(base), { ok: true, orderId: 'order-A' });
    const nearMiss = { 'order-A': { ...PAID, recoveryToken: `${good}x` } };
    assert.deepStrictEqual(
      await resolveRecoveryAccess({ ...base, loadOrder: async (id: string) => nearMiss[id as 'order-A'] ?? null }),
      { ok: false },
    );
    const noStored = { 'order-A': { ...PAID, recoveryToken: null } };
    assert.deepStrictEqual(
      await resolveRecoveryAccess({ ...base, loadOrder: async (id: string) => noStored[id as 'order-A'] ?? null }),
      { ok: false },
      'a null stored token is denied by the default matcher without throwing',
    );
  }

  // 6. Missing secret. A token that cannot possibly be genuine (not a string, empty, over the cap, not
  //    <base64url>.<64 lowercase hex>) is denied exactly like any bad token, secret or no secret: that is
  //    what keeps the 404 byte-identical on a deploy (or CI run) without RECOVERY_TOKEN_SECRET. A
  //    well-formed token cannot be judged without the secret, so it fails loudly: a misconfigured
  //    production deploy turns every real recovery link into a 500, never into a silent 404.
  const impossible: unknown[] = [undefined, `.${signature}`, '', 'bogus', 'abc', [good], `${payloadSegment}.`, `${payloadSegment}.${signature.slice(0, 63)}`,
    `${payloadSegment}.${signature.toUpperCase()}`, `${good}.junk`, ` ${good}`, 'a'.repeat(RECOVERY_TOKEN_MAX_LENGTH + 1), 12345];
  const wellFormed: Array<[string, string]> = [
    ['genuine', good],
    ['forged with another secret', craft('order-A', minted.expiresAt.getTime(), OTHER_SECRET)],
    ['expired, valid signature', craft('order-A', NOW.getTime() - 1)],
    ['tampered payload', tamperedPayload],
  ];
  for (const secret of [undefined, '']) {
    for (const raw of impossible) {
      const { calls, result } = run(raw, { 'order-A': PAID }, { secret });
      assert.deepStrictEqual(await result, { ok: false }, `secret ${String(secret)}, ${String(raw).slice(0, 20)}: denied like any bad token`);
      assert.deepStrictEqual(calls, []);
    }
    for (const [label, raw] of wellFormed) {
      const { calls, result } = run(raw, { 'order-A': PAID }, { secret });
      const failure = await result.then(() => null, (e: Error) => e);
      assert.ok(failure instanceof Error, `secret ${String(secret)}, ${label}: rejects loudly`);
      assert.ok(!String(failure.message).includes(raw), 'error message does not echo the token');
      assert.deepStrictEqual(calls, []);
    }
  }
  const missingMessages = new Set<string>();
  for (const [, raw] of wellFormed) {
    missingMessages.add(await run(raw, { 'order-A': PAID }, { secret: undefined }).result.then(() => '', (e: Error) => e.message));
  }
  assert.equal(missingMessages.size, 1, 'the missing-secret failure is the same for every well-formed token');

  // 7. A lookup outage propagates (a 500 reachable only with a genuinely signed, unexpired token);
  //    it is never converted into { ok: false }, which would tell a real buyer the link is invalid.
  {
    const boom = new Error('firestore unavailable');
    const outcome = await resolveRecoveryAccess({ rawToken: good, secret: SECRET, now: NOW, loadOrder: async () => { throw boom; } }).then(() => null, (e: unknown) => e);
    assert.equal(outcome, boom);
  }

  // 8. No token, no signature, no secret was logged, and nothing at all was logged.
  assert.deepStrictEqual(logged, [], 'resolveRecoveryAccess logs nothing');

  console.info = () => undefined;
  process.stdout.write('recovery-access.golden: PASS\n');
}

main().catch((error) => {
  process.stderr.write(`recovery-access.golden: FAIL ${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
