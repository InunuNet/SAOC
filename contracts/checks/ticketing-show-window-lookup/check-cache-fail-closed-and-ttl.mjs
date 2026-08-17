#!/usr/bin/env node
// ticketing-show-window-lookup (A4) — ShowWindowCache: (a) a throwing or null-resolving
// source must never surface as anything but a refused (null) read, and (b) a cache entry
// must never be served once it is SHOW_WINDOW_CACHE_TTL_MS or older — a stale cache serving a
// lapsed window past its own bound is exactly the security defect the dispatch named
// ("a stale cache that keeps a lapsed window alive"). Injected time throughout — no
// Date.now(), no network, no real Sanity/Firestore.
//
// DEFEATING MUTATION (fail-closed half): a source that throws propagating out of
// ensureFresh()/read() instead of being caught and treated as "no window"; or a null source
// result being coerced into some default window instead of passed through as null.
//
// DEFEATING MUTATION (TTL half): `read()` comparing entry age with `>` instead of `>=`,
// serving one extra read at the exact boundary instant; or `read()` not checking staleness at
// all and serving whatever `ensureFresh` last wrote regardless of age.
//
// Run as: node --import tsx/esm contracts/checks/ticketing-show-window-lookup/check-cache-fail-closed-and-ttl.mjs

import { ShowWindowCache, SHOW_WINDOW_CACHE_TTL_MS } from '../../../lib/show-window-lookup.ts';

const failures = [];

const REAL_WINDOW = {
  startDate: new Date('2027-01-15T08:00:00Z'),
  endDate: new Date('2027-01-20T18:00:00Z'),
};

async function expectRead(label, cache, now, expected) {
  const result = cache.read(now);
  const got = result === null ? null : result.startDate.toISOString();
  const want = expected === null ? null : expected.startDate.toISOString();
  if (got !== want) {
    failures.push(`${label}: read() returned ${JSON.stringify(got)}, expected ${JSON.stringify(want)}.`);
  }
}

// --- Fail-closed: source resolves null (e.g. zero or >1 active shows upstream). ---
{
  const cache = new ShowWindowCache(async () => null);
  await cache.ensureFresh(new Date('2027-01-17T00:00:00Z'));
  await expectRead('source resolves null', cache, new Date('2027-01-17T00:00:00Z'), null);
}

// --- Fail-closed: source throws. Must resolve to null, and must NOT propagate. ---
{
  const cache = new ShowWindowCache(async () => {
    throw new Error('simulated Sanity network failure');
  });
  let threw = false;
  try {
    await cache.ensureFresh(new Date('2027-01-17T00:00:00Z'));
  } catch {
    threw = true;
  }
  if (threw) {
    failures.push('source throws: ensureFresh() propagated the exception instead of catching it.');
  }
  await expectRead('source throws', cache, new Date('2027-01-17T00:00:00Z'), null);
}

// --- Positive control: a real source resolves to a real window, and it is served. ---
{
  const cache = new ShowWindowCache(async () => REAL_WINDOW);
  const now = new Date('2027-01-17T00:00:00Z');
  await cache.ensureFresh(now);
  await expectRead('positive control (freshly populated)', cache, now, REAL_WINDOW);
}

// --- Never populated: ensureFresh() never called. read() must still fail closed. ---
{
  const cache = new ShowWindowCache(async () => REAL_WINDOW);
  await expectRead('never populated', cache, new Date('2027-01-17T00:00:00Z'), null);
}

// --- TTL boundary: served just under the bound, refused at/after it. ---
{
  const cache = new ShowWindowCache(async () => REAL_WINDOW);
  const populatedAt = new Date('2027-01-17T00:00:00.000Z');
  await cache.ensureFresh(populatedAt);

  const justUnder = new Date(populatedAt.getTime() + SHOW_WINDOW_CACHE_TTL_MS - 1);
  await expectRead('TTL - 1ms: still served', cache, justUnder, REAL_WINDOW);

  const exactBoundary = new Date(populatedAt.getTime() + SHOW_WINDOW_CACHE_TTL_MS);
  await expectRead('TTL exact boundary: refused, not served', cache, exactBoundary, null);

  const wellPast = new Date(populatedAt.getTime() + SHOW_WINDOW_CACHE_TTL_MS + 60_000);
  await expectRead('well past TTL: refused', cache, wellPast, null);
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: ShowWindowCache fails closed on a null-resolving or throwing source and never serves ' +
    `an entry at or beyond its ${SHOW_WINDOW_CACHE_TTL_MS}ms TTL bound.`,
);
process.exit(0);
