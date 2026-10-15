#!/usr/bin/env node
// lib/vendor-stand-return.ts resolveVendorStandReturnState() against the golden
// return-state-matrix.json with an injected loader (no Firestore, no live data). Proves the
// state is derived ONLY from the server-side stored order status; a malformed attempt id never
// reaches the loader; unknown/odd statuses fail to the retry copy and never to `paid`; a loader
// failure yields the neutral `pending`; the resolver has no way to accept a status from the URL.
//
// Run as: node contracts/checks/vendor-stand-return-url/check-return-state.mjs

import { readFileSync } from 'node:fs';

const failures = [];
const expect = (cond, msg) => { if (!cond) failures.push(msg); };

let mod;
try {
  mod = await import('../../../lib/vendor-stand-return.ts');
} catch (error) {
  console.error(`FAIL: lib/vendor-stand-return.ts is missing or does not load: ${error.message}`);
  process.exit(1);
}
const { resolveVendorStandReturnState } = mod;
const matrix = JSON.parse(readFileSync(new URL('../../../.agent/memory/project/specs/vendor-flow-fixes/goldens/f4/return-state-matrix.json', import.meta.url), 'utf8'));

for (const c of matrix.cases) {
  const calls = [];
  const loadOrderStatus = async (id) => {
    calls.push(id);
    if (c.loaderThrows) throw new Error('simulated firestore outage');
    return c.stored;
  };
  const got = await resolveVendorStandReturnState({ attemptId: matrix.validAttemptId, loadOrderStatus });
  expect(got === c.expect, `${c.id}: stored=${JSON.stringify(c.stored ?? null)} throws=${!!c.loaderThrows} -> expected ${c.expect}, got ${JSON.stringify(got)}`);
  expect(calls.length === 1 && calls[0] === matrix.validAttemptId, `${c.id}: loader must be called exactly once, with only the attempt id; calls=${JSON.stringify(calls)}`);
  expect(['paid', 'pending', 'not-completed'].includes(got), `${c.id}: result must be one of the three closed states.`);
}

for (const bad of matrix.malformedAttemptIds) {
  let calls = 0;
  const got = await resolveVendorStandReturnState({ attemptId: bad, loadOrderStatus: async () => { calls += 1; return 'paid'; } });
  expect(got === matrix.malformedExpect, `malformed ${JSON.stringify(bad)} must resolve to ${matrix.malformedExpect}, got ${got}.`);
  expect(calls === matrix.malformedLoaderCalls, `malformed ${JSON.stringify(bad)} must never reach the loader (calls=${calls}).`);
}

// Non-string attempt ids (searchParams can be string[] or undefined) are refused before the loader.
for (const bad of [undefined, null, 123, ['0123456789abcdef'], {}]) {
  let calls = 0;
  const got = await resolveVendorStandReturnState({ attemptId: bad, loadOrderStatus: async () => { calls += 1; return 'paid'; } });
  expect(got === 'not-completed' && calls === 0, `non-string attempt id ${JSON.stringify(bad)} must resolve to not-completed without a load.`);
}

// The resolver's only inputs are the attempt id and the loader: a smuggled status field is inert.
const smuggled = await resolveVendorStandReturnState({ attemptId: matrix.validAttemptId, loadOrderStatus: async () => 'failed', status: 'paid', paid: '1', token: 'x' });
expect(smuggled === 'not-completed', 'extra status/paid/token inputs must be ignored by the resolver.');

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  process.exit(1);
}
console.log(`PASS: ${matrix.cases.length} state cases, ${matrix.malformedAttemptIds.length} malformed ids and non-string ids all resolve as specified; status is server-derived only.`);
