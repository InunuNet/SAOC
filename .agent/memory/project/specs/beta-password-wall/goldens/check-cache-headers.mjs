#!/usr/bin/env node
// contracts/checks/beta-password-wall/check-cache-headers.mjs
// Mission beta-password-wall F1 (retry 1) — proves, against a REAL `next start`
// production server, that no response the wall lets through can be stored by
// Firebase App Hosting's Cloud CDN, and that the protection lifts at RUNTIME when
// SITE_PUBLIC_LAUNCH='true'.
//
// Why this exists: on 2026-10-06 the deployed beta served the full homepage to an
// unauthenticated curl (`cdn-cache-status: hit`) for ~60s after one authenticated
// load, because the ISR page's own `Cache-Control: s-maxage=60, ...` reached the
// CDN untouched. A cache hit never reaches proxy.ts, so the only fix is to make
// every walled response unstorable at the edge. Unit tests cannot see this — Next
// itself decides the final headers after proxy runs — so this check reads the
// headers Next actually emits.
//
// Two independent CDN-uncacheability mechanisms are asserted, both taken from
// https://firebase.google.com/docs/app-hosting/optimize-cache ("NONE of the
// following are true" list):
//   1. `Cache-Control: private, no-store, max-age=0` set by proxy.ts. Next keeps a
//      pre-set Cache-Control on pages, static files and API routes
//      (send-payload.js:60, router-server.js:394 only set it when absent), so on
//      those paths the final header must still be private + no-store, with no
//      `public` and no `s-maxage`. The 401 itself must carry proxy's exact value.
//   2. A `Set-Cookie: saoc_beta_wall=1` marker set by proxy.ts. Required on EVERY
//      walled response, because some Next paths overwrite Cache-Control after
//      proxy runs: the image optimizer (image-optimizer.js:1180, always `public`)
//      and route handlers that return their own Cache-Control (ImageResponse at
//      /og). A response carrying Set-Cookie is never cached by Cloud CDN.
//
// Usage (repo root, after `pnpm build`):
//   node contracts/checks/beta-password-wall/check-cache-headers.mjs [--app-dir <dir>]
// Spawns `next start` twice on a free port (walled, then launched) with throwaway
// random credentials that are never printed, and always kills the server.
// Exit 0 = PASS, 1 = FAIL, 2 = usage/setup error.

import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, statSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';

const WALL_CACHE_CONTROL = 'private, no-store, max-age=0';
const WALL_MARKER_COOKIE_NAME = 'saoc_beta_wall';
const READY_TIMEOUT_MS = 60_000;
const READY_POLL_MS = 500;

// Paths whose Cache-Control Next leaves alone once proxy has set it — the proxy
// value must arrive byte-for-byte. `kind` is for the report only.
const CACHE_CONTROL_SURVIVES = [
  { kind: 'ISR page', path: '/' },
  { kind: 'ISR page (RSC payload)', path: '/', headers: { RSC: '1' } },
  { kind: 'static page', path: '/privacy' },
  { kind: 'SSG/ISR param page', path: '/societies/cape-orchid-society' },
  { kind: 'dynamic page', path: '/national-show/conferences' },
  { kind: 'not-found page', path: '/beta-wall-cache-check-missing-page' },
  { kind: 'robots', path: '/robots.txt' },
  { kind: 'sitemap', path: '/sitemap.xml' },
  { kind: 'API route', path: '/api/events.ics' },
  { kind: 'public file', path: '/images/orchid-pink.jpg' },
  { kind: 'favicon', path: '/favicon.ico' },
  { kind: 'build asset', path: '__STATIC_CHUNK__' },
];

// Paths where Next overwrites Cache-Control after proxy — protected by the
// Set-Cookie marker alone. Listed explicitly so a new overwrite path shows up as
// a CACHE_CONTROL_SURVIVES failure rather than passing silently.
// The local-image probe returns 400 while walled (the optimizer's internal
// self-fetch carries no Authorization header — a known, separately-tracked
// limitation, see docs/beta-password-wall.md); it still proves the marker cookie
// survives the optimizer's error path. The remote probe is the real 200 case.
const CACHE_CONTROL_OVERWRITTEN = [
  { kind: 'image optimizer (local src)', path: '/_next/image?url=%2Fimages%2Forchid-pink.jpg&w=640&q=75' },
  { kind: 'image optimizer (remote src)', path: '__REMOTE_IMAGE__' },
  { kind: 'OG image route', path: '/og' },
];

