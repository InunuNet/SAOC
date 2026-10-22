// Shared build + `next start` launcher for the nos-archive-public-r64 (r64) rendered checks (QA input, hash-locked; the r20/rHB/rFE pattern).
// The withhold switch (withholdPlaceholderProse, lib/data/show-pages.ts) is read when a page is prerendered, so PUBLIC and PREVIEW are two
// production builds. Both read the live Sanity dataset and the sold counts (.env.local); nothing here writes anywhere but .next.
// ensureBuild(mode) keeps one stamped build per mode: the live one in .next (stamp .next/EX_MODE) and the other parked under
// .tmp/ex-next/<mode> (gitignored). A build is reused only when it carries the stamp and no changed path (vs BASE) is newer than its
// BUILD_ID and the build's source fingerprint (the diff against BASE, so a revert counts as a change too: F2 amendment) still
// matches; otherwise the variant generator and `next build` run with that mode's env (3 tries: the Google Fonts fetch fails
// transiently). NOS_ARCH_NO_BUILD=1 reports a missing/stale build instead of building.
//   public   SITE_PUBLIC_LAUNCH=true, no beta wall, no preview opt-in            -> withholdPlaceholderProse() === true
//   preview  beta wall up (basic auth), SHOW_PLACEHOLDER_PREVIEW=true, not launched -> withholdPlaceholderProse() === false
// The caller's NODE_OPTIONS (the Chrome shim, `--require ../r19-chrome/use-chrome.cjs` from the worktree) never reaches the build or
// the server: a preload path with spaces broke `next build`. Ports 3010-3019, never 3002, 3013 or 3016. stop() kills only the process
// group this module spawned.
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { createRequire } from 'node:module';

import { BASE, SPEC_PREFIX, DOC, changedPaths, checksDir, git, repoRoot } from './_lib.mjs';

const USER = 'nos-arch';
const PASS = 'local-render-check';
export const AUTH = `Basic ${Buffer.from(`${USER}:${PASS}`).toString('base64')}`;
export const require = createRequire(path.join(repoRoot, 'package.json'));
export const MODES = ['public', 'preview'];
// A healthy build here takes a few minutes; past this the group is killed and the attempt counts as failed.
const BUILD_TIMEOUT_MS = 300_000;
const RESERVED_PORTS = [3002, 3013, 3016];

const NEXT = path.join(repoRoot, '.next');
const PARK = path.join(repoRoot, '.tmp', 'ex-next');
const STAMP = 'EX_MODE';

export function modeEnv(mode) {
  const base = { ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', NODE_OPTIONS: '' };
  if (mode === 'public') return { ...base, BETA_BASIC_AUTH_USER: '', BETA_BASIC_AUTH_PASSWORD: '', SITE_PUBLIC_LAUNCH: 'true', SHOW_PLACEHOLDER_PREVIEW: '' };
  if (mode === 'preview') return { ...base, BETA_BASIC_AUTH_USER: USER, BETA_BASIC_AUTH_PASSWORD: PASS, SITE_PUBLIC_LAUNCH: '', SHOW_PLACEHOLDER_PREVIEW: 'true' };
  throw new Error(`unknown mode ${mode}`);
}

const stampOf = (dir) => { try { return readFileSync(path.join(dir, STAMP), 'utf8').split('\n')[0].trim(); } catch { return null; } };
const printOf = (dir) => { try { return readFileSync(path.join(dir, STAMP), 'utf8').split('\n')[1]?.trim() ?? null; } catch { return null; } };

// The source the build was made from: a hash of the tracked diff and the changed files against BASE (spec dir and doc excluded).
function fingerprint() {
  const h = createHash('sha256');
  h.update(git('diff', BASE, '--', '.', `:(exclude)${SPEC_PREFIX}`, `:(exclude)${DOC}`));
  for (const p of [...changedPaths()].filter((x) => !x.startsWith(SPEC_PREFIX) && x !== DOC).sort()) {
    h.update(p);
    if (existsSync(path.join(repoRoot, p))) h.update(readFileSync(path.join(repoRoot, p)));
  }
  return h.digest('hex');
}

function freshness(dir) {
  const id = path.join(dir, 'BUILD_ID');
  if (!existsSync(id)) return ['no BUILD_ID'];
  if (printOf(dir) !== fingerprint()) return ['the source differs from the one the build was made from'];
  const builtAt = statSync(id).mtimeMs;
  return [...changedPaths()]
    .filter((p) => !p.startsWith(SPEC_PREFIX) && p !== DOC && existsSync(path.join(repoRoot, p)) && statSync(path.join(repoRoot, p)).mtimeMs > builtAt)
    .map((p) => `${p} changed after the build`);
}

/** Returns [] when .next is a fresh build of `mode`, else the reasons it could not be made one. */
export function ensureBuild(mode) {
  if (stampOf(NEXT) === mode && freshness(NEXT).length === 0) return [];
  const parked = path.join(PARK, mode);
  if (stampOf(parked) === mode && freshness(parked).length === 0) {
    park();
    renameSync(parked, NEXT);
    return [];
  }
  if (process.env.NOS_ARCH_NO_BUILD === '1') return [`no fresh ${mode} build (NOS_ARCH_NO_BUILD=1): ${[...freshness(NEXT), `stamp ${stampOf(NEXT)}`].join('; ')}`];
  park();
  const env = modeEnv(mode);
  const print = fingerprint();
  // The package build script runs the WebP variant generator before `next build` (public/images/_opt is gitignored).
  const v = spawnSync(process.execPath, ['scripts/generate-image-variants.mjs'], { cwd: repoRoot, env, encoding: 'utf8', maxBuffer: 67108864 });
  if (v.status !== 0) return [`image variants (${mode}) failed: ${`${v.stdout}${v.stderr}`.slice(-3000)}`];
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = spawnSync(process.execPath, [path.join(checksDir, '_build.mjs'), path.join(repoRoot, 'node_modules', '.bin', 'next'), String(BUILD_TIMEOUT_MS)], { cwd: repoRoot, env, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    if (r.status === 0) {
      writeFileSync(path.join(NEXT, STAMP), `${mode}\n${print}\n`);
      return [];
    }
    if (attempt === 3) return [`next build (${mode}) failed 3 times:\n${`${r.stdout}${r.stderr}`.slice(-3000)}`];
  }
  return [];
}

// Moves the live .next aside: a stamped build is parked under its mode, an unstamped one (the dev's own build) is discarded.
function park() {
  if (!existsSync(NEXT)) return;
  const stamp = stampOf(NEXT);
  if (MODES.includes(stamp)) {
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

/** Builds (if needed) and serves `mode`. Returns { origin, headers, stop } or { failures }. NOS_ARCH_ORIGIN_<MODE> skips both. */
export async function serve(mode, extra = {}) {
  const headers = mode === 'preview' ? { authorization: AUTH } : {};
  const fixed = process.env[`NOS_ARCH_ORIGIN_${mode.toUpperCase()}`];
  if (fixed) return { origin: fixed.replace(/\/$/, ''), headers, stop: async () => {} };
  const failures = ensureBuild(mode);
  if (failures.length) return { failures };
  let port = null;
  for (let p = Number(process.env.NOS_ARCH_PORT || 3010); p <= 3019; p += 1) {
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
 * then refuses its images. */
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
