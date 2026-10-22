// Build + `next start` launcher for the rHB2 rendered check (QA input, hash-locked), adapted from the rHB spec's _server.mjs.
// PUBLIC and PREVIEW are two production builds (the withhold switch is read at prerender), both against the live Sanity dataset
// (.env.local) with NO hero filter: every slide Sanity serves is measured (4 on 2026-10-22, as on beta). ensureBuild(mode) keeps one
// stamped build per mode: the live one in .next (stamp .next/RHB_MODE, value '<mode>+yellow', shared with the rHB checks' unfiltered
// builds) and the other parked under .tmp/rhb-next/<stamp>. A build is reused only when it carries the stamp and no changed path vs BASE
// outside NOT_BUILT is newer than its BUILD_ID; otherwise `scripts/generate-image-variants.mjs` and `next build` run (3 tries: the Google
// Fonts fetch fails transiently). NOS_HB2_NO_BUILD=1 reports a missing/stale build instead of building.
//   public   SITE_PUBLIC_LAUNCH=true, no beta wall, no preview opt-in
//   preview  beta wall up (local basic auth only, never beta's), SHOW_PLACEHOLDER_PREVIEW=true, not launched (Brad's beta)
// Ports 3010-3019, never 3002, 3013 or 3016. stop() kills only the process group this module spawned.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { createRequire } from 'node:module';

import { NOT_BUILT, changedPaths, repoRoot } from './_lib.mjs';

const USER = 'nos-hero-banding-2';
const PASS = 'local-render-check';
export const AUTH = `Basic ${Buffer.from(`${USER}:${PASS}`).toString('base64')}`;
export const require = createRequire(path.join(repoRoot, 'package.json'));
export const MODES = ['public', 'preview'];
const RESERVED_PORTS = [3002, 3013, 3016];

const NEXT = path.join(repoRoot, '.next');
const PARK = path.join(repoRoot, '.tmp', 'rhb-next');
const STAMP = 'RHB_MODE';

const stampFor = (mode) => `${mode}+yellow`;

export function modeEnv(mode) {
  // The child never gets the caller's NODE_OPTIONS (e.g. the Chrome shim for Playwright).
  const base = { ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', NODE_OPTIONS: '' };
  if (mode === 'public') return { ...base, BETA_BASIC_AUTH_USER: '', BETA_BASIC_AUTH_PASSWORD: '', SITE_PUBLIC_LAUNCH: 'true', SHOW_PLACEHOLDER_PREVIEW: '' };
  if (mode === 'preview') return { ...base, BETA_BASIC_AUTH_USER: USER, BETA_BASIC_AUTH_PASSWORD: PASS, SITE_PUBLIC_LAUNCH: '', SHOW_PLACEHOLDER_PREVIEW: 'true' };
  throw new Error(`unknown mode ${mode}`);
}

const stampOf = (dir) => { try { return readFileSync(path.join(dir, STAMP), 'utf8').trim(); } catch { return null; } };

function freshness(dir) {
  const id = path.join(dir, 'BUILD_ID');
  if (!existsSync(id)) return ['no BUILD_ID'];
  const builtAt = statSync(id).mtimeMs;
  const stale = [...changedPaths()]
    .filter((p) => !NOT_BUILT.some((n) => p.startsWith(n)) && existsSync(path.join(repoRoot, p)) && statSync(path.join(repoRoot, p)).mtimeMs > builtAt)
    .map((p) => `${p} changed after the build`);
  return stale;
}

/** Returns [] when .next is a fresh build of the stamp, else the reasons it could not be made one. */
export function ensureBuild(mode) {
  const stamp = stampFor(mode);
  if (stampOf(NEXT) === stamp && freshness(NEXT).length === 0) return [];
  const parked = path.join(PARK, stamp);
  if (stampOf(parked) === stamp && freshness(parked).length === 0) {
    park();
    renameSync(parked, NEXT);
    return [];
  }
  if (process.env.NOS_HB2_NO_BUILD === '1') return [`no fresh ${stamp} build (NOS_HB2_NO_BUILD=1): ${[...freshness(NEXT), `stamp ${stampOf(NEXT)}`].join('; ')}`];
  park();
  const env = modeEnv(mode);
  // The package build script runs the WebP variant generator before `next build` (public/images/_opt is gitignored).
  const v = spawnSync(process.execPath, ['scripts/generate-image-variants.mjs'], { cwd: repoRoot, env: { ...env, NODE_OPTIONS: '' }, encoding: 'utf8', maxBuffer: 67108864 });
  if (v.status !== 0) return [`image variants (${stamp}) failed: ${`${v.stdout}${v.stderr}`.slice(-3000)}`];
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = spawnSync(path.join(repoRoot, 'node_modules', '.bin', 'next'), ['build'], { cwd: repoRoot, env, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    if (r.status === 0) {
      writeFileSync(path.join(NEXT, STAMP), `${stamp}\n`);
      return [];
    }
    if (attempt === 3) return [`next build (${stamp}) failed 3 times:\n${`${r.stdout}${r.stderr}`.slice(-3000)}`];
  }
  return [];
}

// Moves the live .next aside: a stamped build is parked under its stamp, an unstamped one (the dev's own build) is discarded.
function park() {
  if (!existsSync(NEXT)) return;
  const stamp = stampOf(NEXT);
  if (stamp && MODES.includes(stamp.replace(/\+yellow$/, ''))) {
    mkdirSync(PARK, { recursive: true });
    rmSync(path.join(PARK, stamp), { recursive: true, force: true });
    renameSync(NEXT, path.join(PARK, stamp));
  } else {
    rmSync(NEXT, { recursive: true, force: true });
  }
}

function portFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer().once('error', () => resolve(false)).once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, '127.0.0.1');
  });
}

