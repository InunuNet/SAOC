#!/usr/bin/env node
// cms-loop-f1-cdn-purge A2: every CMS-driven marketing route on the DEPLOYED host
// must carry a short, bounded s-maxage (<= 60s) with a stale-while-revalidate window,
// instead of the one-year default that caused F6's original failure (see
// docs/f6-cdn-invalidation-investigation.md). This is what makes A1 (the F6 round
// trip) able to pass at all: it proves the CDN will re-check origin within a bound
// the F6 poll can observe, not that the loop happens to work today by luck.
//
// This does NOT prove instant propagation — see the contract header. It proves the
// staleness window is bounded and short, which is the actual, honest fix being made.
//
// Exit codes: 0 = every CMS route's Cache-Control matches the expected shape.
// 1 = any route missing, unreachable, or still carrying the legacy 1-year TTL —
// never a skip.

import {
  fetchHeaders,
  parseCacheControl,
  resolveOneSlug,
  CMS_ROUTES,
  CMS_DYNAMIC_ROUTES,
  MAX_ACCEPTABLE_S_MAXAGE,
  LEGACY_S_MAXAGE,
} from './_shared.mjs';

async function resolveAllRoutes() {
  const routes = [...CMS_ROUTES];
  for (const { pathPrefix, docType } of CMS_DYNAMIC_ROUTES) {
    const slug = await resolveOneSlug(docType);
    routes.push(`${pathPrefix}${slug}`);
  }
  return routes;
}

function assertRoute(path, cc) {
  const parsed = parseCacheControl(cc.cacheControl);
  const problems = [];

  if (cc.status !== 200) {
    problems.push(`expected HTTP 200, got ${cc.status}`);
  }
  if (parsed.sMaxage === undefined) {
    problems.push(`no s-maxage directive in Cache-Control (${JSON.stringify(cc.cacheControl)})`);
  } else if (parsed.sMaxage === LEGACY_S_MAXAGE) {
    problems.push(`s-maxage is still the legacy one-year value (${LEGACY_S_MAXAGE}) — fix not applied to this route`);
  } else if (parsed.sMaxage > MAX_ACCEPTABLE_S_MAXAGE) {
    problems.push(`s-maxage=${parsed.sMaxage} exceeds the ${MAX_ACCEPTABLE_S_MAXAGE}s bound this fix requires`);
  } else if (parsed.sMaxage <= 0) {
    problems.push(`s-maxage=${parsed.sMaxage} is not a positive bounded TTL`);
  }
  if (parsed.staleWhileRevalidate === undefined) {
    problems.push('no stale-while-revalidate directive — without it, an origin hiccup at the s-maxage boundary is a visible slow request instead of a fast stale response (see docs/f1-cdn-purge-api-findings.md)');
  }

  return problems;
}

const routes = await resolveAllRoutes();
console.log(`Checking ${routes.length} CMS-driven routes on the deployed host for a short, bounded Cache-Control...`);

let failures = 0;
for (const path of routes) {
  const headers = await fetchHeaders(path);
  const problems = assertRoute(path, headers);
  if (problems.length === 0) {
    console.log(`  PASS ${path} -> ${headers.cacheControl}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${path} -> ${JSON.stringify(headers.cacheControl)}: ${problems.join('; ')}`);
  }
}

if (failures > 0) {
  console.error(`RESULT: FAIL — ${failures}/${routes.length} CMS routes are not carrying the expected short TTL.`);
  process.exit(1);
}
console.log(`RESULT: PASS — all ${routes.length} CMS-driven routes carry a bounded s-maxage (<=${MAX_ACCEPTABLE_S_MAXAGE}s) with stale-while-revalidate.`);
process.exit(0);
