#!/usr/bin/env node
// contracts/checks/beta-password-wall/check-deployed-cdn-pairs.mjs
// Mission beta-password-wall F2 (retry 1) — DEPLOYED proof that the Cloud CDN in
// front of Firebase App Hosting never replays an authenticated response to an
// anonymous visitor.
//
// The defect this guards (2026-10-06): one authenticated load of `/` let the CDN
// store the ISR page, and for ~60s an unauthenticated curl got the full homepage
// (`cdn-cache-status: hit`, 200, no challenge). A single point-in-time 401 check
// cannot see that, so this script reproduces the exact trigger: an authenticated
// GET, then IMMEDIATELY an anonymous GET of the byte-identical URL (no cache
// buster), repeated for several rounds across every kind of response the CDN
// could store — an ISR page, a year-long static page, a build chunk, and a remote
// image through the optimizer (whose Cache-Control Next forces to `public`, so it
// is protected only by proxy.ts's Set-Cookie marker).
//
// Usage: BETA_BASIC_AUTH_USER=... BETA_BASIC_AUTH_PASSWORD=... \
//   node contracts/checks/beta-password-wall/check-deployed-cdn-pairs.mjs [origin] [rounds]
// Credentials come from the environment only and are never printed.
// Run ONLY against a deployment that carries the fix: against the pre-fix build,
// the authenticated half of each pair re-opens the very bypass window it detects.
// Exit 0 = PASS, 1 = FAIL, 2 = usage/setup error.

const DEFAULT_ORIGIN = 'https://beta.saoc.co.za';
const DEFAULT_ROUNDS = 5;
const ROUND_PAUSE_MS = 1_000;
const WALL_MARKER_COOKIE_NAME = 'saoc_beta_wall';

function isUnstorable(cacheControl) {
  const directives = cacheControl.toLowerCase().split(',').map((d) => d.trim());
  return directives.includes('private')
    && directives.includes('no-store')
    && !directives.includes('public')
    && !directives.some((d) => d.startsWith('s-maxage'));
}

async function get(url, authorization) {
  const headers = authorization ? { Authorization: authorization } : {};
  const res = await fetch(url, { headers, redirect: 'manual' });
  const body = await res.text();
  return {
    status: res.status,
    cacheControl: res.headers.get('cache-control') ?? '',
    cdnCacheStatus: (res.headers.get('cdn-cache-status') ?? '').toLowerCase(),
    challenge: res.headers.get('www-authenticate') ?? '',
    markerCookie: res.headers.getSetCookie().some((c) => c.startsWith(`${WALL_MARKER_COOKIE_NAME}=`)),
    body,
  };
}

async function discoverTargets(origin, authorization) {
  const home = await get(`${origin}/`, authorization);
  if (home.status !== 200) throw new Error(`authenticated GET / returned ${home.status}, expected 200`);
  const chunk = home.body.match(/\/_next\/static\/[^"'\s]+\.js/);
  const image = home.body.match(/\/_next\/image\?url=https%3A%2F%2Fcdn\.sanity\.io[^"'\s,]+/);
  if (!chunk || !image) throw new Error('could not discover a build chunk and a remote optimized image from /');
  return [
    { kind: 'ISR page', path: '/', proxyCacheControl: true },
    { kind: 'static page', path: '/privacy', proxyCacheControl: true },
    { kind: 'build chunk', path: chunk[0], proxyCacheControl: true },
    { kind: 'optimized image', path: image[0].replaceAll('&amp;', '&'), proxyCacheControl: false },
  ];
}

function checkPair(target, authed, anon) {
  const problems = [];
  if (authed.status !== 200) problems.push(`authed status ${authed.status}`);
  if (!authed.markerCookie) problems.push('authed response missing Set-Cookie marker');
  if (target.proxyCacheControl && !isUnstorable(authed.cacheControl)) {
    problems.push(`authed Cache-Control shared-cacheable: "${authed.cacheControl}"`);
  }
  if (authed.cdnCacheStatus === 'hit') problems.push('authed response served from CDN cache');
  if (anon.status !== 401) problems.push(`anon status ${anon.status}, expected 401`);
  if (!/^Basic /.test(anon.challenge)) problems.push('anon response missing WWW-Authenticate: Basic');
  if (anon.cdnCacheStatus === 'hit') problems.push('anon response served from CDN cache');
  return problems;
}

async function main() {
  const origin = (process.argv[2] ?? DEFAULT_ORIGIN).replace(/\/$/, '');
  const rounds = Number(process.argv[3] ?? DEFAULT_ROUNDS);
  const user = process.env.BETA_BASIC_AUTH_USER;
  const password = process.env.BETA_BASIC_AUTH_PASSWORD;
  if (!user || !password) {
    console.error('usage error: export BETA_BASIC_AUTH_USER and BETA_BASIC_AUTH_PASSWORD');
    process.exit(2);
  }
  if (!Number.isInteger(rounds) || rounds < 1) {
    console.error('usage error: rounds must be a positive integer');
    process.exit(2);
  }
  const authorization = `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;

  let targets;
  try {
    targets = await discoverTargets(origin, authorization);
  } catch (error) {
    console.error(`setup error: ${error.message}`);
    process.exit(2);
  }

  let failures = 0;
  for (let round = 1; round <= rounds; round++) {
    for (const target of targets) {
      const url = `${origin}${target.path}`;
      const authed = await get(url, authorization);
      const anon = await get(url, null);
      const problems = checkPair(target, authed, anon);
      if (problems.length) failures++;
      console.log(`${problems.length ? 'FAIL' : 'ok  '} round ${round} ${target.kind}`
        + ` | authed ${authed.status} cdn=${authed.cdnCacheStatus || '-'} cc="${authed.cacheControl}"`
        + ` | anon ${anon.status} cdn=${anon.cdnCacheStatus || '-'}`
        + `${problems.length ? ` | ${problems.join('; ')}` : ''}`);
    }
    if (round < rounds) await new Promise((r) => setTimeout(r, ROUND_PAUSE_MS));
  }

  if (failures) {
    console.log(`FAIL: ${failures} pair(s) failed across ${rounds} round(s)`);
    process.exit(1);
  }
  console.log(`PASS: ${rounds * targets.length} authed->anon pairs, no CDN replay, every anon request 401`);
}

main().catch((error) => {
  console.error(`error: ${error.message}`);
  process.exit(2);
});