function parseArgs(argv) {
  const args = { appDir: '.' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--app-dir' && argv[i + 1]) {
      args.appDir = argv[++i];
    } else {
      throw new Error(`unknown argument: ${argv[i]}`);
    }
  }
  return args;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function assertFreshBuild(appDir) {
  const buildId = path.join(appDir, '.next', 'BUILD_ID');
  if (!existsSync(buildId)) throw new Error(`no production build at ${buildId} — run pnpm build`);
  const builtAt = statSync(buildId).mtimeMs;
  for (const source of ['proxy.ts', path.join('lib', 'beta-public-launch.ts')]) {
    const sourcePath = path.join(appDir, source);
    if (statSync(sourcePath).mtimeMs > builtAt) {
      throw new Error(`${sourcePath} is newer than the build — run pnpm build first`);
    }
  }
}

async function startServer(appDir, env) {
  const port = await freePort();
  const nextBin = path.join('node_modules', 'next', 'dist', 'bin', 'next');
  const child = spawn(process.execPath, [nextBin, 'start', appDir, '-p', String(port)], {
    env: { ...process.env, NODE_ENV: 'production', ...env },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const baseUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`next start exited early: ${stderr.slice(-500)}`);
    try {
      await fetch(`${baseUrl}/robots.txt`, { redirect: 'manual' });
      return { child, baseUrl };
    } catch {
      await new Promise((r) => setTimeout(r, READY_POLL_MS));
    }
  }
  child.kill('SIGTERM');
  throw new Error('next start did not become ready in time');
}

function stopServer(server) {
  if (server && server.child.exitCode === null) server.child.kill('SIGTERM');
}

async function probe(baseUrl, target, authorization) {
  const headers = { ...(target.headers ?? {}) };
  if (authorization) headers.Authorization = authorization;
  const res = await fetch(`${baseUrl}${target.path}`, { headers, redirect: 'manual' });
  const body = await res.text();
  return {
    status: res.status,
    cacheControl: res.headers.get('cache-control') ?? '',
    vary: res.headers.get('vary') ?? '',
    setCookie: res.headers.getSetCookie(),
    robots: res.headers.get('x-robots-tag') ?? '',
    challenge: res.headers.get('www-authenticate') ?? '',
    body,
  };
}

// The property is "unstorable by a shared cache", not "byte-equal to proxy's
// value": Next's error renderer replaces it with its own equally-private
// `private, no-cache, no-store, ...` on 404s (base-server.js:1657), which is fine.
function isUnstorable(cacheControl) {
  const directives = cacheControl.toLowerCase().split(',').map((d) => d.trim());
  return directives.includes('private')
    && directives.includes('no-store')
    && !directives.includes('public')
    && !directives.some((d) => d.startsWith('s-maxage'));
}

function hasMarkerCookie(result) {
  return result.setCookie.some((c) => c.startsWith(`${WALL_MARKER_COOKIE_NAME}=`));
}

