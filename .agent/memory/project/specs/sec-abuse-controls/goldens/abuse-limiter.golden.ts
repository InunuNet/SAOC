// Golden for lib/abuse-limiter.ts (SEC-15, and the limiter half of SEC-02).
// Frozen by @architect. @dev implements against this and never edits it.
// Run: pnpm exec tsx .agent/memory/project/specs/sec-abuse-controls/goldens/abuse-limiter.golden.ts
import assert from 'node:assert/strict';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../../../..');
const MIN = 60_000;
const HOUR = 3_600_000;

// Minimal in-memory Firestore: serial transactions, set applied after the callback returns.
class FakeDb {
  docs = new Map<string, Record<string, unknown>>();
  writes = 0;
  failing = false;
  collection(name: string) {
    return { doc: (id: string) => ({ path: `${name}/${id}` }) };
  }
  async runTransaction<T>(
    fn: (tx: {
      get(ref: { path: string }): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }>;
      set(ref: { path: string }, data: Record<string, unknown>): void;
    }) => Promise<T>,
  ): Promise<T> {
    if (this.failing) throw new Error('firestore unavailable');
    const pending = new Map<string, Record<string, unknown>>();
    const result = await fn({
      get: async (ref) => {
        const data = this.docs.get(ref.path);
        return { exists: data !== undefined, data: () => data };
      },
      set: (ref, data) => {
        pending.set(ref.path, data);
      },
    });
    for (const [key, value] of pending) {
      this.docs.set(key, structuredClone(value));
      this.writes += 1;
    }
    return result;
  }
}

