// Golden for lib/seat-holds.ts: the single seat-hold expiry rule shared by the capacity ledger
// (lib/data/tickets.ts) and the checkout hold budget. Proves that a reservation past its
// expiresAt stops holding a seat by itself at read time, with no scheduler, sweeper or
// reconcile run involved (live finding 2026-10-29: 31 of 48 prod orders sit in `reserved`).
// Frozen by @architect. @dev implements against this and never edits it.
// Run: pnpm exec tsx .agent/memory/project/specs/sec-abuse-controls/goldens/seat-holds.golden.ts
import assert from 'node:assert/strict';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../../../..');
const ts = (ms: number) => ({ toMillis: () => ms });
const NOW = 1_800_000_000_000;
const HOUR = 3_600_000;

async function main() {
  const mod = await import(path.join(ROOT, 'lib/seat-holds.ts'));
  const { stillHoldsSeat, tallySeatHolds } = mod;

  // 1. The rule, case by case (mirrors the original stillHoldsSeat in lib/data/tickets.ts).
  assert.equal(stillHoldsSeat({ status: 'paid', expiresAt: ts(NOW - HOUR) }, NOW), true, 'paid is never released by expiry');
  assert.equal(stillHoldsSeat({ status: 'reserved', expiresAt: ts(NOW + 1) }, NOW), true);
  assert.equal(stillHoldsSeat({ status: 'reserved', expiresAt: ts(NOW) }, NOW), false, 'expired exactly now');
  assert.equal(stillHoldsSeat({ status: 'reserved', expiresAt: ts(NOW - 1) }, NOW), false);
  assert.equal(stillHoldsSeat({ status: 'reserved' }, NOW), true, 'no expiresAt: fails closed, still holds');
  assert.equal(stillHoldsSeat({ status: 'reserved', expiresAt: null }, NOW), true);
  assert.equal(stillHoldsSeat({ status: 'reserved', expiresAt: 'tomorrow' }, NOW), true, 'non-timestamp expiry fails closed');

  // 2. Stranded reservations (expired, never settled, no reconcile run) hold nothing.
  {
    const docs = [
      ...Array.from({ length: 31 }, () => ({ ticketType: 'weekend-pass', status: 'reserved', expiresAt: ts(NOW - 5 * HOUR) })),
      { ticketType: 'weekend-pass', status: 'reserved', expiresAt: ts(NOW + 10 * 60_000) }, // live cart
      { ticketType: 'weekend-pass', status: 'reserved', expiresAt: ts(NOW + 72 * HOUR) }, // gateway-Pending hold (kept by design)
      { ticketType: 'vip', status: 'reserved', expiresAt: ts(NOW + 1000) },
      { ticketType: 'weekend-pass', status: 'paid', expiresAt: ts(NOW - 9 * HOUR) }, // paid after its hold lapsed still wins the seat
      { ticketType: 'vip', status: 'paid', expiresAt: null },
    ];
    assert.deepEqual(tallySeatHolds(docs, NOW), { 'weekend-pass': 3, vip: 2 });
    assert.deepEqual(tallySeatHolds(docs, NOW + 73 * HOUR), { 'weekend-pass': 1, vip: 1 }, 'later still: only paid seats remain');
  }

  // 3. Only reserved and paid positions are tallied; other statuses are not seats.
  assert.deepEqual(
    tallySeatHolds([{ ticketType: 'vip', status: 'cancelled', expiresAt: ts(NOW + HOUR) }, { ticketType: 'vip', status: 'checked-in' }], NOW),
    {},
  );

  // 4. Pure: the input is not mutated and the call needs no clock of its own.
  const frozen = Object.freeze([Object.freeze({ ticketType: 'vip', status: 'reserved', expiresAt: ts(NOW + 5) })]);
  assert.deepEqual(tallySeatHolds(frozen, NOW), { vip: 1 });

  console.log('seat-holds golden: PASS');
}

main().catch((error) => {
  console.error('seat-holds golden: FAIL');
  console.error(error);
  process.exit(1);
});
