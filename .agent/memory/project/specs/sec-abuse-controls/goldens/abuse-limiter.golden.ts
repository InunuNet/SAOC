// Golden for lib/abuse-limiter.ts (SEC-15, and the limiter half of SEC-02).
// Frozen by @architect. @dev implements against this and never edits it.
// Run: pnpm exec tsx .agent/memory/project/specs/sec-abuse-controls/goldens/abuse-limiter.golden.ts
import assert from 'node:assert/strict';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../../../..');
const MIN = 60_000;
const HOUR = 3_600_000;

// Minimal in-memory Firestore with real transaction semantics: reads are versioned, a commit whose
// read set changed meanwhile is aborted and the callback re-run (as Firestore does), and each read
// yields to the event loop so concurrent callers genuinely interleave. A read-modify-write that is
// not protected by the transaction (a stale read, or a lost update) therefore over-allows here.
function assertNoUndefined(value: unknown, where: string): void {
  if (value === undefined) throw new Error(`Cannot use "undefined" as a Firestore value (${where})`);
  if (Array.isArray(value)) value.forEach((entry, i) => assertNoUndefined(entry, `${where}[${i}]`));
  else if (typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype) {
    for (const [key, entry] of Object.entries(value)) assertNoUndefined(entry, `${where}.${key}`);
  }
}
const MAX_ATTEMPTS = 50; // the real SDK retries 5 times; the fake allows more so 10 racers can all settle
class FakeDb {
  docs = new Map<string, Record<string, unknown>>();
  versions = new Map<string, number>();
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
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const reads = new Map<string, number>();
      const pending = new Map<string, Record<string, unknown>>();
      const result = await fn({
        get: async (ref) => {
          await new Promise<void>((resolve) => setImmediate(resolve));
          const data = this.docs.get(ref.path);
          reads.set(ref.path, this.versions.get(ref.path) ?? 0);
          // Yield again AFTER the snapshot is taken, so every racer holds a stale view before any commits.
          await new Promise<void>((resolve) => setImmediate(resolve));
          return { exists: data !== undefined, data: () => (data === undefined ? undefined : structuredClone(data)) };
        },
        set: (ref, data) => {
          assertNoUndefined(data, ref.path);
          pending.set(ref.path, data);
        },
      });
      // Commit is synchronous: validate the read set, then apply, with no await in between.
      const stale = [...reads].some(([key, version]) => (this.versions.get(key) ?? 0) !== version);
      if (stale) continue;
      for (const [key, value] of pending) {
        this.docs.set(key, structuredClone(value));
        this.versions.set(key, (this.versions.get(key) ?? 0) + 1);
        this.writes += 1;
      }
      return result;
    }
    throw new Error('transaction aborted: too much contention');
  }
}

