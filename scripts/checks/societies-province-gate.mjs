// /societies province chip gate. Run: npx tsx --test scripts/checks/societies-province-gate.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ALL_PROVINCES,
  allSocietiesHaveProvince,
  effectiveProvinceFilter,
} from '@/lib/societies-view';

test('every society has a province: gate open', () => {
  assert.equal(allSocietiesHaveProvince([{ province: 'WC' }, { province: 'GP' }]), true);
});

test('empty list: gate open', () => {
  assert.equal(allSocietiesHaveProvince([]), true);
});

test('null, undefined, empty and whitespace-only provinces close the gate', () => {
  const ok = { province: 'WC' };
  assert.equal(allSocietiesHaveProvince([ok, { province: null }]), false);
  assert.equal(allSocietiesHaveProvince([ok, {}]), false);
  assert.equal(allSocietiesHaveProvince([ok, { province: '' }]), false);
  assert.equal(allSocietiesHaveProvince([ok, { province: '  ' }]), false);
});

test('stale province param is ignored while the gate is closed', () => {
  assert.equal(effectiveProvinceFilter('WC', false), ALL_PROVINCES);
});

test('province param is honoured when the gate is open', () => {
  assert.equal(effectiveProvinceFilter('WC', true), 'WC');
  assert.equal(effectiveProvinceFilter(ALL_PROVINCES, true), ALL_PROVINCES);
});
