// F5 (ticketing-conferences-and-events, M2) — proves planPooledCapacity() actually computes
// the pooled/weighted capacity check correctly, by calling it with concrete inputs and
// asserting its returned decision — not by grepping for the function's name. This is the real
// fix for the oversell defect Codex GPT-5.5 found in F2 (see
// contracts/golden/ticketing-workshops-f2/README.md "Capacity revision"): a multi-head product
// (couple = 2 heads) and a shared physical pool (the two field-trip products) must be weighed
// together, not counted independently per ticketType slug.
//
// Run as: npx tsx contracts/checks/ticketing-conferences-and-events-f5/check-pooled-capacity-behavior.mjs

import { planPooledCapacity, planCapacity } from '../../../lib/checkout-reservation.ts';

const failures = [];

function expectKind(name, result, expectedKind) {
  if (result.kind !== expectedKind) {
    failures.push(`${name}: expected kind "${expectedKind}", got "${result.kind}" (${JSON.stringify(result)})`);
  }
}

function expectOffending(name, result, expectedSlugs) {
  if (result.kind !== 'over-capacity') {
    failures.push(`${name}: expected an over-capacity result to check offending slugs, got ${result.kind}`);
    return;
  }
  const got = [...result.ticketTypes].sort();
  const want = [...expectedSlugs].sort();
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failures.push(`${name}: expected offending slugs ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
  }
}

// --- Test 1: backward compatibility ---
// With no pool config at all (every type its own singleton pool, weight 1), planPooledCapacity
// must agree exactly with the pre-existing planCapacity() on the same inputs — proves this is a
// strict generalization, not a divergent second capacity-check code path.
{
  const requestedQtyByType = { 'early-bird': 5 };
  const soldCountsByType = { 'early-bird': 3 };
  const capacityByType = { 'early-bird': 10 };

  const legacy = planCapacity({ requestedQtyByType, soldCountsByType, capacityByType });
  const pooled = planPooledCapacity({
    requestedQtyByType,
    soldCountsByType,
    capacityByType,
    poolConfigByType: {},
  });
  expectKind('backward-compat (fits)', pooled, legacy.kind);

  const requestedOver = { 'early-bird': 8 };
  const legacyOver = planCapacity({
    requestedQtyByType: requestedOver,
    soldCountsByType,
    capacityByType,
  });
  const pooledOver = planPooledCapacity({
    requestedQtyByType: requestedOver,
    soldCountsByType,
    capacityByType,
    poolConfigByType: {},
  });
  expectKind('backward-compat (over)', pooledOver, legacyOver.kind);
  expectOffending('backward-compat (over) offending slug', pooledOver, ['early-bird']);
}

// --- Test 2: Sunset Cocktails pool, exactly at the real ceiling (200 heads) must be OK ---
// 100 singles (100 heads) + 50 couples (100 heads) = 200 heads, exactly the venue ceiling.
{
  const result = planPooledCapacity({
    requestedQtyByType: { 'sunset-cocktails-single': 100, 'sunset-cocktails-couple': 50 },
    soldCountsByType: {},
    capacityByType: { 'sunset-cocktails': 200 },
    poolConfigByType: {
      'sunset-cocktails-single': { pool: 'sunset-cocktails', headcountPerUnit: 1 },
      'sunset-cocktails-couple': { pool: 'sunset-cocktails', headcountPerUnit: 2 },
    },
  });
  expectKind('cocktails exactly at ceiling (200 heads)', result, 'ok');
}

// --- Test 3: Sunset Cocktails pool, one head over the real ceiling must be REJECTED ---
{
  const result = planPooledCapacity({
    requestedQtyByType: { 'sunset-cocktails-single': 101, 'sunset-cocktails-couple': 50 },
    soldCountsByType: {},
    capacityByType: { 'sunset-cocktails': 200 },
    poolConfigByType: {
      'sunset-cocktails-single': { pool: 'sunset-cocktails', headcountPerUnit: 1 },
      'sunset-cocktails-couple': { pool: 'sunset-cocktails', headcountPerUnit: 2 },
    },
  });
  expectKind('cocktails one head over ceiling (201 heads)', result, 'over-capacity');
  expectOffending('cocktails one head over ceiling — offending slugs', result, [
    'sunset-cocktails-single',
    'sunset-cocktails-couple',
  ]);
}

// --- Test 4: Field Trip shared pool, exactly at the real ceiling (60 seats) must be OK ---
{
  const result = planPooledCapacity({
    requestedQtyByType: { 'field-trip-single': 30, 'field-trip-all-outings': 30 },
    soldCountsByType: {},
    capacityByType: { 'field-trip': 60 },
    poolConfigByType: {
      'field-trip-single': { pool: 'field-trip', headcountPerUnit: 1 },
      'field-trip-all-outings': { pool: 'field-trip', headcountPerUnit: 1 },
    },
  });
  expectKind('field-trip exactly at pool ceiling (60 seats)', result, 'ok');
}

// --- Test 5: Field Trip shared pool, one seat over must be REJECTED ---
{
  const result = planPooledCapacity({
    requestedQtyByType: { 'field-trip-single': 31, 'field-trip-all-outings': 30 },
    soldCountsByType: {},
    capacityByType: { 'field-trip': 60 },
    poolConfigByType: {
      'field-trip-single': { pool: 'field-trip', headcountPerUnit: 1 },
      'field-trip-all-outings': { pool: 'field-trip', headcountPerUnit: 1 },
    },
  });
  expectKind('field-trip one seat over pool ceiling (61 seats)', result, 'over-capacity');
}

// --- Test 6: pooled sold counts from a DIFFERENT slug in the same pool must count against a
// fresh request for another slug in that pool — this is the exact cross-slug oversell pattern
// Codex found: single alone (181) is under the single-slug's own historical baseline, but the
// pool is already carrying 20 heads from 10 previously-sold couple tickets, so 181 + 20 = 201
// must be rejected. ---
{
  const result = planPooledCapacity({
    requestedQtyByType: { 'sunset-cocktails-single': 181 },
    soldCountsByType: { 'sunset-cocktails-couple': 10 },
    capacityByType: { 'sunset-cocktails': 200 },
    poolConfigByType: {
      'sunset-cocktails-single': { pool: 'sunset-cocktails', headcountPerUnit: 1 },
      'sunset-cocktails-couple': { pool: 'sunset-cocktails', headcountPerUnit: 2 },
    },
  });
  expectKind('cross-slug pooled sold-count weighting rejects at 201 heads', result, 'over-capacity');
}

if (failures.length > 0) {
  console.error('FAIL');
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}
console.log('PASS');
process.exit(0);
