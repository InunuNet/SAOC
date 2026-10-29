// Golden for the additive `expiresAt` input on mintRecoveryToken (mission nos-recovery-ttl, spec D5, D7).
// Frozen by @architect. Run: pnpm exec tsx .agent/memory/project/specs/nos-recovery-ttl/goldens/recovery-mint.golden.ts
// Effect under test: a token minted with an explicit absolute expiry carries exactly that expiry in its signed
// payload, verifies right up to the last millisecond, and is refused at the instant. The legacy ttl path stays
// byte-compatible (the F6 checks depend on it) but production never uses it (check_wiring.py no-default-ttl).
import assert from 'node:assert/strict';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../../../..');
const SECRET = 'golden-secret-not-a-real-key';
const DAY = 24 * 60 * 60 * 1000;

async function main(): Promise<void> {
  const { mintRecoveryToken, verifyRecoveryToken, RECOVERY_TOKEN_DEFAULT_TTL_MS } = (await import(path.join(ROOT, 'lib/recovery-token.ts'))) as {
    mintRecoveryToken: (i: { orderId: string; secret: string; now: Date; ttlMs?: number; expiresAt?: Date }) => { token: string; expiresAt: Date };
    verifyRecoveryToken: (i: { token: string; secret: string; now: Date }) => { ok: boolean; reason?: string; expiresAt?: Date; orderId?: string };
    RECOVERY_TOKEN_DEFAULT_TTL_MS: number;
  };

  const expiresAt = new Date('2027-10-03T22:00:00.000Z');
  const mintedA = mintRecoveryToken({ orderId: 'order-1', secret: SECRET, now: new Date('2026-10-29T08:00:00Z'), expiresAt });
  const mintedB = mintRecoveryToken({ orderId: 'order-1', secret: SECRET, now: new Date('2027-09-20T08:00:00Z'), expiresAt });

  // The expiry is the absolute instant given, whatever the mint time (not now + something).
  assert.equal(mintedA.expiresAt.getTime(), expiresAt.getTime(), 'returned expiresAt is the explicit instant (early order)');
  assert.equal(mintedB.expiresAt.getTime(), expiresAt.getTime(), 'returned expiresAt is the explicit instant (late order)');
  assert.equal(mintedA.token, mintedB.token, 'the signed payload depends on the explicit expiry only, not on the mint time');
  assert.notEqual(mintedA.expiresAt.getTime(), new Date('2026-10-29T08:00:00Z').getTime() + RECOVERY_TOKEN_DEFAULT_TTL_MS, 'the 180-day default is not applied');

  // The signed payload, as the verifier reads it, carries the same instant.
  const payload = JSON.parse(Buffer.from(mintedA.token.split('.')[0], 'base64url').toString('utf8')) as { o: string; e: number };
  assert.deepEqual(payload, { o: 'order-1', e: expiresAt.getTime() });

  // Verification boundary: valid until the last millisecond, expired at the instant.
  const at = (offset: number) => verifyRecoveryToken({ token: mintedA.token, secret: SECRET, now: new Date(expiresAt.getTime() + offset) });
  assert.equal(at(-DAY).ok, true, '1 day before');
  assert.equal(at(-1).ok, true, '1 ms before');
  assert.equal(at(0).ok, false, 'at the instant');
  assert.equal(at(0).reason, 'expired');
  assert.equal(at(1).reason, 'expired', '1 ms after');
  const verified = at(-1);
  assert.equal(verified.orderId, 'order-1');
  assert.equal(verified.expiresAt?.getTime(), expiresAt.getTime());

  // expiresAt wins over ttlMs when both are present.
  const both = mintRecoveryToken({ orderId: 'order-1', secret: SECRET, now: new Date('2026-10-29T08:00:00Z'), ttlMs: 1000, expiresAt });
  assert.equal(both.expiresAt.getTime(), expiresAt.getTime(), 'explicit expiresAt takes precedence over ttlMs');

  // An explicit expiry that is not a usable future instant refuses to mint (fail closed, no born-expired token).
  const now = new Date('2026-10-29T08:00:00Z');
  for (const [label, bad] of [
    ['invalid date', new Date('x')],
    ['equal to now', new Date(now.getTime())],
    ['before now', new Date(now.getTime() - 1)],
  ] as const) {
    assert.throws(() => mintRecoveryToken({ orderId: 'o', secret: SECRET, now, expiresAt: bad }), RangeError, `${label} must throw RangeError`);
  }
  assert.doesNotThrow(() => mintRecoveryToken({ orderId: 'o', secret: SECRET, now, expiresAt: new Date(now.getTime() + 1) }), '1 ms after now is the smallest legal expiry');
  try {
    mintRecoveryToken({ orderId: 'o', secret: SECRET, now, expiresAt: new Date('x') });
  } catch (error) {
    assert.ok(!String((error as Error).message).includes(SECRET), 'the refusal message never contains the secret');
  }

  // Legacy path unchanged (F6 contract): ttl default and explicit ttl still compute now + ttl.
  const legacyDefault = mintRecoveryToken({ orderId: 'o', secret: SECRET, now });
  assert.equal(legacyDefault.expiresAt.getTime(), now.getTime() + RECOVERY_TOKEN_DEFAULT_TTL_MS);
  const legacyTtl = mintRecoveryToken({ orderId: 'o', secret: SECRET, now, ttlMs: 5000 });
  assert.equal(legacyTtl.expiresAt.getTime(), now.getTime() + 5000);

  console.log('recovery-mint golden: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
