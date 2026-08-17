#!/usr/bin/env node
// ticketing-show-window-lookup (A6) — resolveShowWindowLookup(showId, now)'s returned
// ShowWindowLookup closure must be scoped to exactly the `showId` it was built for. Calling
// it with a DIFFERENT showId string must return null even though the cache holds a real,
// fresh, populated window — defence-in-depth against a lookup closure being reused or
// copy-pasted across a route that handles more than one show scope. Uses an injected
// ShowWindowCache (via the `deps.cache` override) backed by a fake source — no network.
//
// Also documents, and proves, the load-bearing identifier-space fact from
// contracts/golden/ticketing-f1-show-collision/README.md: `showId` here is the Firestore
// role-scoping value (lib/tickets-constants.ts's NATIONAL_SHOW_ID), never a Sanity document
// `_id` — resolveShowWindowLookup's fake source in this check deliberately returns a window
// keyed to nothing but "the one active show," proving the function never tries to look up a
// Sanity document BY the showId string itself (see golden README, "Why showId is not a Sanity
// _id" — a check that fed a Sanity-_id-shaped showId here and expected it to matter would be
// testing the wrong identifier space entirely).
//
// DEFEATING MUTATION: resolveShowWindowLookup's returned closure ignoring the `showId`
// argument it's called with and always returning the cached window regardless — the exact
// shape of bug that would let a manager grant scoped to one show silently apply to another.
//
// Run as: node --import tsx/esm contracts/checks/ticketing-show-window-lookup/check-showid-scoping.mjs

import { ShowWindowCache, resolveShowWindowLookup } from '../../../lib/show-window-lookup.ts';

const failures = [];

const REAL_WINDOW = {
  startDate: new Date('2027-01-15T08:00:00Z'),
  endDate: new Date('2027-01-20T18:00:00Z'),
};

const now = new Date('2027-01-17T00:00:00Z');
const cache = new ShowWindowCache(async () => REAL_WINDOW);
await cache.ensureFresh(now);

const lookup = await resolveShowWindowLookup('nationalShow', now, { cache });

const scopedResult = lookup('nationalShow');
if (scopedResult === null || scopedResult.startDate.getTime() !== REAL_WINDOW.startDate.getTime()) {
  failures.push(
    `lookup('nationalShow') (the scoped showId): expected the real window, got ${JSON.stringify(scopedResult)}.`,
  );
}

const unscopedResult = lookup('some-other-show-id');
if (unscopedResult !== null) {
  failures.push(
    `lookup('some-other-show-id') (NOT the scoped showId): expected null, got ${JSON.stringify(unscopedResult)} ` +
      '— the closure is ignoring the showId argument and serving the cached window regardless.',
  );
}

// The exact string used as NATIONAL_SHOW_ID is 'nationalShow' — a Firestore scoping value,
// not a Sanity _id. Prove a Sanity-_id-shaped showId (e.g. an actual `show` document _id from
// this project's real dataset, per ticketing-f1-show-collision's README) is ALSO refused when
// it isn't the scoped value — resolveShowWindowLookup must never special-case a
// Sanity-_id-looking string.
const sanityIdShapedResult = lookup('show-19-2027');
if (sanityIdShapedResult !== null) {
  failures.push(
    `lookup('show-19-2027') (a real Sanity show _id, but not the scoped showId): expected null, ` +
      `got ${JSON.stringify(sanityIdShapedResult)}.`,
  );
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  "PASS: resolveShowWindowLookup()'s returned closure serves the real window only for the " +
    'exact showId it was scoped to, and refuses every other showId string — including one ' +
    "shaped like a real Sanity document _id — even while the cache holds a populated window.",
);
process.exit(0);