async function main() {
  const limiter = await import(path.join(ROOT, 'lib/abuse-limiter.ts'));
  const { consumeAbuseLimit, clientActorKey, abuseKeyStamp, AbuseLimiterUnavailableError } = limiter;
  const { buyerPairKey } = await import(path.join(ROOT, 'lib/buyer-email.ts'));
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

  // 3a. Pair scoping (SAOC-approved 2026-10-29): IP-A exhausts its own budget for buyer@x and the
  //     owner of the address, buying from IP-B, is untouched. There is no global per-email key.
  {
    const db = new FakeDb();
    const buyerLimit = { scope: 'checkout-buyer', maxAttempts: 6, windowMs: HOUR };
    const pairA = buyerPairKey('ip4:203.0.113.9', 'buyer@x.org');
    for (let i = 0; i < 6; i++) {
      assert.equal((await consumeAbuseLimit({ ...buyerLimit, key: pairA, now: at(i) }, { db, secret: SECRET })).allowed, true);
    }
    assert.equal((await consumeAbuseLimit({ ...buyerLimit, key: pairA, now: at(7) }, { db, secret: SECRET })).allowed, false, 'IP-A is exhausted for buyer@x');
    assert.equal((await consumeAbuseLimit({ ...buyerLimit, key: buyerPairKey('ip4:203.0.113.9', 'buyer+x@x.org'), now: at(8) }, { db, secret: SECRET })).allowed, false, 'a plus variant from IP-A shares the exhausted pair');
    assert.equal((await consumeAbuseLimit({ ...buyerLimit, key: buyerPairKey('ip4:203.0.113.10', 'buyer@x.org'), now: at(9) }, { db, secret: SECRET })).allowed, true, 'the same email from IP-B still succeeds (no lockout lever)');
    // POPIA: nothing stored for these pairs contains a raw email or address.
    const stored = JSON.stringify([...db.docs.entries()]);
    for (const raw of ['buyer@', 'x.org', '203.0.113']) assert.ok(!stored.includes(raw), `no raw ${raw} in limiter documents`);
    // The held-seat stamp is the same keyed hash: opaque hex, pair-scoped, plus-variant stable.
    process.env.RECOVERY_TOKEN_SECRET = 'golden-recovery-secret';
    const stampA = abuseKeyStamp('checkout-buyer', pairA);
    assert.match(stampA, /^[0-9a-f]{64}$/, 'stamp is a 64-char hex hash');
    assert.ok(!stampA.includes('buyer') && !stampA.includes('203'), 'stamp carries no raw value');
    assert.equal(stampA, abuseKeyStamp('checkout-buyer', buyerPairKey('ip4:203.0.113.9', 'Buyer+z@X.org')), 'plus/case variants stamp identically');
    assert.notEqual(stampA, abuseKeyStamp('checkout-buyer', buyerPairKey('ip4:203.0.113.10', 'buyer@x.org')), 'a different actor stamps differently: the D4 budget is per pair');
  }

  // 3b. Truly concurrent: ten callers racing the same key at the same instant, limit 3. Exactly
  //     three may win, however the transactions interleave (a read-modify-write that is not
  //     transactional loses updates and lets more through).
  {
    const db = new FakeDb();
    const base = { scope: 'contact', key: 'ip4:192.0.2.77', maxAttempts: 3, windowMs: HOUR };
    const decisions = await Promise.all(
      Array.from({ length: 10 }, (_, i) => consumeAbuseLimit({ ...base, now: at(i) }, { db, secret: SECRET })),
    );
    assert.equal(decisions.filter((d: { allowed: boolean }) => d.allowed).length, 3, 'exactly 3 of 10 concurrent attempts are allowed');
    assert.equal(decisions.filter((d: { allowed: boolean }) => !d.allowed).length, 7);
    const stored = [...db.docs.values()][0] as { entries: unknown[] };
    assert.equal(stored.entries.length, 3, 'the stored log holds exactly the three allowed attempts');
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
    // One entry means the platform appended nothing, so it is whatever the client sent: it is NEVER
    // an actor identity (Codex QA 2026-10-29). It lands in the shared strict `unknown` bucket.
    for (const single of ['203.0.113.9', '9.9.9.9', '2001:db8::7', '::ffff:203.0.113.9', ' 203.0.113.9 ']) {
      assert.equal(clientActorKey(single), 'unknown', `single-entry header ${single} is untrusted`);
    }
    assert.equal(clientActorKey('203.0.113.9,'), 'unknown', 'empty trailing entries do not make a second hop');
    assert.equal(clientActorKey(' , 203.0.113.9'), 'unknown', 'empty leading entries do not make a second hop');
    assert.equal(clientActorKey('203.0.113.9, 35.191.0.1'), 'ip4:203.0.113.9', 'the minimal two-hop shape is trusted');
    assert.equal(clientActorKey('::ffff:203.0.113.9, 35.191.0.1'), 'ip4:203.0.113.9', 'IPv4-mapped IPv6 is the IPv4 identity');
    {
      const db = new FakeDb();
      const spoofBase = { scope: 'spoof-single', maxAttempts: 1, windowMs: HOUR };
      assert.equal((await consumeAbuseLimit({ ...spoofBase, key: clientActorKey('1.1.1.1'), now: at(0) }, { db, secret: SECRET })).allowed, true);
      assert.equal((await consumeAbuseLimit({ ...spoofBase, key: clientActorKey('2.2.2.2'), now: at(1) }, { db, secret: SECRET })).allowed, false, 'a chosen single-entry address buys no fresh budget');
    }
    const a = clientActorKey('x, 2001:db8:1:2:3:4:5:6, 35.191.0.1');
    const b = clientActorKey('x, 2001:DB8:1:2::9, 35.191.0.1');
    assert.equal(a, 'ip6:2001:0db8:0001:0002');
    assert.equal(a, b, 'two addresses in one /64 are one actor');
    assert.equal(clientActorKey('2001:db8::1, 35.191.0.1'), 'ip6:2001:0db8:0000:0000');
    assert.notEqual(clientActorKey('2001:db8:1:3::1, 35.191.0.1'), a, 'a different /64 is a different actor');
    // IPv4-mapped IPv6 in EVERY spelling is the IPv4 identity (Codex QA 2026-10-29: the hex form
    // fell into one shared ip6 bucket, so distinct IPv4 clients exhausted each other's limit).
    // 203.0.113.9 = cb00:7109, 203.0.113.10 = cb00:710a.
    const platformHop = '35.191.0.1';
    for (const spelling of [
      '::ffff:cb00:7109', '::FFFF:CB00:7109', '::ffff:203.0.113.9', '::FFFF:203.0.113.9',
      '0:0:0:0:0:ffff:cb00:7109', '0000:0000:0000:0000:0000:ffff:cb00:7109', '0:0:0:0:0:ffff:203.0.113.9',
      '0000:0000:0000:0000:0000:FFFF:CB00:7109',
    ]) {
      assert.equal(clientActorKey(`1.1.1.1, ${spelling}, ${platformHop}`), 'ip4:203.0.113.9', `${spelling} is the IPv4 203.0.113.9`);
    }
    assert.equal(clientActorKey(`x, ::ffff:cb00:710a, ${platformHop}`), 'ip4:203.0.113.10');
    assert.notEqual(clientActorKey(`x, ::ffff:cb00:7109, ${platformHop}`), clientActorKey(`x, ::ffff:cb00:710a, ${platformHop}`), 'two different hex-mapped clients are different actors');
    assert.notEqual(clientActorKey(`x, ::ffff:cb00:7109, ${platformHop}`), 'ip6:0000:0000:0000:0000', 'a mapped client never lands in the shared ::/64 bucket');
    // Near misses are NOT IPv4: a different embedded prefix stays an IPv6 /64 identity.
    assert.equal(clientActorKey(`x, ::fffe:cb00:7109, ${platformHop}`), 'ip6:0000:0000:0000:0000');
    assert.equal(clientActorKey(`x, 0:0:0:0:1:ffff:cb00:7109, ${platformHop}`), 'ip6:0000:0000:0000:0000');
    assert.equal(clientActorKey(`x, 64:ff9b::cb00:7109, ${platformHop}`), 'ip6:0064:ff9b:0000:0000', 'NAT64 is not the mapped form');
    assert.equal(clientActorKey(null), 'unknown');
    assert.equal(clientActorKey(''), 'unknown');
    assert.equal(clientActorKey('a, not-an-ip, b'), 'unknown', 'a non-address hop never becomes a key');
  }

  // 7b. Key derivation (SAOC lead, prompt item 16): the limiter key is HMAC-SHA256(RECOVERY_TOKEN_SECRET,
  //     "abuse-limiter:v1") and every stored id / stamp is HMAC-SHA256(that key, scope NUL key). Exact
  //     bytes, computed here independently, so concatenating secret and label (or swapping them) fails.
  {
    const { createHmac } = await import('node:crypto');
    const base = 'golden-base-secret-0123456789';
    process.env.RECOVERY_TOKEN_SECRET = base;
    const derived = createHmac('sha256', base).update('abuse-limiter:v1').digest('hex');
    const expectedId = (scope: string, key: string) => createHmac('sha256', derived).update(`${scope}\0${key}`).digest('hex');
    assert.equal(abuseKeyStamp('checkout-buyer', 'some-key'), expectedId('checkout-buyer', 'some-key'), 'stamp bytes are HMAC(derived key, scope NUL key)');
    assert.notEqual(abuseKeyStamp('checkout-buyer', 'some-key'), createHmac('sha256', base).update('checkout-buyer\0some-key').digest('hex'), 'the raw secret is not the HMAC key');
    const db = new FakeDb();
    await consumeAbuseLimit({ scope: 's', key: 'k', maxAttempts: 1, windowMs: HOUR, now: at(0) }, { db });
    assert.deepEqual([...db.docs.keys()], [`abuseLimits/s:${expectedId('s', 'k')}`], 'limiter document id uses the derived key');
    // An explicit secret is used as the HMAC key directly (the test seam), and is never logged either.
    const seamDb = new FakeDb();
    await consumeAbuseLimit({ scope: 's', key: 'k', maxAttempts: 1, windowMs: HOUR, now: at(0) }, { db: seamDb, secret: 'seam-secret' });
    assert.deepEqual([...seamDb.docs.keys()], [`abuseLimits/s:${createHmac('sha256', 'seam-secret').update('s\0k').digest('hex')}`]);

    // Nothing the limiter logs or throws contains the secret, the derived key or the raw key.
    const lines: string[] = [];
    const originals = { log: console.log, info: console.info, warn: console.warn, error: console.error, debug: console.debug };
    for (const level of Object.keys(originals) as Array<keyof typeof originals>) {
      console[level] = (...args: unknown[]) => { lines.push(args.map((a) => (a instanceof Error ? `${a.name}:${a.message}:${String(a.cause)}` : typeof a === 'string' ? a : JSON.stringify(a))).join(' ')); };
    }
    const thrown: string[] = [];
    try {
      const logDb = new FakeDb();
      const logBase = { scope: 'logs', key: 'raw-key-person@example.org', maxAttempts: 1, windowMs: HOUR };
      await consumeAbuseLimit({ ...logBase, now: at(0) }, { db: logDb });
      await consumeAbuseLimit({ ...logBase, now: at(1) }, { db: logDb }); // denied: logs
      logDb.failing = true;
      await consumeAbuseLimit({ ...logBase, now: at(2) }, { db: logDb }).catch((e: Error) => thrown.push(`${e.name}:${e.message}:${String(e.cause)}`));
      delete process.env.RECOVERY_TOKEN_SECRET;
      await consumeAbuseLimit({ ...logBase, now: at(3) }, { db: new FakeDb() }).catch((e: Error) => thrown.push(`${e.name}:${e.message}`));
      assert.throws(() => abuseKeyStamp('s', 'k'), (e: Error) => { thrown.push(`${e.name}:${e.message}`); return e instanceof AbuseLimiterUnavailableError; }, 'a missing secret fails closed');
    } finally {
      Object.assign(console, originals);
      process.env.RECOVERY_TOKEN_SECRET = base;
    }
    assert.ok(lines.length > 0, 'the denial was logged (keyed id only)');
    for (const text of [...lines, ...thrown]) {
      for (const secret of [base, derived, 'seam-secret', 'raw-key-person@example.org', 'example.org']) {
        assert.ok(!text.includes(secret), `no secret, derived key or raw key in logs and errors: ${secret}`);
      }
    }
    delete process.env.RECOVERY_TOKEN_SECRET;
  }

  // 7c. The two forwarded-header helpers. The trusted one needs two hops; the original keeps its
  //     single-entry behaviour for its other (SAOC lane) callers.
  {
    const clientIp = await import(path.join(ROOT, 'lib/client-ip.ts'));
    const trusted = clientIp.trustedClientIpFromForwardedFor as (header: string | null | undefined) => string | null;
    assert.equal(trusted('203.0.113.9, 35.191.0.1'), '203.0.113.9');
    assert.equal(trusted('1.1.1.1, 203.0.113.9, 35.191.0.1'), '203.0.113.9');
    assert.equal(trusted(' 6.6.6.6 ,, 9.9.9.9 , 10.0.0.1 '), '9.9.9.9');
    for (const header of [null, undefined, '', '   ', '203.0.113.9', ' 203.0.113.9 ', '203.0.113.9,', ' , 203.0.113.9', ',,']) {
      assert.equal(trusted(header), null, `fewer than two hops is untrusted: ${JSON.stringify(header)}`);
    }
    assert.equal(clientIp.clientIpFromForwardedFor('203.0.113.9'), '203.0.113.9', 'the shared helper still returns a lone entry');
    assert.equal(clientIp.clientIpFromForwardedFor('1.1.1.1, 203.0.113.9, 35.191.0.1'), '203.0.113.9');
    assert.equal(clientIp.clientIpFromForwardedFor(''), null);
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
