// Shared build + `next start` launcher for the nos-hero-banding rendered checks (QA input, hash-locked; the r20 pattern).
// The withhold switch (withholdPlaceholderProse, lib/data/show-pages.ts) is read when a page is prerendered, so PUBLIC and PREVIEW are two
// production builds. Both point at the live Sanity dataset (.env.local). By default each build and server runs with the test-only
// preload checks/hero-filter.cjs, which drops the starved yellow asset a620a97f from the Sanity responses (the lead removes it in Sanity
// after rHB is live; shipped code never names it). `{ yellow: true }` runs without the filter (the calibration on BASE, f1-rendered.mjs
// --calibrate). ensureBuild(mode, opts) keeps one stamped build per stamp (mode, or mode+yellow): the live one in .next (stamp
// .next/RHB_MODE) and the others parked under .tmp/rhb-next/<stamp> (gitignored). A build is reused only when it carries the stamp and no
// changed path (vs BASE) is newer than its BUILD_ID; otherwise the variant generator and `next build` run with that stamp's env (3 tries:
// the Google Fonts fetch fails transiently). NOS_RHB_NO_BUILD=1 reports a missing/stale build instead of building.
//   public   SITE_PUBLIC_LAUNCH=true, no beta wall, no preview opt-in            -> withholdPlaceholderProse() === true
//   preview  beta wall up (basic auth), SHOW_PLACEHOLDER_PREVIEW=true, not launched -> withholdPlaceholderProse() === false
// Ports 3010-3019, never 3002, 3013 or 3016 (the lead's and other sessions'). stop() kills only the process group this module spawned.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { createRequire } from 'node:module';

import { SPEC_PREFIX, DOC, changedPaths, checksDir, repoRoot } from './_lib.mjs';

const USER = 'nos-hero-banding';
const PASS = 'local-render-check';
export const AUTH = `Basic ${Buffer.from(`${USER}:${PASS}`).toString('base64')}`;
export const require = createRequire(path.join(repoRoot, 'package.json'));
export const MODES = ['public', 'preview'];
const RESERVED_PORTS = [3002, 3013, 3016];

const NEXT = path.join(repoRoot, '.next');
const PARK = path.join(repoRoot, '.tmp', 'rhb-next');
const STAMP = 'RHB_MODE';
const FILTER = path.join(checksDir, 'hero-filter.cjs');
// Relative to the child's cwd (repoRoot): an absolute path here carries the checkout's spaces into NODE_OPTIONS, which broke `next build`.
const FILTER_OPTION = `--require ./${path.relative(repoRoot, FILTER).split(path.sep).join('/')}`;

const stampFor = (mode, yellow) => (yellow ? `${mode}+yellow` : mode);

export function modeEnv(mode, { yellow = false } = {}) {
  // The child gets only the harness preload (never the caller's NODE_OPTIONS, e.g. the Chrome shim for Playwright).
  const base = { ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', NODE_OPTIONS: yellow ? '' : FILTER_OPTION };
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
    .filter((p) => !p.startsWith(SPEC_PREFIX) && p !== DOC && existsSync(path.join(repoRoot, p)) && statSync(path.join(repoRoot, p)).mtimeMs > builtAt)
    .map((p) => `${p} changed after the build`);
  if (statSync(FILTER).mtimeMs > builtAt) stale.push('checks/hero-filter.cjs changed after the build');
  return stale;
}

/** Returns [] when .next is a fresh build of the stamp, else the reasons it could not be made one. */
export function ensureBuild(mode, opts = {}) {
  const stamp = stampFor(mode, opts.yellow === true);
  if (stampOf(NEXT) === stamp && freshness(NEXT).length === 0) return [];
  const parked = path.join(PARK, stamp);
  if (stampOf(parked) === stamp && freshness(parked).length === 0) {
    park();
    renameSync(parked, NEXT);
    return [];
  }
  if (process.env.NOS_RHB_NO_BUILD === '1') return [`no fresh ${stamp} build (NOS_RHB_NO_BUILD=1): ${[...freshness(NEXT), `stamp ${stampOf(NEXT)}`].join('; ')}`];
  park();
  const env = modeEnv(mode, opts);
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

/** Builds (if needed) and serves `mode`. Returns { origin, headers, stop } or { failures }. NOS_RHB_ORIGIN_<MODE> skips both. */
export async function serve(mode, opts = {}) {
  const headers = mode === 'preview' ? { authorization: AUTH } : {};
  const fixed = process.env[`NOS_RHB_ORIGIN_${mode.toUpperCase()}${opts.yellow ? '_YELLOW' : ''}`];
  if (fixed) return { origin: fixed.replace(/\/$/, ''), headers, stop: async () => {} };
  const failures = ensureBuild(mode, opts);
  if (failures.length) return { failures };
  let port = null;
  for (let p = Number(process.env.NOS_RHB_PORT || 3010); p <= 3019; p += 1) {
    if (!RESERVED_PORTS.includes(p) && (await portFree(p))) { port = p; break; }
  }
  if (!port) return { failures: [`no free port in 3010-3019 (${RESERVED_PORTS.join(', ')} are reserved)`] };
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn(path.join(repoRoot, 'node_modules', '.bin', 'next'), ['start', '-p', String(port), '-H', '127.0.0.1'], {
    cwd: repoRoot,
    env: modeEnv(mode, opts),
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

/** axe-core source path (not a direct dependency: resolved directly, else from the pnpm store). */
export function axeSource() {
  try {
    return require.resolve('axe-core/axe.min.js');
  } catch {
    const store = path.join(repoRoot, 'node_modules', '.pnpm');
    const dir = existsSync(store) ? readdirSync(store).filter((n) => n.startsWith('axe-core@')).sort().pop() : undefined;
    if (!dir) throw new Error('INFRA: axe-core not found (direct or in node_modules/.pnpm)');
    return path.join(store, dir, 'node_modules', 'axe-core', 'axe.min.js');
  }
}
