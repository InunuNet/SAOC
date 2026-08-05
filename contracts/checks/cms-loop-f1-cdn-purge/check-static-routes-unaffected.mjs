#!/usr/bin/env node
// cms-loop-f1-cdn-purge A3: proves the short-TTL fix was scoped to CMS-driven routes
// only, not blanket-applied. Two populations, both must still carry their PRE-fix
// long-TTL behaviour on the deployed host:
//
//   1. Static marketing routes (confirmed via `grep -L sanityFetch` against
//      app/(marketing)/**/page.tsx) that render without querying Sanity — these
//      should be unaffected by a fix scoped to CMS routes, and must still show the
//      legacy s-maxage=31536000 this whole mission started from.
//   2. A /_next/static/*.css asset, resolved dynamically from the homepage's own
//      rendered HTML (never hardcoded — the hashed filename changes every build) —
//      confirms the fix didn't touch Next's own immutable build-asset caching
//      (`public, max-age=31536000, immutable`), which uses a different Cache-Control
//      shape entirely from page responses and would be a much worse regression to
//      accidentally shorten (assets are content-hashed and safe to cache forever).
//
// This is also the negative control on A2's detection mechanism: A2's short-TTL
// assertion only means something if it's provably capable of failing. Running the
// exact same style of check against routes that MUST NOT have changed, and requiring
// them to still show the legacy long TTL, proves the mechanism isn't vacuously true
// (i.e. it isn't a check that would pass no matter what Cache-Control value it saw).
//
// Exit codes: 0 = every unaffected route/asset still has its pre-fix Cache-Control.
// 1 = anything unreachable or unexpectedly changed — never a skip.

import { fetchHeaders, parseCacheControl, BASE_URL, STATIC_MARKETING_ROUTES, LEGACY_S_MAXAGE } from './_shared.mjs';

async function resolveStaticAssetPath() {
  let res;
  try {
    res = await fetch(`${BASE_URL}/`, { cache: 'no-store' });
  } catch (err) {
    console.error(`FAIL: could not reach ${BASE_URL}/ to resolve a static asset path — ${err.message}`);
    process.exit(1);
  }
  const html = await res.text();
  const match = html.match(/\/_next\/static\/[^"']+\.css/);
  if (!match) {
    console.error('FAIL: could not find a /_next/static/*.css reference in the homepage HTML — cannot verify asset caching.');
    process.exit(1);
  }
  return match[0];
}

let failures = 0;

console.log(`Checking ${STATIC_MARKETING_ROUTES.length} non-CMS marketing routes still carry the legacy long TTL...`);
for (const path of STATIC_MARKETING_ROUTES) {
  const headers = await fetchHeaders(path);
  const parsed = parseCacheControl(headers.cacheControl);
  // /national-show/upcoming is a 307 redirect, not a 200 page render — accept either
  // status here as long as its own Cache-Control still carries the legacy TTL.
  const okStatus = headers.status === 200 || headers.status === 307;
  if (okStatus && parsed.sMaxage === LEGACY_S_MAXAGE) {
    console.log(`  PASS ${path} -> ${headers.cacheControl} (status ${headers.status}, unaffected as expected)`);
  } else {
    failures += 1;
    console.error(
      `  FAIL ${path} -> status ${headers.status}, Cache-Control ${JSON.stringify(headers.cacheControl)}: ` +
        `expected s-maxage=${LEGACY_S_MAXAGE} to still be present (this route is not CMS-driven and should be untouched by the F1 fix)`
    );
  }
}

console.log('Checking a /_next/static build asset still carries immutable, max-age=31536000...');
const assetPath = await resolveStaticAssetPath();
const assetHeaders = await fetchHeaders(assetPath);
const assetParsed = parseCacheControl(assetHeaders.cacheControl);
if (assetHeaders.status === 200 && assetParsed.maxAge === LEGACY_S_MAXAGE && assetParsed.immutable) {
  console.log(`  PASS ${assetPath} -> ${assetHeaders.cacheControl}`);
} else {
  failures += 1;
  console.error(
    `  FAIL ${assetPath} -> status ${assetHeaders.status}, Cache-Control ${JSON.stringify(assetHeaders.cacheControl)}: ` +
      'expected max-age=31536000 and immutable — build-asset caching must not be affected by the CMS-route fix'
  );
}

if (failures > 0) {
  console.error(`RESULT: FAIL — ${failures} route(s)/asset(s) that should have been unaffected did not show the expected legacy Cache-Control.`);
  process.exit(1);
}
console.log('RESULT: PASS — the short-TTL fix is scoped to CMS-driven routes only; static routes and build assets are unaffected.');
process.exit(0);