/** Builds (if needed) and serves `mode`. Returns { origin, headers, stop } or { failures }. NOS_HB2_ORIGIN_<MODE> skips both. */
export async function serve(mode) {
  const headers = mode === 'preview' ? { authorization: AUTH } : {};
  const fixed = process.env[`NOS_HB2_ORIGIN_${mode.toUpperCase()}`];
  if (fixed) return { origin: fixed.replace(/\/$/, ''), headers, stop: async () => {} };
  const failures = ensureBuild(mode);
  if (failures.length) return { failures };
  let port = null;
  for (let p = Number(process.env.NOS_HB2_PORT || 3010); p <= 3019; p += 1) {
    if (!RESERVED_PORTS.includes(p) && (await portFree(p))) { port = p; break; }
  }
  if (!port) return { failures: [`no free port in 3010-3019 (${RESERVED_PORTS.join(', ')} are reserved)`] };
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn(path.join(repoRoot, 'node_modules', '.bin', 'next'), ['start', '-p', String(port), '-H', '127.0.0.1'], {
    cwd: repoRoot,
    env: modeEnv(mode),
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true, // own process group, so stop() reaches the forked next-server child too
  });
  const killGroup = (signal) => { try { process.kill(-server.pid, signal); } catch { /* group already gone */ } };
  const exited = new Promise((resolve) => server.once('exit', resolve));
  let stopping = null;
  const stop = () => {
    if (!stopping) {
      killGroup('SIGTERM');
      stopping = Promise.race([exited, new Promise((r) => setTimeout(r, 5000))]).then(() => killGroup('SIGKILL'));
    }
    return stopping;
  };
  process.once('exit', () => killGroup('SIGKILL'));
  let log = '';
  server.stdout.on('data', (d) => { log += d; });
  server.stderr.on('data', (d) => { log += d; });
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${origin}/about`, { headers });
      if (r.status === 200) return { origin, headers, stop };
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  await stop();
  return { failures: [`next start (${mode}) did not serve /about with 200 within 120s\n${log.slice(-2000)}`] };
}

/** Sends the beta-wall credentials to the local origin only: as a context-wide extraHTTPHeaders they also reach cdn.sanity.io, which
 * then refuses every hero image (preview slides decode to naturalWidth 0). */
export async function authorize(ctx, srv) {
  if (!srv.headers || !srv.headers.authorization) return;
  await ctx.route(`${srv.origin}/**`, (route) => route.continue({ headers: { ...route.request().headers(), ...srv.headers } }));
}

// The installed Google Chrome when present (Brad, 2026-10-22: Playwright's headless shell is not installed), else Playwright's own.
// NOS_HB2_CHROME overrides the path.
const CHROME = process.env.NOS_HB2_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const launchOptions = () => (existsSync(CHROME) ? { executablePath: CHROME, headless: true } : { headless: true });
