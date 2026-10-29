// Behavioural golden for POST /api/tickets/checkout (SEC-02): drives the REAL route handler against
// in-memory Firestore and Sanity fakes (goldens/fakes.ts), so the ordering, the fail-closed paths,
// the pair-scoped buyer limit and the held-seat budget are proved by effect, not by text.
// Frozen by @architect. @dev implements against this and never edits it.
// Run: pnpm exec tsx .agent/memory/project/specs/sec-abuse-controls/goldens/checkout-route.golden.ts
import assert from 'node:assert/strict';
import path from 'node:path';
import { FakeFirestore, installMocks, FLAT_TICKET_TYPE, ACTIVE_SHOW, type SanityFixture } from './fakes';

const ROOT = process.env.SEC_GOLDEN_ROOT ?? path.resolve(__dirname, '../../../../../..');
const NOW = Date.now();
const MIN = 60_000;
const SECRET = 'golden-recovery-secret';
const REFUSAL = 'Too many attempts. Please try again later.';

process.env.NEXT_PUBLIC_SANITY_PROJECT_ID = 'mockproj';
process.env.SANITY_FIXTURE_MODE = 'off';
process.env.RECOVERY_TOKEN_SECRET = SECRET;
process.env.OZOW_SANDBOX_SITE_CODE = 'SITE';
process.env.OZOW_SANDBOX_PRIVATE_KEY = 'private';
process.env.OZOW_SANDBOX_API_KEY = 'api';
delete process.env.APP_CHECK_ENFORCE_CHECKOUT;

const db = new FakeFirestore();
const sanity: SanityFixture = { salesOpen: true, shows: [ACTIVE_SHOW], types: { vip: FLAT_TICKET_TYPE }, queries: [] };
installMocks(db, sanity);
const outbound: string[] = [];
globalThis.fetch = (async (input: unknown) => { outbound.push(String(input)); throw new Error('no network in this golden'); }) as typeof fetch;

const hop = (ip: string) => `9.9.9.9, ${ip}, 35.191.0.1`; // forged leading hop, client, load balancer

