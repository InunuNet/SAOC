#!/usr/bin/env node
// ticketing-show-window-lookup (A5) — ensureFresh() must fetch AT MOST once per TTL window,
// not once per call: this is the entire justification for injecting a cache instead of
// letting hasCapability()'s hot path hit Sanity on every request. It must also genuinely
// refetch once the TTL has elapsed — a cache that never refetches would pass A4's TTL-refusal
// case by always reading "never populated," while silently never picking up a real show
// window update either. Injected time throughout — no Date.now(), no network.
//
// DEFEATING MUTATION (over-fetching half): ensureFresh() calling the source on every
// invocation regardless of freshness — defeats the entire hot-path justification for caching
// at all (see golden README, "Why caching, and why this bound").
//
// DEFEATING MUTATION (under-fetching half): ensureFresh() never re-invoking the source once
// populated, even after the TTL has clearly elapsed — silently serves a permanently frozen
// window that stops tracking the real Sanity document forever (distinct from A4's "serve
// nothing once stale," which this checks is not achieved by "never update at all").
//
// Run as: node --import tsx/esm contracts/checks/ticketing-show-window-lookup/check-refetch-on-stale.mjs

import { ShowWindowCache, SHOW_WINDOW_CACHE_TTL_MS } from '../../../lib/show-window-lookup.ts';

const failures = [];

let fetchCount = 0;
const countingSource = async () => {
  fetchCount += 1;
  return { startDate: new Date('2027-01-15T08:00:00Z'), endDate: new Date('2027-01-20T18:00:00Z') };
};

const cache = new ShowWindowCache(countingSource);
const t0 = new Date('2027-01-17T00:00:00.000Z');

await cache.ensureFresh(t0);
if (fetchCount !== 1) {
  failures.push(`after first ensureFresh(): expected 1 fetch, source was called ${fetchCount} time(s).`);
}

// Two more calls well within the TTL window — must NOT trigger a second fetch.
await cache.ensureFresh(new Date(t0.getTime() + 1_000));
await cache.ensureFresh(new Date(t0.getTime() + SHOW_WINDOW_CACHE_TTL_MS - 1));
if (fetchCount !== 1) {
  failures.push(
    `after two more ensureFresh() calls within the TTL window: expected fetch count to stay at 1, ` +
      `got ${fetchCount} — the cache is refetching on every call, defeating the hot-path justification.`,
  );
}

// A call at/after the TTL boundary MUST trigger exactly one more fetch.
await cache.ensureFresh(new Date(t0.getTime() + SHOW_WINDOW_CACHE_TTL_MS));
if (fetchCount !== 2) {
  failures.push(
    `after ensureFresh() at the TTL boundary: expected exactly 2 total fetches, got ${fetchCount} — ` +
      `the cache is not refetching once genuinely stale.`,
  );
}

// A further call still within the NEW TTL window (measured from the second fetch) must not
// trigger a third fetch.
await cache.ensureFresh(new Date(t0.getTime() + SHOW_WINDOW_CACHE_TTL_MS + 1_000));
if (fetchCount !== 2) {
  failures.push(
    `after one more ensureFresh() within the new TTL window: expected fetch count to stay at 2, ` +
      `got ${fetchCount}.`,
  );
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  `PASS: ShowWindowCache fetches at most once per ${SHOW_WINDOW_CACHE_TTL_MS}ms window and ` +
    'genuinely refetches once that window has elapsed.',
);
process.exit(0);
