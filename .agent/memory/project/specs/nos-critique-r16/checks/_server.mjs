// Shared build + `next start` launcher for the nos-critique-r16 rendered checks (QA input, hash-locked).
// The withhold switch (withholdPlaceholderProse, lib/data/show-pages.ts) is read when a page is prerendered, so PUBLIC and PREVIEW are two
// production builds (F24 spec: "public and preview are two builds"). ensureBuild(mode) keeps one stamped build per mode: the live one in
// .next (stamp .next/R16_MODE) and the other parked under .tmp/r16-next/<mode> (gitignored). A build is reused only when it carries the
// mode stamp and no changed path (vs BASE) is newer than its BUILD_ID; otherwise `pnpm build` runs with that mode's env (3 tries: the
// Google Fonts fetch fails transiently). NOS_CR16_NO_BUILD=1 reports a missing/stale build instead of building.
//   public   SITE_PUBLIC_LAUNCH=true, no beta wall, no preview opt-in            -> withholdPlaceholderProse() === true
//   preview  beta wall up (basic auth), SHOW_PLACEHOLDER_PREVIEW=true, not launched -> withholdPlaceholderProse() === false
// Ports 3010-3019, never 3002 or 3013 (the lead's). stop() kills only the process group this module spawned.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { createRequire } from 'node:module';

import { SPEC_PREFIX, DOC, changedPaths, repoRoot } from './_lib.mjs';

const USER = 'nos-critique-r16';
const PASS = 'local-render-check';
export const AUTH = `Basic ${Buffer.from(`${USER}:${PASS}`).toString('base64')}`;
export const require = createRequire(path.join(repoRoot, 'package.json'));
export const MODES = ['public', 'preview'];

const NEXT = path.join(repoRoot, '.next');
const PARK = path.join(repoRoot, '.tmp', 'r16-next');
const STAMP = 'R16_MODE';

export function modeEnv(mode) {
  const base = { ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' };
  if (mode === 'public') return { ...base, BETA_BASIC_AUTH_USER: '', BETA_BASIC_AUTH_PASSWORD: '', SITE_PUBLIC_LAUNCH: 'true', SHOW_PLACEHOLDER_PREVIEW: '' };
  if (mode === 'preview') return { ...base, BETA_BASIC_AUTH_USER: USER, BETA_BASIC_AUTH_PASSWORD: PASS, SITE_PUBLIC_LAUNCH: '', SHOW_PLACEHOLDER_PREVIEW: 'true' };
  throw new Error(`unknown mode ${mode}`);
}

const stampOf = (dir) => { try { return readFileSync(path.join(dir, STAMP), 'utf8').trim(); } catch { return null; } };

function freshness(dir) {
  const id = path.join(dir, 'BUILD_ID');
  if (!existsSync(id)) return ['no BUILD_ID'];
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
  if (process.env.NOS_CR16_NO_BUILD === '1') return [`no fresh ${mode} build (NOS_CR16_NO_BUILD=1): ${[...freshness(NEXT), `stamp ${stampOf(NEXT)}`].join('; ')}`];
  park();
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = spawnSync(path.join(repoRoot, 'node_modules', '.bin', 'next'), ['build'], { cwd: repoRoot, env: modeEnv(mode), encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    if (r.status === 0) {
      writeFileSync(path.join(NEXT, STAMP), `${mode}\n`);
      return [];
    }
    if (attempt === 3) return [`next build (${mode}) failed 3 times:\n${`${r.stdout}${r.stderr}`.slice(-3000)}`];
  }
  return [];
}

// Moves the live .next aside: a stamped build is parked under its mode, an unstamped one (the dev's own build) is discarded.
function park() {
  if (!existsSync(NEXT)) return;
  const mode = stampOf(NEXT);
  if (MODES.includes(mode)) {
    mkdirSync(PARK, { recursive: true });
    rmSync(path.join(PARK, mode), { recursive: true, force: true });
    renameSync(NEXT, path.join(PARK, mode));
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

/** Builds (if needed) and serves `mode`. Returns { origin, headers, stop } or { failures }. NOS_CR16_ORIGIN_<MODE> skips both. */
export async function serve(mode) {
  const headers = mode === 'preview' ? { authorization: AUTH } : {};
  const fixed = process.env[`NOS_CR16_ORIGIN_${mode.toUpperCase()}`];
  if (fixed) return { origin: fixed.replace(/\/$/, ''), headers, stop: async () => {} };
  const failures = ensureBuild(mode);
  if (failures.length) return { failures };
  let port = null;
  for (let p = Number(process.env.NOS_CR16_PORT || 3010); p <= 3019; p += 1) {
    if (p !== 3002 && p !== 3013 && (await portFree(p))) { port = p; break; }
  }
  if (!port) return { failures: ['no free port in 3010-3019 (3013 is reserved for the lead)'] };
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

/** axe-core source path (not a direct dependency: resolved directly, else from the pnpm store). */
export function axeSource() {
  try {
    return require.resolve('axe-core/axe.min.js');
  } catch {
    const store = path.join(repoRoot, 'node_modules', '.pnpm');
    const { readdirSync } = require('node:fs');
    const dir = existsSync(store) ? readdirSync(store).filter((n) => n.startsWith('axe-core@')).sort().pop() : undefined;
    if (!dir) throw new Error('INFRA: axe-core not found (direct or in node_modules/.pnpm)');
    return path.join(store, dir, 'node_modules', 'axe-core', 'axe.min.js');
  }
}
