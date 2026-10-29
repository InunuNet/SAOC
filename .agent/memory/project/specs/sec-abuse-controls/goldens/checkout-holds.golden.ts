// Golden for lib/checkout-holds.ts (SEC-02): the numbers and the pure held-seat budget.
// Frozen by @architect. @dev implements against this and never edits it.
// Run: pnpm exec tsx .agent/memory/project/specs/sec-abuse-controls/goldens/checkout-holds.golden.ts
import assert from 'node:assert/strict';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../../../..');
const ts = (ms: number) => ({ toMillis: () => ms });

async function main() {
  const holds = await import(path.join(ROOT, 'lib/checkout-holds.ts'));
  const { CHECKOUT_LIMITS, summariseHeldSeats, evaluateHoldBudget } = holds;
  const NOW = 1_800_000_000_000;

  // 1. The named numbers (spec.md D2-D4). Changing one is a spec change, not a code tweak.
  assert.deepEqual(
    { ...CHECKOUT_LIMITS },
    {
      ipRequests: 12,
      ipWindowMs: 15 * 60_000,
      buyerRequests: 6,
      buyerWindowMs: 3_600_000,
      actorMaxHeldSeats: 40,
      actorMaxHeldPerType: 40,
      buyerMaxHeldSeats: 40,
    },
  );
  assert.ok(Object.isFrozen(CHECKOUT_LIMITS), 'limits are frozen');

  // 2. summariseHeldSeats counts only live reserved seats; mirrors stillHoldsSeat() fail-closed.
  {
    const summary = summariseHeldSeats(
      [
        { ticketType: 'vip', status: 'reserved', expiresAt: ts(NOW + 1) }, // live
        { ticketType: 'vip', status: 'reserved', expiresAt: ts(NOW) }, // expired exactly now: not held
        { ticketType: 'vip', status: 'reserved', expiresAt: ts(NOW - 1) }, // expired
        { ticketType: 'vip', status: 'paid', expiresAt: ts(NOW + 999) }, // paid is not a hold
        { ticketType: 'vip', status: 'cancelled', expiresAt: ts(NOW + 999) },
        { ticketType: 'weekend', status: 'reserved', expiresAt: null }, // no expiry: counts (fail closed)
        { ticketType: 'weekend', status: 'reserved', expiresAt: ts(NOW + 5) },
      ],
      NOW,
    );
    assert.deepEqual(summary, { total: 3, byType: { vip: 1, weekend: 2 } });
    assert.deepEqual(summariseHeldSeats([], NOW), { total: 0, byType: {} });
  }

  // 3. Legitimate purchases are never refused.
  const none = { total: 0, byType: {} };
  assert.deepEqual(evaluateHoldBudget({ requestedByType: { vip: 20 }, heldByActor: none, heldByBuyer: none }), { ok: true }, 'one maximal cart (CART_MAX_LINE_ITEMS = 20) from a clean actor');
  assert.deepEqual(
    evaluateHoldBudget({ requestedByType: { vip: 20 }, heldByActor: { total: 20, byType: { vip: 20 } }, heldByBuyer: { total: 20, byType: { vip: 20 } } }),
    { ok: true },
    'a buyer who abandoned one full cart can still start a second (exactly 40 held)',
  );

  // 4. The caps bite at exactly cap + 1, with the first matching reason.
  assert.deepEqual(
    evaluateHoldBudget({ requestedByType: { vip: 1 }, heldByActor: { total: 40, byType: { vip: 20, weekend: 20 } }, heldByBuyer: none }),
    { ok: false, reason: 'actor-total' },
  );
  assert.deepEqual(
    evaluateHoldBudget({ requestedByType: { vip: 21, weekend: 20 }, heldByActor: none, heldByBuyer: none }),
    { ok: false, reason: 'actor-total' },
    'a single request over the actor cap is refused outright',
  );
  assert.deepEqual(
    evaluateHoldBudget({ requestedByType: { vip: 1 }, heldByActor: none, heldByBuyer: { total: 40, byType: { vip: 40 } } }),
    { ok: false, reason: 'buyer-total' },
  );
  assert.deepEqual(
    evaluateHoldBudget({
      requestedByType: { vip: 3 },
      heldByActor: { total: 5, byType: { vip: 5 } },
      heldByBuyer: none,
      limits: { ...CHECKOUT_LIMITS, actorMaxHeldPerType: 7 },
    }),
    { ok: false, reason: 'actor-type' },
    'the per-product cap is enforced independently of the total (cap injectable for F6 and for this test)',
  );
  assert.deepEqual(
    evaluateHoldBudget({
      requestedByType: { vip: 2 },
      heldByActor: { total: 5, byType: { vip: 5 } },
      heldByBuyer: none,
      limits: { ...CHECKOUT_LIMITS, actorMaxHeldPerType: 7 },
    }),
    { ok: true },
    'exactly at the per-product cap is allowed',
  );

  console.log('checkout-holds golden: PASS');
}

main().catch((error) => {
  console.error('checkout-holds golden: FAIL');
  console.error(error);
  process.exit(1);
});
