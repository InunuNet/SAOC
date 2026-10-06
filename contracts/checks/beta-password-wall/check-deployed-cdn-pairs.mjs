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
// could store — an ISR page, a year-long static page, a build chunk, a public
// file, and a remote and a local image through the optimizer (whose Cache-Control
// Next forces to `public` when it serves an image, so it is protected only by
// proxy.ts's Set-Cookie marker).
//
// The optimizer URLs are CONSTRUCTED, not discovered: the deployed build emits no
// /_next/image references at all and answers the optimizer with 404 (QA F2 retry 1),
// while a local `next build` serves it. Whatever status comes back — 200, 400 or
// 404 — the pair property is asserted on it unchanged, so neither shape can skip.
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
const OPTIMIZER_WIDTH = 640;
const OPTIMIZER_QUALITY = 75;
// A Sanity asset that is live in the production dataset; the pair property does
// not depend on the optimizer actually finding it.
const REMOTE_IMAGE_SRC = 'https://cdn.sanity.io/images/26yfbug4/production/'
  + 'a620a97f8df7b9cae76b892e97770d79af1fa793-3100x2325.jpg?w=1600';
// Ships in public/ with the repo, so it exists on every deployment.
const LOCAL_IMAGE_SRC = '/images/orchid-pink.jpg';

function optimizerPath(src) {
  return `/_next/image?url=${encodeURIComponent(src)}&w=${OPTIMIZER_WIDTH}&q=${OPTIMIZER_QUALITY}`;
}

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
  if (!chunk) throw new Error('could not discover a /_next/static/*.js build chunk from /');
  return [
    { kind: 'ISR page', path: '/', proxyCacheControl: true, expectAuthedOk: true },
    { kind: 'static page', path: '/privacy', proxyCacheControl: true, expectAuthedOk: true },
    { kind: 'build chunk', path: chunk[0], proxyCacheControl: true, expectAuthedOk: true },
    { kind: 'public file', path: LOCAL_IMAGE_SRC, proxyCacheControl: true, expectAuthedOk: true },
    { kind: 'optimizer (remote src)', path: optimizerPath(REMOTE_IMAGE_SRC), proxyCacheControl: false, expectAuthedOk: false },
    { kind: 'optimizer (local src)', path: optimizerPath(LOCAL_IMAGE_SRC), proxyCacheControl: false, expectAuthedOk: false },
  ];
}

function checkPair(target, authed, anon) {
  const problems = [];
  if (target.expectAuthedOk && authed.status !== 200) problems.push(`authed status ${authed.status}`);
  if (authed.status === 401) problems.push('authed request was challenged');
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
