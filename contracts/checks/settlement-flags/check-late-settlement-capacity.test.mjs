// lib/late-settlement-capacity.ts (the CMS capacity loader) against a faked Sanity client, and
// the pure over-capacity planner it feeds (pooled shared capacity, per-day cap, legacy
// no-chosenDay carve-out).
//
// Run as: npx tsx --test --experimental-test-module-mocks \
//   contracts/checks/settlement-flags/check-late-settlement-capacity.test.mjs

import assert from 'node:assert/strict';
import { beforeEach, mock, test } from 'node:test';

const sanity = { docs: {}, siblings: {}, throws: false, calls: [] };

mock.module(new URL('../../../sanity/lib/client.ts', import.meta.url).href, {
  exports: {
    client: {
      fetch: async (_query, params, options) => {
        sanity.calls.push({ params, signal: options?.signal });
        if (sanity.throws) throw new Error('sanity down');
        if (params.slug !== undefined) return sanity.docs[params.slug] ?? null;
        return sanity.siblings[params.pool] ?? [];
      },
    },
  },
});

const { loadLateSettlementCapacity } = await import('../../../lib/late-settlement-capacity.ts');
const { isOverCapacityAfterLateSettlement } = await import('../../../lib/late-settlement.ts');
const { DAY_VISITOR_SHAPED_SLUGS } = await import('../../../lib/provisional-figures.ts');

const SHOW_ID = 'show-1';
const doc = (overrides = {}) => ({
  capacity: 10,
  releasedQuantity: null,
  requiresDaySelection: false,
  capacityPool: null,
  headcountPerUnit: 1,
  ...overrides,
});

beforeEach(() => {
  Object.assign(sanity, { docs: {}, siblings: {}, throws: false, calls: [] });
  mock.method(console, 'warn', () => {});
});

test('unpooled type: ceiling is capacity capped by releasedQuantity', async () => {
  sanity.docs['general-admission'] = doc({ capacity: 50, releasedQuantity: 20 });
  const capacity = await loadLateSettlementCapacity({
    showId: SHOW_ID,
    positions: [{ ticketType: 'general-admission', chosenDay: null }],
  });
  assert.deepEqual(capacity.capacityByType, { 'general-admission': 20 });
  assert.deepEqual(capacity.poolConfigByType, {
    'general-admission': { pool: null, headcountPerUnit: 1 },
  });
  assert.deepEqual(capacity.dayCapRequestedQtyByType, {});
});

test('pooled type: shared pool key, headcount weight and pool siblings are registered', async () => {
  sanity.docs['cocktails-couple'] = doc({ capacity: 40, capacityPool: 'cocktails', headcountPerUnit: 2 });
  sanity.siblings.cocktails = [
    { slug: 'cocktails-couple', headcountPerUnit: 2 },
    { slug: 'cocktails-single', headcountPerUnit: 1 },
  ];
  const capacity = await loadLateSettlementCapacity({
    showId: SHOW_ID,
    positions: [{ ticketType: 'cocktails-couple', chosenDay: null }],
  });
  assert.deepEqual(capacity.capacityByType, { cocktails: 40 });
  assert.deepEqual(capacity.poolConfigByType['cocktails-couple'], { pool: 'cocktails', headcountPerUnit: 2 });
  assert.deepEqual(capacity.poolConfigByType['cocktails-single'], { pool: 'cocktails', headcountPerUnit: 1 });
  assert.deepEqual(sanity.calls.find((c) => c.params.pool).params, { pool: 'cocktails', showId: SHOW_ID });
});

test('per-day cap: day-visitor capacity is read and every shaped slug joins the day pool', async () => {
  const shaped = DAY_VISITOR_SHAPED_SLUGS.find((slug) => slug !== 'day-visitor');
  assert.ok(shaped, 'there is a day-visitor-shaped product besides day-visitor itself');
  sanity.docs[shaped] = doc({ capacity: 500, requiresDaySelection: true });
  sanity.docs['day-visitor'] = doc({ capacity: 1000, requiresDaySelection: true });
  const capacity = await loadLateSettlementCapacity({
    showId: SHOW_ID,
    positions: [{ ticketType: shaped, chosenDay: '2027-09-24' }],
  });
  assert.deepEqual(capacity.dayCapCapacityByType, { 'day-visitor::2027-09-24': 1000 });
  assert.deepEqual(capacity.dayCapRequestedQtyByType, { [`${shaped}::2027-09-24`]: 1 });
  for (const slug of DAY_VISITOR_SHAPED_SLUGS) {
    assert.deepEqual(capacity.dayCapPoolConfigByType[`${slug}::2027-09-24`], {
      pool: 'day-visitor::2027-09-24',
      headcountPerUnit: 1,
    });
  }
  assert.equal('day-visitor' in capacity.capacityByType, false, 'no unqualified pool for day-visitor');
});

