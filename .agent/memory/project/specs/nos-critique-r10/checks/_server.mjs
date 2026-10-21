// Shared `next start` launcher for the nos-critique-r10 rendered checks (QA input, hash-locked).
// Picks a free port in 3010-3019 (never 3002), serves the existing production build with beta
// basic-auth env, and resolves once /national-show answers 200.
import { spawn } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { createRequire } from 'node:module';

import { repoRoot } from './_lib.mjs';

const USER = 'nos-critique-r10';
const PASS = 'local-render-check';
export const AUTH = `Basic ${Buffer.from(`${USER}:${PASS}`).toString('base64')}`;
export const require = createRequire(path.join(repoRoot, 'package.json'));

export function assertFreshBuild(sourceFiles) {
  const buildId = path.join(repoRoot, '.next', 'BUILD_ID');
  if (!existsSync(buildId)) return ['no production build (.next/BUILD_ID) — run pnpm build first'];
  const builtAt = statSync(buildId).mtimeMs;
  return sourceFiles
    .filter((rel) => statSync(path.join(repoRoot, rel)).mtimeMs > builtAt)
    .map((rel) => `stale build: ${rel} changed after .next/BUILD_ID — run pnpm build`);
}

function portFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer().once('error', () => resolve(false)).once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, '127.0.0.1');
  });
}

export async function startServer({ publicMode = false } = {}) {
  let port = null;
  for (let p = Number(process.env.NOS_CR10_PORT || 3010); p <= 3019; p += 1) {
    if (p !== 3002 && (await portFree(p))) { port = p; break; }
  }
  if (!port) throw new Error('no free port in 3010-3019');
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn(path.join(repoRoot, 'node_modules', '.bin', 'next'), ['start', '-p', String(port), '-H', '127.0.0.1'], {
    cwd: repoRoot,
    env: publicMode ? { ...process.env, BETA_BASIC_AUTH_USER: '', BETA_BASIC_AUTH_PASSWORD: '', SITE_PUBLIC_LAUNCH: 'true', NODE_ENV: 'production' } : { ...process.env, BETA_BASIC_AUTH_USER: USER, BETA_BASIC_AUTH_PASSWORD: PASS, NODE_ENV: 'production' },
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
      const r = await fetch(`${origin}/national-show`, { headers: publicMode ? {} : { authorization: AUTH } });
      if (r.status === 200) return { origin, port, stop };
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  await stop();
  throw new Error(`next start did not serve /national-show with 200 within 120s\n${log.slice(-2000)}`);
}