async function main() {
  const limiter = await import(path.join(ROOT, 'lib/abuse-limiter.ts'));
  const { consumeAbuseLimit, clientActorKey, AbuseLimiterUnavailableError } = limiter;
  const SECRET = 'golden-secret-a';
  const t0 = new Date('2027-01-01T10:00:00Z');
  const at = (ms: number) => new Date(t0.getTime() + ms);

  // 1. The Nth attempt is allowed, the N+1th denied, and a denial writes nothing.
  {
    const db = new FakeDb();
    const base = { scope: 'contact', key: 'ip4:203.0.113.9', maxAttempts: 5, windowMs: HOUR };
    for (let i = 0; i < 5; i++) {
      const decision = await consumeAbuseLimit({ ...base, now: at(i * 1000) }, { db, secret: SECRET });
      assert.equal(decision.allowed, true, `attempt ${i + 1} of 5 must be allowed`);
    }
    const writesBefore = db.writes;
    const denied = await consumeAbuseLimit({ ...base, now: at(6000) }, { db, secret: SECRET });
    assert.equal(denied.allowed, false, 'attempt 6 of 5 must be denied');
    assert.equal(db.writes, writesBefore, 'a denied attempt must not write (no write amplification under attack)');
    assert.ok(denied.allowed === false && denied.retryAfterSeconds >= 1 && denied.retryAfterSeconds <= 3600);

    // Retry-After is exact: still denied one second early, allowed at the stated second.
    const wait = denied.allowed === false ? denied.retryAfterSeconds : 0;
    const early = await consumeAbuseLimit({ ...base, now: at(6000 + (wait - 1) * 1000) }, { db, secret: SECRET });
    assert.equal(early.allowed, false, 'one second before Retry-After must still be denied');
    const onTime = await consumeAbuseLimit({ ...base, now: at(6000 + wait * 1000) }, { db, secret: SECRET });
    assert.equal(onTime.allowed, true, 'at Retry-After the attempt must be allowed');
  }

  // 2. The window slides: attempts older than windowMs stop counting.
  {
    const db = new FakeDb();
    const base = { scope: 'newsletter-subscribe', key: 'ip4:198.51.100.7', maxAttempts: 2, windowMs: 10 * MIN };
    assert.equal((await consumeAbuseLimit({ ...base, now: at(0) }, { db, secret: SECRET })).allowed, true);
    assert.equal((await consumeAbuseLimit({ ...base, now: at(1000) }, { db, secret: SECRET })).allowed, true);
    assert.equal((await consumeAbuseLimit({ ...base, now: at(2000) }, { db, secret: SECRET })).allowed, false);
    assert.equal((await consumeAbuseLimit({ ...base, now: at(10 * MIN) }, { db, secret: SECRET })).allowed, true, 'first attempt aged out at exactly windowMs');
  }

  // 3. Cross-instance: two callers sharing only the database see ONE count (SEC-15).
  {
    const db = new FakeDb();
    const base = { scope: 'contact', key: 'ip4:192.0.2.1', maxAttempts: 3, windowMs: HOUR };
    const instanceA = (now: Date) => consumeAbuseLimit({ ...base, now }, { db, secret: SECRET });
    const instanceB = (now: Date) => consumeAbuseLimit({ ...base, now }, { db, secret: SECRET });
    assert.equal((await instanceA(at(0))).allowed, true);
    assert.equal((await instanceB(at(1))).allowed, true);
    assert.equal((await instanceA(at(2))).allowed, true);
    assert.equal((await instanceB(at(3))).allowed, false, 'the 4th attempt, from the other instance, must be denied');
  }

  // 4. Weighted attempts and key/scope isolation.
  {
    const db = new FakeDb();
    const weighted = { scope: 'weighted', key: 'k', maxAttempts: 40, windowMs: HOUR };
    assert.equal((await consumeAbuseLimit({ ...weighted, weight: 20, now: at(0) }, { db, secret: SECRET })).allowed, true);
    assert.equal((await consumeAbuseLimit({ ...weighted, weight: 20, now: at(1) }, { db, secret: SECRET })).allowed, true);
    assert.equal((await consumeAbuseLimit({ ...weighted, weight: 1, now: at(2) }, { db, secret: SECRET })).allowed, false);
    const other = { ...weighted, key: 'other' };
    assert.equal((await consumeAbuseLimit({ ...other, weight: 40, now: at(3) }, { db, secret: SECRET })).allowed, true, 'a different key has its own budget');
    const otherScope = { ...weighted, scope: 'weighted-2' };
    assert.equal((await consumeAbuseLimit({ ...otherScope, weight: 40, now: at(4) }, { db, secret: SECRET })).allowed, true, 'a different scope has its own budget');
  }

  // 5. What is stored: hashed key, bounded, TTL-able, no raw identifier anywhere.
  {
    const db = new FakeDb();
    const rawKey = 'person@example.org';
    await consumeAbuseLimit({ scope: 'contact-email', key: rawKey, maxAttempts: 5, windowMs: HOUR, now: at(0) }, { db, secret: SECRET });
    assert.equal(db.docs.size, 1);
    const [[docPath, doc]] = [...db.docs.entries()];
    assert.match(docPath, /^abuseLimits\/contact-email:[0-9a-f]{64}$/, 'collection abuseLimits, id scope:hmac-sha256-hex');
    assert.ok(!docPath.includes('person') && !JSON.stringify(doc).includes('person'), 'raw key must not be stored');
    assert.ok(doc.expireAt instanceof Date && (doc.expireAt as Date).getTime() >= at(0).getTime() + HOUR, 'expireAt (TTL field) >= now + windowMs');

    // A different secret yields a different id (the hash is keyed, not a bare digest).
    const db2 = new FakeDb();
    await consumeAbuseLimit({ scope: 'contact-email', key: rawKey, maxAttempts: 5, windowMs: HOUR, now: at(0) }, { db: db2, secret: 'golden-secret-b' });
    assert.notEqual([...db2.docs.keys()][0], docPath);

    // entries never exceed maxAttempts however many allowed attempts pass over time.
    const db3 = new FakeDb();
    for (let i = 0; i < 40; i++) {
      await consumeAbuseLimit({ scope: 's', key: 'k', maxAttempts: 3, windowMs: 1000, now: at(i * 2000) }, { db: db3, secret: SECRET });
    }
    const stored = [...db3.docs.values()][0] as { entries: unknown[] };
    assert.ok(stored.entries.length <= 3, 'entries are pruned to the live window');
  }

  // 6. Fail closed: a store failure or a missing secret throws a typed error, never "allowed".
  {
    const db = new FakeDb();
    db.failing = true;
    await assert.rejects(
      consumeAbuseLimit({ scope: 'contact', key: 'k', maxAttempts: 5, windowMs: HOUR, now: at(0) }, { db, secret: SECRET }),
      (error: Error) => error instanceof AbuseLimiterUnavailableError && error.name === 'AbuseLimiterUnavailableError',
    );
    await assert.rejects(
      consumeAbuseLimit({ scope: 'contact', key: 'k', maxAttempts: 5, windowMs: HOUR, now: at(0) }, { db: new FakeDb(), secret: '' }),
      (error: Error) => error instanceof AbuseLimiterUnavailableError,
    );
  }

  // 7. Actor key from X-Forwarded-For: second-to-last hop, IPv6 grouped by /64.
  {
    assert.equal(clientActorKey('1.1.1.1, 203.0.113.9, 35.191.0.1'), 'ip4:203.0.113.9', 'attacker-prefixed hops are ignored');
    // Spoofing: whatever the client puts LEFT of the two platform-appended hops never changes the key.
    const trusted = '203.0.113.9, 35.191.0.1';
    for (const forged of ['9.9.9.9', '1.1.1.1, 5.5.5.5', '::1', '10.0.0.1, 203.0.113.10', 'garbage', '2001:db8::7']) {
      assert.equal(clientActorKey(`${forged}, ${trusted}`), 'ip4:203.0.113.9', `forged leftmost ${forged} must not change the actor`);
    }
    {
      const db = new FakeDb();
      const spoofBase = { scope: 'spoof', maxAttempts: 2, windowMs: HOUR };
      const keyFor = (xff: string) => clientActorKey(xff);
      assert.equal((await consumeAbuseLimit({ ...spoofBase, key: keyFor(`1.1.1.1, ${trusted}`), now: at(0) }, { db, secret: SECRET })).allowed, true);
      assert.equal((await consumeAbuseLimit({ ...spoofBase, key: keyFor(`2.2.2.2, ${trusted}`), now: at(1) }, { db, secret: SECRET })).allowed, true);
      assert.equal((await consumeAbuseLimit({ ...spoofBase, key: keyFor(`3.3.3.3, ${trusted}`), now: at(2) }, { db, secret: SECRET })).allowed, false, 'rotating the forged hop does not buy a fresh budget');
    }
    assert.equal(clientActorKey('203.0.113.9'), 'ip4:203.0.113.9');
    assert.equal(clientActorKey('::ffff:203.0.113.9'), 'ip4:203.0.113.9', 'IPv4-mapped IPv6 is the IPv4 identity');
    const a = clientActorKey('x, 2001:db8:1:2:3:4:5:6, 35.191.0.1');
    const b = clientActorKey('x, 2001:DB8:1:2::9, 35.191.0.1');
    assert.equal(a, 'ip6:2001:0db8:0001:0002');
    assert.equal(a, b, 'two addresses in one /64 are one actor');
    assert.equal(clientActorKey('2001:db8::1'), 'ip6:2001:0db8:0000:0000');
    assert.notEqual(clientActorKey('2001:db8:1:3::1'), a, 'a different /64 is a different actor');
    assert.equal(clientActorKey(null), 'unknown');
    assert.equal(clientActorKey(''), 'unknown');
    assert.equal(clientActorKey('a, not-an-ip, b'), 'unknown', 'a non-address hop never becomes a key');
  }

  // 8. Importing the module must not load firebase-admin (the golden runs without it).
  assert.ok(!Object.keys(require.cache).some((id) => id.includes('firebase-admin')), 'firebase-admin must be imported lazily');

  console.log('abuse-limiter golden: PASS');
}

main().catch((error) => {
  console.error('abuse-limiter golden: FAIL');
  console.error(error);
  process.exit(1);
});
