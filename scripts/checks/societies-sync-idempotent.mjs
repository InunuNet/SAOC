// societies-content regression: a re-run against live must be a no-op. Sanity stores object keys
// in its own (sorted) order, so the planner's comparison must not depend on key order.
// Run: npx tsx scripts/checks/societies-sync-idempotent.mjs
import assert from 'node:assert/strict';

import { sameValue, planSync } from '@/lib/societies/drive-sync-plan';

// The exact live shape: keys sorted, as Sanity returns them.
const live = [
  { _key: 'chair-president', _type: 'societyCommitteeMember', name: 'Gerhard Vermeulen', role: 'Chair/President' },
  { _key: 'secretary', _type: 'societyCommitteeMember', name: 'Bernard Wouda', role: 'Secretary' },
];
// The planner's shape: role/name written in a different order.
const built = live.map((m) => ({ _key: m._key, _type: m._type, role: m.role, name: m.name }));
assert.ok(sameValue(live, built), 'key order must not matter');
assert.ok(sameValue([{ ...live[0], extra: null }], [live[0]]), 'null key equals absent key');
assert.ok(!sameValue(live, [built[0]]), 'a missing member must differ');
assert.ok(!sameValue(live, [built[1], built[0]]), 'array order must still matter');
assert.ok(!sameValue(live, [{ ...built[0], name: 'Someone Else' }, built[1]]), 'a changed name must differ');

const doc = {
  name: 'Zululand Orchid Society',
  slug: { _type: 'slug', current: 'zululand-orchid-society' },
  listed: true,
  committee: built,
  contactEmail: 'gverm@telkomsa.net',
};
const existing = [{
  _id: 'society-zululand-orchid-society', _type: 'society', _rev: 'r1',
  committee: live, contactEmail: 'gverm@telkomsa.net', listed: true,
  name: 'Zululand Orchid Society', slug: { _type: 'slug', current: 'zululand-orchid-society' },
}];
const plan = planSync([doc], existing, []);
assert.deepEqual(plan.counts, { create: 0, patch: 0, hide: 0, noop: 1 }, 'live-shaped committee must be a noop');
console.log('PASS sync comparison is key-order independent (live committee shape is a noop)');
