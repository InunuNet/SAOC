// Relative, not '@/'-aliased: A3-A8's check scripts import this module directly via
// `tsx/esm`, outside of Next.js's own module resolution, which is the only place the
// '@/*' path alias (tsconfig.json) is honoured at runtime. lib/comp-tickets.ts's '@/'
// imports get away with the alias only because they are `import type` (erased entirely
// at compile time); these are real value imports, so they must resolve without it.
import { client } from '../sanity/lib/client';
import { activeShowWindowQuery } from '../sanity/queries';

import type { ShowWindow, ShowWindowLookup } from './admin-auth';
import { resolveActiveShow, type ShowActivationFields } from './show-resolution';

/**
 * F13 (ticketing-foundation), blocking F13 (P1, escalated 2026-08-17). See
 * contracts/golden/ticketing-show-window-lookup/README.md for the full decision record —
 * caching posture, timezone posture, and the showId-vs-Sanity-_id identifier-space
 * distinction. This file closes the gap left by lib/admin-auth.ts:199's `() => null`
 * default ShowWindowLookup: no production implementation existed, so every per-show role
 * grant (e.g. a manager role scoped to a single show) was refused unconditionally, even
 * inside its own date window.
 */

/** A zero-arg data source for "the currently active show's date window, or null." Scoping by
 *  `showId` happens one level up, in `resolveShowWindowLookup` — see the golden README's
 *  "Why `showId` is not a Sanity `_id`" for why this deliberately does NOT take a showId. */
export type ShowWindowSource = () => Promise<ShowWindow | null>;

/** How long a cached show window is served before `ensureFresh` refetches and `read` refuses
 *  to serve the stale entry. Enforced at both the write (ensureFresh) and the read boundary
 *  (read), so a caller that skips ensureFresh can never see an arbitrarily stale window. */
export const SHOW_WINDOW_CACHE_TTL_MS = 60_000;

interface ShowWindowCacheEntry {
  window: ShowWindow | null;
  fetchedAt: Date;
}

/**
 * A single-source, TTL-bounded cache for one `ShowWindowSource`. Constructed with an explicit
 * `source` — no default — because an un-configured cache would be meaningless and would
 * silently always-refuse. Production code shares one instance via
 * `getProductionShowWindowCache()`; tests construct independent instances with injected
 * sources/TTLs so no state leaks between them.
 */
export class ShowWindowCache {
  private entry: ShowWindowCacheEntry | null = null;

  constructor(
    private readonly source: ShowWindowSource,
    private readonly ttlMs: number = SHOW_WINDOW_CACHE_TTL_MS
  ) {}

  private isStale(now: Date): boolean {
    if (!this.entry) return true;
    return now.getTime() - this.entry.fetchedAt.getTime() >= this.ttlMs;
  }

  /** Fetches from `source` only when no entry exists or the existing entry is at least
   *  `ttlMs` old at `now`. Any thrown error from `source` is caught, logged, and treated
   *  identically to a null result — it never propagates out of this method. */
  async ensureFresh(now: Date): Promise<void> {
    if (!this.isStale(now)) return;

    let window: ShowWindow | null;
    try {
      window = await this.source();
    } catch (error) {
      console.error('[show-window-lookup] ShowWindowSource threw; treating as no active show', {
        operation: 'ShowWindowCache.ensureFresh',
        error,
      });
      window = null;
    }

    this.entry = { window, fetchedAt: now };
  }

  /** Returns the cached window only if an entry exists and is strictly younger than `ttlMs`
   *  at `now` — at or beyond the bound this returns null, never the stale entry, independent
   *  of whether `ensureFresh` was called first. */
  read(now: Date): ShowWindow | null {
    if (!this.entry) return null;
    if (now.getTime() - this.entry.fetchedAt.getTime() >= this.ttlMs) return null;
    return this.entry.window;
  }
}