async function main() {
  // Loaded only after installMocks(): importing firebase-admin earlier would bypass the mock.
  const { Timestamp } = await import('firebase-admin/firestore');
  const { NextRequest } = await import('next/server');
  const { POST } = await import(path.join(ROOT, 'app/api/tickets/checkout/route.ts'));
  const limiter = await import(path.join(ROOT, 'lib/abuse-limiter.ts'));
  const buyerEmailLib = await import(path.join(ROOT, 'lib/buyer-email.ts'));

  db.seed('adminSettings', 'activePaymentGateway', { gateway: 'ozow' });
  let keyCounter = 0;
  const freshKey = () => `3f6c2a9e-1b7d-4c58-9e0a-${String(++keyCounter).padStart(12, '0')}`;

  async function post(opts: { ip?: string; email?: string; seats?: number; key?: string; headers?: Record<string, string>; jsonSpy?: { called: boolean } }) {
    const seats = opts.seats ?? 1;
    const email = opts.email ?? 'buyer@example.org';
    const body = JSON.stringify({
      showId: 'nationalShow', buyerName: 'B', buyerEmail: email,
      lineItems: Array.from({ length: seats }, () => ({ ticketType: 'vip', attendeeName: 'Att', attendeeEmail: email })),
    });
    const request = new NextRequest('http://localhost/api/tickets/checkout', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': String(Buffer.byteLength(body)),
        'Idempotency-Key': opts.key ?? freshKey(),
        'x-forwarded-for': hop(opts.ip ?? '203.0.113.9'),
        ...(opts.headers ?? {}),
      },
      body,
    });
    if (opts.jsonSpy) {
      const original = request.json.bind(request);
      request.json = (async () => { opts.jsonSpy!.called = true; return original(); }) as typeof request.json;
    }
    const response = await POST(request);
    let parsed: { error?: string } = {};
    try { parsed = await response.clone().json(); } catch { /* non-JSON body */ }
    return { status: response.status, body: parsed, headers: response.headers };
  }

  const resetState = () => {
    db.clear();
    db.seed('adminSettings', 'activePaymentGateway', { gateway: 'ozow' });
    sanity.queries.length = 0;
    outbound.length = 0;
    process.env.RECOVERY_TOKEN_SECRET = SECRET;
    delete process.env.APP_CHECK_ENFORCE_CHECKOUT;
  };
  const actorStamp = (ip: string) => limiter.abuseKeyStamp('checkout-actor', limiter.clientActorKey(hop(ip)));
  const buyerStamp = (ip: string, email: string) =>
    limiter.abuseKeyStamp('checkout-buyer', buyerEmailLib.buyerPairKey(limiter.clientActorKey(hop(ip)), email));
  const seedHeld = (n: number, fields: Record<string, unknown>, status = 'reserved', expiresAtMs: number | null = NOW + 20 * MIN) => {
    for (let i = 0; i < n; i++) {
      db.seed('tickets', `seed-${status}-${db.all('tickets').length}`, {
        showId: 'nationalShow', ticketType: 'vip', status, idempotencyKey: `seed-key-${db.all('tickets').length}`,
        ...(expiresAtMs === null ? {} : { expiresAt: Timestamp.fromMillis(expiresAtMs) }),
        ...fields,
      });
    }
  };
  const ticketCount = () => db.all('tickets').length;
  const expectRefusal = (r: { status: number; body: { error?: string }; headers: Headers }, label: string) => {
    assert.equal(r.status, 429, `${label}: status 429`);
    assert.equal(r.body.error, REFUSAL, `${label}: the existing refusal copy, nothing invented`);
    assert.match(r.headers.get('retry-after') ?? '', /^[1-9]\d*$/, `${label}: Retry-After seconds`);
  };

  // 1. Happy path, and what is stored: opaque stamps, no raw address or email in any limiter document.
  {
    resetState();
    const r = await post({});
    assert.equal(r.status, 201, 'a plain purchase succeeds end to end');
    const [ticket] = db.all('tickets');
    assert.equal(ticket.data.clientKey, actorStamp('203.0.113.9'), 'position carries the actor stamp');
    assert.equal(ticket.data.buyerKey, buyerStamp('203.0.113.9', 'buyer@example.org'), 'position carries the (actor, email) pair stamp');
    const order = db.all('orders')[0];
    assert.equal(order.data.clientKey, actorStamp('203.0.113.9'));
    assert.equal(order.data.buyerKey, buyerStamp('203.0.113.9', 'buyer@example.org'));
    const limiterDocs = JSON.stringify(db.all('abuseLimits'));
    for (const raw of ['203.0.113', 'buyer@', 'example.org']) assert.ok(!limiterDocs.includes(raw), `no raw ${raw} in limiter documents`);
    assert.equal(db.all('abuseLimits').length, 2, 'one document per limiter: per-actor and per-buyer');
    assert.equal(outbound.length, 0);
  }

  // 2. Per-actor limit (12 per 15 minutes) before anything is parsed or read.
  {
    resetState();
    const spy = { called: false };
    for (let i = 0; i < 12; i++) {
      // A rotating forged leading hop must not buy a fresh budget.
      const r = await post({ headers: { 'x-forwarded-for': `10.0.0.${i}, 203.0.113.9, 35.191.0.1`, 'Idempotency-Key': 'bad' } });
      assert.equal(r.status, 400, `request ${i + 1} is past the limiter (rejected for its idempotency key)`);
    }
    const denied = await post({ jsonSpy: spy, headers: { 'x-forwarded-for': '10.0.0.99, 203.0.113.9, 35.191.0.1' } });
    expectRefusal(denied, 'the 13th request');
    assert.equal(spy.called, false, 'a limited request is refused before its body is read');
    assert.equal(sanity.queries.length, 0, 'a limited request costs no Sanity read');
    assert.equal(ticketCount(), 0);
    const other = await post({ ip: '203.0.113.77', headers: { 'Idempotency-Key': 'bad' } });
    assert.equal(other.status, 400, 'another client is not limited');
  }

  // 3. A lone X-Forwarded-For entry is untrusted: every such caller shares the strict bucket.
  {
    resetState();
    for (let i = 0; i < 12; i++) {
      const r = await post({ headers: { 'x-forwarded-for': `5.5.5.${i}`, 'Idempotency-Key': 'bad' } });
      assert.equal(r.status, 400);
    }
    expectRefusal(await post({ headers: { 'x-forwarded-for': '6.6.6.6', 'Idempotency-Key': 'bad' } }), 'a thirteenth lone-entry caller shares the bucket');
    expectRefusal(await post({ headers: { 'x-forwarded-for': '', 'Idempotency-Key': 'bad' } }), 'no header at all is the same bucket');
  }

  // 4. Fail closed: a store failure or a missing secret refuses the request before any work.
  {
    resetState();
    db.failing = true;
    const spy = { called: false };
    const r = await post({ jsonSpy: spy });
    assert.ok(r.status === 500 || r.status === 503, `store down refuses, got ${r.status}`);
    assert.equal(spy.called, false);
    assert.equal(sanity.queries.length, 0);
    db.failing = false;
    assert.equal(ticketCount(), 0, 'nothing was reserved');

    resetState();
    delete process.env.RECOVERY_TOKEN_SECRET;
    const noSecret = await post({ jsonSpy: spy });
    assert.ok(noSecret.status === 500 || noSecret.status === 503, `missing limiter secret refuses, got ${noSecret.status}`);
    assert.equal(sanity.queries.length, 0);
    assert.equal(ticketCount(), 0);
    process.env.RECOVERY_TOKEN_SECRET = SECRET;
  }

  // 5. Per-buyer limit is scoped to (actor, normalised email): no lockout lever, no plus-address dodge.
  {
    resetState();
    for (let i = 0; i < 6; i++) assert.equal((await post({ email: 'buyer@example.org' })).status, 201, `purchase ${i + 1} of 6`);
    const queriesBefore = sanity.queries.length;
    expectRefusal(await post({ email: 'buyer@example.org' }), 'the 7th request for the same buyer from the same address');
    expectRefusal(await post({ email: 'Buyer+promo@Example.org' }), 'a plus-address and case variant shares the budget');
    assert.equal(sanity.queries.length, queriesBefore, 'refused buyer requests cost no Sanity read');
    assert.equal((await post({ ip: '203.0.113.10', email: 'buyer@example.org' })).status, 201, 'the same email from another address is untouched (no lockout lever)');
    assert.equal((await post({ email: 'other@example.org' })).status, 201, 'another buyer on the same address is untouched');
    assert.equal(db.all('abuseLimits').length, 5, 'actor A, actor B, pair A+buyer, pair B+buyer, pair A+other: no global per-email document');
    const limiterDocs = JSON.stringify(db.all('abuseLimits'));
    for (const raw of ['203.0.113', 'buyer@', 'other@', 'example.org']) assert.ok(!limiterDocs.includes(raw), `no raw ${raw} stored`);
  }

  // 6. Held-seat budget: 40 per actor, 40 per buyer pair, decided inside the reservation transaction.
  {
    const ip = '203.0.113.9';
    const actor = actorStamp(ip);
    const buyer = buyerStamp(ip, 'buyer@example.org');
    // 6a. The cap is exact, in both directions.
    resetState(); seedHeld(40, { clientKey: actor });
    const capped = await post({ seats: 1 });
    expectRefusal(capped, '40 held + 1 requested');
    assert.equal(capped.headers.get('retry-after'), '1800', 'the refusal asks the buyer to wait out one hold');
    assert.equal(ticketCount(), 40, 'a refused budget writes nothing');
    resetState(); seedHeld(39, { clientKey: actor });
    assert.equal((await post({ seats: 1 })).status, 201, '39 held + 1 requested is allowed');
    resetState(); seedHeld(20, { clientKey: actor });
    assert.equal((await post({ seats: 20 })).status, 201, 'a second 20-seat cart inside the hold window succeeds');
    resetState(); seedHeld(21, { clientKey: actor });
    expectRefusal(await post({ seats: 20 }), '21 held + 20 requested');
    // 6b. Only live reserved seats count.
    resetState(); seedHeld(40, { clientKey: actor }, 'reserved', NOW - MIN);
    assert.equal((await post({ seats: 20 })).status, 201, 'expired holds do not count');
    resetState(); seedHeld(40, { clientKey: actor }, 'paid');
    assert.equal((await post({ seats: 20 })).status, 201, "paid seats are the capacity ledger's business, not the hold budget's");
    resetState(); seedHeld(40, { clientKey: actor }, 'cancelled');
    assert.equal((await post({ seats: 20 })).status, 201, 'cancelled seats do not count');
    resetState(); seedHeld(40, { clientKey: actorStamp('203.0.113.200') });
    assert.equal((await post({ seats: 20 })).status, 201, "another actor's holds do not count");
    resetState(); seedHeld(40, { clientKey: actor }, 'reserved', null);
    expectRefusal(await post({ seats: 1 }), 'a reserved seat with no expiry still holds (fail closed)');
    resetState(); seedHeld(40, { clientKey: actor, expiresAt: { toMillis: () => NOW - MIN } }, 'reserved', null);
    expectRefusal(await post({ seats: 1 }), 'a duck-typed expiry never releases a seat');
    // 6c. The buyer budget is per (actor, email) pair.
    resetState(); seedHeld(40, { clientKey: actorStamp('203.0.113.201'), buyerKey: buyer });
    expectRefusal(await post({ seats: 1 }), '40 held under this buyer pair');
    assert.equal((await post({ seats: 1, ip: '203.0.113.10' })).status, 201, 'the same email from another address has its own held-seat budget');
    assert.equal((await post({ seats: 1, email: 'other@example.org' })).status, 201, 'another buyer on this address is untouched');
    // 6d. A replay of an already-held reservation is never refused by the seats it holds.
    resetState(); seedHeld(20, { clientKey: actor });
    const replayKey = freshKey();
    assert.equal((await post({ seats: 20, key: replayKey })).status, 201);
    assert.equal(ticketCount(), 40);
    const replay = await post({ seats: 20, key: replayKey });
    assert.equal(replay.status, 200, 'the replay answers 200, it is not refused at the cap');
    assert.equal(ticketCount(), 40, 'a replay reserves nothing new');
    // 6d'. The held-seat reads happen inside the reservation transaction, never as a plain query
    //      outside it (a read outside the transaction is a check-then-act hole).
    assert.ok(
      db.plainQueries.every((filters) => !filters.some((f) => f.field === 'clientKey' || f.field === 'buyerKey')),
      'the held-seat queries by clientKey and buyerKey must go through transaction.get',
    );
    // 6e. Two concurrent requests from one actor cannot both pass a nearly-full budget (1 held
    //     leaves room for exactly one 20-seat cart: 1 + 20 = 21, a second would make 41).
    resetState(); seedHeld(1, { clientKey: actor });
    const [first, second] = await Promise.all([
      post({ seats: 20, email: 'a@example.org' }),
      post({ seats: 20, email: 'b@example.org' }),
    ]);
    assert.deepEqual([first.status, second.status].sort(), [201, 429], 'exactly one of two racing 20-seat carts wins');
    assert.equal(ticketCount(), 21, 'the actor never holds more than 40 live seats (1 seeded + 20)');
  }

  // 7. App Check: the per-actor limit runs first, then App Check, both before the body is read.
  {
    resetState();
    process.env.APP_CHECK_ENFORCE_CHECKOUT = 'true';
    const spy = { called: false };
    const tokenless = await post({ jsonSpy: spy });
    assert.equal(tokenless.status, 403, 'enforced App Check refuses a tokenless checkout');
    assert.equal(spy.called, false, 'refused before the body is read');
    assert.equal(sanity.queries.length, 0);
    assert.equal(ticketCount(), 0);
    for (let i = 0; i < 11; i++) assert.equal((await post({})).status, 403);
    expectRefusal(await post({ jsonSpy: spy }), 'the actor limit fires before App Check is consulted');
    delete process.env.APP_CHECK_ENFORCE_CHECKOUT;
  }

  assert.equal(outbound.length, 0, 'no network use anywhere in this golden');
  console.log('checkout-route golden: PASS');
}

main().catch((error) => {
  console.error('checkout-route golden: FAIL');
  console.error(error);
  process.exit(1);
});
