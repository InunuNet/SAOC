// ticketing-show-window-lookup — compiler-driven (not source-grep) proof of the exported
// type shapes lib/show-window-lookup.ts must add. Run via its own scoped tsconfig (see that
// file's header) because the root tsconfig.json excludes `contracts/` from `pnpm type-check`.
//
// Proves, at compile time, what no runtime call in A3-A9 can see:
//   1. ShowWindowSource / ShowWindowCache / resolveShowWindowLookup's exact signatures match
//      this contract's spec — a real assignment either compiles or it doesn't.
//   2. resolveShowWindowLookup's return type IS `ShowWindowLookup` (lib/admin-auth.ts's own
//      exported type, reused — not a structurally-similar but distinct type) — so a route can
//      pass it straight into `hasCapability`'s `opts.lookupShowWindow` with no cast.
//   3. ShowWindowCache cannot be constructed without a source function — @ts-expect-error
//      against a zero-arg construction. A cache with no source is meaningless; this catches an
//      implementation that gave `source` a default (e.g. `() => null`), which would make an
//      un-configured cache silently well-typed AND silently always-refuse.
//
// Run as: npx tsc --noEmit -p contracts/checks/ticketing-show-window-lookup/tsconfig.typecheck.json

import type { ShowWindow, ShowWindowLookup } from '../../../../lib/admin-auth';
import {
  ShowWindowCache,
  SHOW_WINDOW_CACHE_TTL_MS,
  parseUtcDatetime,
  buildShowWindow,
  resolveShowWindowLookup,
  type ShowWindowSource,
} from '../../../../lib/show-window-lookup';

// SHOW_WINDOW_CACHE_TTL_MS must be a concrete number, not a loosely-typed constant — a named
// bound this contract's TTL checks (A4/A5) import and rely on being the SAME value the
// production cache actually uses, not a decorative constant nothing reads.
const ttlCheck: number = SHOW_WINDOW_CACHE_TTL_MS;

const fakeSource: ShowWindowSource = async () => null;

const cache = new ShowWindowCache(fakeSource);
const cacheWithTtl = new ShowWindowCache(fakeSource, 5_000);

// @ts-expect-error — a ShowWindowCache must always be constructed with an explicit source; no
// default source is permitted (see file header, point 3).
const cacheWithNoSource = new ShowWindowCache();

const ensureFreshCheck: Promise<void> = cache.ensureFresh(new Date());
const readCheck: ShowWindow | null = cache.read(new Date());

const parsedDate: Date | null = parseUtcDatetime('2027-01-15T08:00:00Z');
const builtWindow: ShowWindow | null = buildShowWindow({
  startDate: '2027-01-15T08:00:00Z',
  endDate: '2027-01-20T18:00:00Z',
});

// resolveShowWindowLookup's return type is admin-auth.ts's own ShowWindowLookup, reused, not
// merely a compatible-shaped alias — this assignment is the compiler proof of that reuse.
async function assignabilityCheck(): Promise<void> {
  const lookup: ShowWindowLookup = await resolveShowWindowLookup('nationalShow', new Date());
  const injectedLookup: ShowWindowLookup = await resolveShowWindowLookup('nationalShow', new Date(), {
    cache,
  });
  void lookup;
  void injectedLookup;
}

export {
  ttlCheck,
  cacheWithTtl,
  cacheWithNoSource,
  ensureFreshCheck,
  readCheck,
  parsedDate,
  builtWindow,
  assignabilityCheck,
};