const UTC_DATETIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Accepts ONLY a string carrying an explicit UTC offset designator (`Z` or `±HH:MM`) and
 * returns the parsed instant. Rejects (returns null) non-strings, date-only strings, any
 * datetime string with no offset designator, and anything that fails to parse to a valid
 * instant. See the golden README's "Timezone posture" — this project's server runs in SAST
 * (UTC+2); a bare, offset-less datetime string would otherwise silently parse in local time.
 */
export function parseUtcDatetime(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  if (!UTC_DATETIME_PATTERN.test(value)) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

/**
 * Builds a `ShowWindow` from a show document's raw `startDate`/`endDate` fields, or `null`
 * on a null/undefined `fields` object, a missing `startDate`, a missing `endDate`, or either
 * field failing `parseUtcDatetime`.
 */
export function buildShowWindow(
  fields: { startDate?: unknown; endDate?: unknown } | null | undefined
): ShowWindow | null {
  if (!fields) return null;

  const startDate = parseUtcDatetime(fields.startDate);
  const endDate = parseUtcDatetime(fields.endDate);
  if (!startDate || !endDate) return null;

  return { startDate, endDate };
}

interface ActiveShowWindowDoc extends ShowActivationFields {
  startDate?: unknown;
  endDate?: unknown;
}

/**
 * The production `ShowWindowSource`. Queries every `show` document's `_id`/`active`/
 * `startDate`/`endDate`, resolves the active one via the EXISTING, already-proven
 * `resolveActiveShow()` (reused, not reimplemented), then `buildShowWindow()`s that
 * document's date fields. Never throws — any Sanity fetch error is caught, logged, and
 * treated as null. Deliberately takes no `showId` argument — see the golden README's "Why
 * `showId` is not a Sanity `_id`": there is exactly one active show at a time by
 * construction, and the Firestore `showId` scoping value has no Sanity-`_id` counterpart to
 * look up by.
 */
export const fetchActiveShowWindow: ShowWindowSource = async () => {
  if (!client) return null;

  try {
    const shows =
      (await client.fetch<ActiveShowWindowDoc[]>(activeShowWindowQuery)) ?? [];
    const activeShowId = resolveActiveShow(shows);
    if (!activeShowId) return null;

    const activeShow = shows.find((show) => show._id === activeShowId) ?? null;
    return buildShowWindow(activeShow);
  } catch (error) {
    console.error('[show-window-lookup] fetchActiveShowWindow failed', {
      operation: 'fetchActiveShowWindow',
      error,
    });
    return null;
  }
};

let productionShowWindowCache: ShowWindowCache | null = null;

/** Module-level singleton backed by `fetchActiveShowWindow` — the TTL bound must apply
 *  ACROSS requests in one server process, not reset per request. */
export function getProductionShowWindowCache(): ShowWindowCache {
  if (!productionShowWindowCache) {
    productionShowWindowCache = new ShowWindowCache(fetchActiveShowWindow);
  }
  return productionShowWindowCache;
}

/**
 * The one function route code calls. Awaits `deps?.cache?.ensureFresh(now)` (or the
 * production singleton's `ensureFresh(now)` when no override is injected), then returns a
 * SYNCHRONOUS closure — `lib/admin-auth.ts`'s own `ShowWindowLookup` type, reused, never
 * redeclared — that, called with any showId OTHER than the `showId` this function was given,
 * returns null regardless of what the cache holds. See the golden README's "Why `showId` is
 * not a Sanity `_id`": `showId` is the Firestore role-scoping value
 * (`lib/tickets-constants.ts`'s `NATIONAL_SHOW_ID`), never a Sanity document `_id`.
 */
export async function resolveShowWindowLookup(
  showId: string,
  now: Date,
  deps?: { cache?: ShowWindowCache }
): Promise<ShowWindowLookup> {
  const cache = deps?.cache ?? getProductionShowWindowCache();
  await cache.ensureFresh(now);

  return (queryShowId: string): ShowWindow | null => {
    if (queryShowId !== showId) return null;
    return cache.read(now);
  };
}
