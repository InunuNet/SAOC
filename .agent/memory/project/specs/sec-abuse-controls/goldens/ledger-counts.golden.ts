// Behavioural golden for the capacity ledger in lib/data/tickets.ts (SEC-02 expiry rule): both
// counting functions release a `reserved` seat the moment its Timestamp expiresAt passes, keep
// paid seats and fail-closed (no expiry / non-Timestamp expiry) holds, and agree with each other.
// Drives the REAL functions against the in-memory Firestore fake; no scheduler or reconcile run.
// Frozen by @architect. @dev implements against this and never edits it.
// Run: pnpm exec tsx .agent/memory/project/specs/sec-abuse-controls/goldens/ledger-counts.golden.ts
import assert from 'node:assert/strict';
import path from 'node:path';
import { FakeFirestore, installMocks, type SanityFixture } from './fakes';

const ROOT = process.env.SEC_GOLDEN_ROOT ?? path.resolve(__dirname, '../../../../../..');
const db = new FakeFirestore();
const sanity: SanityFixture = { salesOpen: true, shows: [], types: {}, queries: [] };
installMocks(db, sanity);

async function main() {
  const { Timestamp } = await import('firebase-admin/firestore');
  const { getSoldCountsByTicketType, getSoldCountsByTicketTypeAndDay } = await import(path.join(ROOT, 'lib/data/tickets.ts'));
  const now = Date.now();
  const HOUR = 3_600_000;
  const ts = (ms: number) => Timestamp.fromMillis(ms);
  let n = 0;
  const seat = (fields: Record<string, unknown>) => db.seed('tickets', `t${n++}`, { showId: 'nationalShow', ticketType: 'vip', ...fields });

  for (let i = 0; i < 31; i++) seat({ status: 'reserved', expiresAt: ts(now - 5 * HOUR) }); // stranded, expired
  seat({ status: 'reserved', expiresAt: ts(now + HOUR) }); // live cart
  seat({ status: 'reserved', expiresAt: ts(now + 72 * HOUR) }); // gateway-Pending hold
  seat({ status: 'reserved' }); // legacy: no expiry, holds forever
  seat({ status: 'reserved', expiresAt: 'tomorrow' }); // non-timestamp: fails closed
  seat({ status: 'reserved', expiresAt: { toMillis: () => now - HOUR } }); // duck-typed: fails closed
  seat({ status: 'paid', expiresAt: ts(now - 9 * HOUR) }); // paid after its hold lapsed still wins the seat
  seat({ status: 'cancelled', expiresAt: ts(now + HOUR) });
  seat({ status: 'failed' });
  seat({ status: 'reserved', expiresAt: ts(now + HOUR), showId: 'someOtherShow' });
  seat({ status: 'reserved', ticketType: 'weekend-pass', chosenDay: '2099-03-11', expiresAt: ts(now + HOUR) });
  seat({ status: 'reserved', ticketType: 'weekend-pass', chosenDay: '2099-03-12', expiresAt: ts(now - HOUR) }); // expired: not counted
  seat({ status: 'paid', ticketType: 'weekend-pass', chosenDay: '2099-03-11' });

  const expected = { vip: 6, 'weekend-pass': 2 };

  // Outside a transaction and inside one (the checkout path) the answer is the same.
  assert.deepEqual(await getSoldCountsByTicketType('nationalShow'), expected, 'stranded and cancelled seats hold nothing; live, Pending, legacy, fail-closed and paid seats do');
  const inside = await db.runTransaction((tx) => getSoldCountsByTicketType('nationalShow', tx as never));
  assert.deepEqual(inside, expected);

  const byDay = await getSoldCountsByTicketTypeAndDay('nationalShow', new Set(['weekend-pass']));
  assert.deepEqual(byDay, { vip: 6, 'weekend-pass::2099-03-11': 2 }, 'the day-qualified counter applies the same expiry rule');
  const byDayInside = await db.runTransaction((tx) => getSoldCountsByTicketTypeAndDay('nationalShow', new Set(['weekend-pass']), tx as never));
  assert.deepEqual(byDayInside, byDay);

  console.log('ledger-counts golden: PASS');
}

main().catch((error) => {
  console.error('ledger-counts golden: FAIL');
  console.error(error);
  process.exit(1);
});
