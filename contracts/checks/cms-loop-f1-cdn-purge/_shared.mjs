// cms-loop-f1-cdn-purge: shared helpers for asserting response headers on the
// DEPLOYED host. This directory is owned by this contract only — per dispatch
// instructions, nothing here touches contracts/checks/f6-prove-cms-loop/_shared.mjs
// (a parallel F2 architect may be parameterising that file).

export const BASE_URL = 'https://saoc-prod--saoc-webapp.europe-west4.hosted.app';

// Public, read-only, tokenless Sanity CDN query endpoint — used only to resolve a
// REAL slug for the two dynamic [slug] routes at run time, so this check never goes
// stale against hardcoded content. Confirmed live 2026-08-05 that this dataset
// permits anonymous reads via apicdn.sanity.io (no SANITY_API_TOKEN required).
const SANITY_QUERY_URL = 'https://26yfbug4.apicdn.sanity.io/v2024-01-01/data/query/production';

export async function resolveOneSlug(docType) {
  const query = encodeURIComponent(`*[_type=="${docType}"][0].slug.current`);
  let res;
  try {
    res = await fetch(`${SANITY_QUERY_URL}?query=${query}`);
  } catch (err) {
    console.error(`FAIL: could not reach Sanity CDN API to resolve a ${docType} slug — ${err.message}`);
    process.exit(1);
  }
  const json = await res.json().catch(() => null);
  const slug = json?.result;
  if (!slug || typeof slug !== 'string') {
    console.error(
      `FAIL: no ${docType} document with a slug exists in the dataset — cannot exercise the /${docType}/[slug] ` +
        'route. This is a precondition failure, not a skip: without a real document, this route genuinely cannot ' +
        'be tested against the deployed host.'
    );
    process.exit(1);
  }
  return slug;
}

// Fetches a path on the deployed host and returns its raw Cache-Control header
// (undefined if absent) plus status, via a HEAD-equivalent (no-store on our end so we
// always see what the CDN currently has, never a local fetch cache).
export async function fetchHeaders(path) {
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, { method: 'GET', cache: 'no-store', redirect: 'manual' });
  } catch (err) {
    console.error(`FAIL: could not reach ${BASE_URL}${path} — ${err.message} (host unreachable)`);
    process.exit(1);
  }
  return { status: res.status, cacheControl: res.headers.get('cache-control') ?? undefined };
}

// Parses a Cache-Control value into { sMaxage, maxAge, staleWhileRevalidate, immutable }
// (undefined for any directive not present). Deliberately tolerant of directive order
// and extra directives — asserts on parsed values, not string equality, so it isn't
// coupled to exactly how @dev implements the header (next.config.js headers() vs.
// per-route `export const revalidate`).
export function parseCacheControl(value) {
  if (!value) return {};
  const out = {};
  for (const part of value.split(',').map((s) => s.trim())) {
    const [key, val] = part.split('=');
    if (key === 's-maxage') out.sMaxage = Number(val);
    else if (key === 'max-age') out.maxAge = Number(val);
    else if (key === 'stale-while-revalidate') out.staleWhileRevalidate = val === undefined ? true : Number(val);
    else if (key === 'immutable') out.immutable = true;
  }
  return out;
}

// The one-year default every CMS-driven route carried before this fix (see
// docs/f6-cdn-invalidation-investigation.md) — used as the "still broken" reference
// point a short-TTL route must NOT match, and as the expected value for routes this
// contract deliberately leaves untouched.
export const LEGACY_S_MAXAGE = 31536000;

// Upper bound a "fixed" CMS route's s-maxage must fall at or under. 60 is the
// concrete value recommended in docs/f1-cdn-purge-api-findings.md; this check allows
// @dev some latitude below that (e.g. 30s) without allowing a value so short it stops
// being a deliberate, documented trade-off, or so long it stops closing the loop
// inside F6's 120s bound (see contract header for the timing analysis).
export const MAX_ACCEPTABLE_S_MAXAGE = 60;

// CMS-driven marketing routes — every route under app/(marketing)/ confirmed (via
// `grep -l sanityFetch`) to actually query Sanity, as of 2026-08-05. Deliberately
// narrower than the dispatch brief's candidate list — see contract header
// "ROUTE LIST — VERIFIED, NOT TRUSTED" for the routes the brief listed that were
// found to NOT be Sanity-driven and were excluded.
export const CMS_ROUTES = [
  '/',
  '/about',
  '/contact',
  '/judging',
  '/events',
  '/national-show',
  '/national-show/archive',
  '/societies',
  '/sponsors',
];

// Dynamic CMS routes needing a real slug resolved at run time — see resolveOneSlug().
export const CMS_DYNAMIC_ROUTES = [
  { pathPrefix: '/events/', docType: 'societyEvent' },
  { pathPrefix: '/societies/', docType: 'society' },
];

// Routes confirmed (via the same grep) to render WITHOUT querying Sanity — must keep
// the legacy long TTL. This is the scoping negative control: proves the fix was
// applied deliberately to CMS routes only, not blanket-applied to every route in
// app/(marketing)/.
// NOTE: /events/submit was deliberately excluded here after live verification
// (2026-08-05) showed it returns `private, no-cache, no-store, max-age=0,
// must-revalidate`, not the legacy s-maxage=31536000 — it reads `cookies()` for an
// auth check (app/(marketing)/events/submit/page.tsx), which forces Next.js into
// fully dynamic, uncached rendering regardless of any CDN TTL policy. It is neither
// CMS-driven (not in CMS_ROUTES) nor a static-cacheable page (not comparable to this
// list) — it is its own third category, out of scope for this contract entirely.
export const STATIC_MARKETING_ROUTES = [
  '/constitution',
  '/privacy',
  '/terms',
  '/media-kit',
  '/national-show/exhibitors',
  '/national-show/upcoming', // a redirect (307 -> /national-show), not a page render
];