test('the abort signal reaches every CMS request', async () => {
  sanity.docs['cocktails-couple'] = doc({ capacityPool: 'cocktails' });
  const controller = new AbortController();
  await loadLateSettlementCapacity({
    showId: SHOW_ID,
    positions: [{ ticketType: 'cocktails-couple', chosenDay: null }],
    signal: controller.signal,
  });
  assert.ok(sanity.calls.length >= 2);
  assert.ok(sanity.calls.every((call) => call.signal === controller.signal));
});

test('missing, unusable or unreachable CMS data gives null, never a throw', async () => {
  const positions = [{ ticketType: 'general-admission', chosenDay: null }];
  assert.equal(await loadLateSettlementCapacity({ showId: SHOW_ID, positions }), null, 'missing type');
  sanity.docs['general-admission'] = doc({ capacity: 'lots' });
  assert.equal(await loadLateSettlementCapacity({ showId: SHOW_ID, positions }), null, 'unusable capacity');
  sanity.docs['general-admission'] = doc({ headcountPerUnit: 0 });
  assert.equal(await loadLateSettlementCapacity({ showId: SHOW_ID, positions }), null, 'unusable headcount');
  sanity.throws = true;
  assert.equal(await loadLateSettlementCapacity({ showId: SHOW_ID, positions }), null, 'CMS down');
});

const POOLED = {
  capacityByType: { cocktails: 4 },
  poolConfigByType: {
    'cocktails-couple': { pool: 'cocktails', headcountPerUnit: 2 },
    'cocktails-single': { pool: 'cocktails', headcountPerUnit: 1 },
  },
  dayCapRequestedQtyByType: {},
  dayCapCapacityByType: {},
  dayCapPoolConfigByType: {},
};

test('planner, pooled: sold heads in the shared pool plus this order decide over-capacity', () => {
  const positions = [{ ticketType: 'cocktails-couple', chosenDay: null }];
  const base = { positions, capacity: POOLED, soldCountsByDay: null };
  // 1 couple (2 heads) + 1 single sold = 3 heads, this couple adds 2 = 5 > 4.
  assert.equal(
    isOverCapacityAfterLateSettlement({ ...base, soldCounts: { 'cocktails-couple': 1, 'cocktails-single': 1 } }),
    true
  );
  // 1 couple sold = 2 heads, this couple adds 2 = 4 <= 4.
  assert.equal(isOverCapacityAfterLateSettlement({ ...base, soldCounts: { 'cocktails-couple': 1 } }), false);
});

test('planner, per-day cap: a full day is over, another day is not, legacy undated sales count everywhere', () => {
  const shaped = DAY_VISITOR_SHAPED_SLUGS.find((slug) => slug !== 'day-visitor');
  const day = '2027-09-24';
  const capacity = {
    capacityByType: { [shaped]: 500 },
    poolConfigByType: { [shaped]: { pool: null, headcountPerUnit: 1 } },
    dayCapRequestedQtyByType: { [`${shaped}::${day}`]: 1 },
    dayCapCapacityByType: { [`day-visitor::${day}`]: 3 },
    dayCapPoolConfigByType: Object.fromEntries(
      DAY_VISITOR_SHAPED_SLUGS.map((slug) => [
        `${slug}::${day}`,
        { pool: `day-visitor::${day}`, headcountPerUnit: 1 },
      ])
    ),
  };
  const positions = [{ ticketType: shaped, chosenDay: day }];
  const check = (soldCountsByDay) =>
    isOverCapacityAfterLateSettlement({ positions, capacity, soldCounts: {}, soldCountsByDay });
  assert.equal(check({ [`day-visitor::${day}`]: 3 }), true, 'three sold that day plus this one');
  assert.equal(check({ [`day-visitor::${day}`]: 2 }), false);
  assert.equal(check({ 'day-visitor::2027-09-25': 3 }), false, 'a different day does not count');
  assert.equal(check({ [shaped]: 3 }), true, 'legacy sales with no chosenDay count against every day');
});