// Build-hashed and content-dependent paths are discovered from the real homepage
// rather than hardcoded, so the check survives rebuilds and CMS edits.
async function discoverPaths(baseUrl, authorization) {
  const home = await probe(baseUrl, { path: '/' }, authorization);
  const chunk = home.body.match(/\/_next\/static\/[^"'\s]+\.js/);
  if (!chunk) throw new Error('could not find a /_next/static/*.js reference in the homepage');
  const image = home.body.match(/\/_next\/image\?url=https%3A%2F%2Fcdn\.sanity\.io[^"'\s,]+/);
  if (!image) throw new Error('could not find a remote /_next/image reference in the homepage');
  return { chunk: chunk[0], remoteImage: image[0].replaceAll('&amp;', '&') };
}

async function checkWalled(appDir, credentials) {
  const failures = [];
  const authorization = `Basic ${Buffer.from(`${credentials.user}:${credentials.password}`).toString('base64')}`;
  const server = await startServer(appDir, {
    BETA_BASIC_AUTH_USER: credentials.user,
    BETA_BASIC_AUTH_PASSWORD: credentials.password,
    SITE_PUBLIC_LAUNCH: 'false',
  });
  try {
    const discovered = await discoverPaths(server.baseUrl, authorization);
    const placeholders = { __STATIC_CHUNK__: discovered.chunk, __REMOTE_IMAGE__: discovered.remoteImage };
    const targets = [
      ...CACHE_CONTROL_SURVIVES.map((t) => ({ ...t, survives: true })),
      ...CACHE_CONTROL_OVERWRITTEN.map((t) => ({ ...t, survives: false })),
    ].map((t) => ({ ...t, path: placeholders[t.path] ?? t.path }));

    for (const target of targets) {
      const authed = await probe(server.baseUrl, target, authorization);
      const problems = [];
      if (authed.status >= 500) problems.push(`status ${authed.status}`);
      if (authed.challenge) problems.push('challenged despite valid credentials');
      if (!hasMarkerCookie(authed)) problems.push('missing Set-Cookie marker');
      if (!/noindex/i.test(authed.robots)) problems.push('missing X-Robots-Tag noindex');
      if (target.survives && !isUnstorable(authed.cacheControl)) {
        problems.push(`Cache-Control is shared-cacheable: "${authed.cacheControl}"`);
      }
      const line = `${problems.length ? 'FAIL' : 'ok  '} authed ${target.kind} ${target.path}`
        + ` -> ${authed.status} | cache-control: ${authed.cacheControl} | vary: ${authed.vary}`
        + ` | marker-cookie: ${hasMarkerCookie(authed)}${problems.length ? ` | ${problems.join('; ')}` : ''}`;
      console.log(line);
      if (problems.length) failures.push(`${target.path}: ${problems.join('; ')}`);

      const anon = await probe(server.baseUrl, target, null);
      const anonProblems = [];
      if (anon.status !== 401) anonProblems.push(`status ${anon.status}, expected 401`);
      if (!/^Basic /.test(anon.challenge)) anonProblems.push('missing WWW-Authenticate: Basic');
      if (anon.cacheControl !== WALL_CACHE_CONTROL) {
        anonProblems.push(`401 Cache-Control "${anon.cacheControl}", expected "${WALL_CACHE_CONTROL}"`);
      }
      if (!hasMarkerCookie(anon)) anonProblems.push('missing Set-Cookie marker');
      console.log(`${anonProblems.length ? 'FAIL' : 'ok  '} anon   ${target.kind} ${target.path}`
        + ` -> ${anon.status} | cache-control: ${anon.cacheControl}`
        + `${anonProblems.length ? ` | ${anonProblems.join('; ')}` : ''}`);
      if (anonProblems.length) failures.push(`anon ${target.path}: ${anonProblems.join('; ')}`);
    }
  } finally {
    stopServer(server);
  }
  return failures;
}

async function checkLaunched(appDir) {
  const failures = [];
  const server = await startServer(appDir, {
    BETA_BASIC_AUTH_USER: '',
    BETA_BASIC_AUTH_PASSWORD: '',
    SITE_PUBLIC_LAUNCH: 'true',
  });
  try {
    const home = await probe(server.baseUrl, { path: '/' }, null);
    const problems = [];
    if (home.status !== 200) problems.push(`status ${home.status}, expected 200`);
    if (hasMarkerCookie(home)) problems.push('marker cookie still set after launch');
    if (home.robots) problems.push(`X-Robots-Tag still "${home.robots}" after launch`);
    if (!/s-maxage=/.test(home.cacheControl)) {
      problems.push(`Cache-Control "${home.cacheControl}" — Next's ISR header not restored`);
    }
    console.log(`${problems.length ? 'FAIL' : 'ok  '} launched ISR page / -> ${home.status}`
      + ` | cache-control: ${home.cacheControl}${problems.length ? ` | ${problems.join('; ')}` : ''}`);
    if (problems.length) failures.push(`launched /: ${problems.join('; ')}`);
  } finally {
    stopServer(server);
  }
  return failures;
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
    assertFreshBuild(args.appDir);
  } catch (error) {
    console.error(`usage error: ${error.message}`);
    process.exit(2);
  }
  // Throwaway credentials for this run only — never the deployed secret, never printed.
  const credentials = { user: randomBytes(12).toString('hex'), password: randomBytes(24).toString('hex') };
  const failures = [
    ...(await checkWalled(args.appDir, credentials)),
    ...(await checkLaunched(args.appDir)),
  ];
  if (failures.length) {
    console.log(`FAIL: ${failures.length} problem(s)`);
    process.exit(1);
  }
  console.log('PASS: every walled response is CDN-unstorable; launch restores Next caching');
}

main().catch((error) => {
  console.error(`error: ${error.message}`);
  process.exit(2);
});
