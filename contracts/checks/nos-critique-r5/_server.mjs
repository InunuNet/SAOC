// Shared `next start` launcher for the nos-critique-r5 rendered checks (QA input, hash-locked).
// Picks a free port in 3010-3019 (never 3002), serves the existing production build with beta
// basic-auth env, and resolves once /national-show answers 200.
import { spawn } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { createRequire } from 'node:module';

import { gitRoot } from './_lib.mjs';

const USER = 'nos-critique-r5';
const PASS = 'local-render-check';
export const AUTH = `Basic ${Buffer.from(`${USER}:${PASS}`).toString('base64')}`;
export const require = createRequire(path.join(gitRoot, 'package.json'));

export function assertFreshBuild(sourceFiles) {
  const buildId = path.join(gitRoot, '.next', 'BUILD_ID');
  if (!existsSync(buildId)) return ['no production build (.next/BUILD_ID) — run pnpm build first'];
  const builtAt = statSync(buildId).mtimeMs;
  return sourceFiles
    .filter((rel) => statSync(path.join(gitRoot, rel)).mtimeMs > builtAt)
    .map((rel) => `stale build: ${rel} changed after .next/BUILD_ID — run pnpm build`);
}

function portFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer().once('error', () => resolve(false)).once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, '127.0.0.1');
  });
}

export async function startServer() {
  let port = null;
  for (let p = Number(process.env.NOS_CR5_PORT || 3010); p <= 3019; p += 1) {
    if (p !== 3002 && (await portFree(p))) { port = p; break; }
  }
  if (!port) throw new Error('no free port in 3010-3019');
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn(path.join(gitRoot, 'node_modules', '.bin', 'next'), ['start', '-p', String(port), '-H', '127.0.0.1'], {
    cwd: gitRoot,
    env: { ...process.env, BETA_BASIC_AUTH_USER: USER, BETA_BASIC_AUTH_PASSWORD: PASS, NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  server.stdout.on('data', (d) => { log += d; });
  server.stderr.on('data', (d) => { log += d; });
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${origin}/national-show`, { headers: { authorization: AUTH } });
      if (r.status === 200) return { origin, port, stop: () => server.kill('SIGTERM') };
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  server.kill('SIGTERM');
  throw new Error(`next start did not serve /national-show with 200 within 120s\n${log.slice(-2000)}`);
}
