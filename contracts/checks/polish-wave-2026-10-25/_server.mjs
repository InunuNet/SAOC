// `next start` launcher for the polish-wave rendered checks. Serves the existing production build
// in .next with the beta password prompt lifted (BETA_PASSWORD_WALL_OFF, the committee-testing switch), on a free port in 3030-3049 (never 3002). SAOC pages are
// reached as localhost:<port>, NOS pages as nos.localhost:<port> (lib/site-hosts.ts dev rule).
// Requires a build made with NEXT_PUBLIC_SAOC_SITE_URL=http://localhost:3002 and
// NEXT_PUBLIC_NOS_SITE_URL=http://nos.localhost:3002 (only the hostnames matter, not the port).
import { spawn } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

import { repoRoot } from './_lib.mjs';

export const require = createRequire(resolve(repoRoot, 'package.json'));

export function buildProblem(sourceFiles) {
  const buildId = resolve(repoRoot, '.next/BUILD_ID');
  if (!existsSync(buildId)) return ['no production build (.next/BUILD_ID): run pnpm build first'];
  const builtAt = statSync(buildId).mtimeMs;
  return sourceFiles
    .filter((rel) => statSync(resolve(repoRoot, rel)).mtimeMs > builtAt)
    .map((rel) => `stale build: ${rel} changed after .next/BUILD_ID`);
}

function portFree(port) {
  return new Promise((done) => {
    const s = net.createServer().once('error', () => done(false)).once('listening', () => s.close(() => done(true)));
    s.listen(port, '127.0.0.1');
  });
}

// GET with an explicit Host header (Node's fetch cannot resolve nos.localhost reliably).
export function get(port, path, host) {
  return new Promise((done, fail) => {
    const req = http.request({ host: '127.0.0.1', port, path, method: 'GET', headers: { Host: `${host}:${port}` } }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (d) => { body += d; });
      res.on('end', () => done({ status: res.statusCode ?? 0, headers: res.headers, body }));
    });
    req.on('error', fail);
    req.end();
  });
}

export async function startServer({ preview = false, env: extraEnv = {} } = {}) {
  let port = null;
  for (let p = Number(process.env.POLISH_PORT || 3030); p <= 3049; p += 1) {
    if (p !== 3002 && (await portFree(p))) { port = p; break; }
  }
  if (!port) throw new Error('no free port in 3030-3049');
  const env = { ...process.env, NODE_ENV: 'production', BETA_PASSWORD_WALL_OFF: 'true', ...extraEnv };
  if (preview) {
    // Runtime-only preview mode (SHOW_PLACEHOLDER_PREVIEW plus wall credentials), like the deployed beta:
    // the build that produced .next never saw these, so a page frozen at build time shows the public nav.
    env.SHOW_PLACEHOLDER_PREVIEW = 'true';
    env.BETA_BASIC_AUTH_USER = 'polish';
    env.BETA_BASIC_AUTH_PASSWORD = 'polish-render-check';
  } else {
    delete env.BETA_BASIC_AUTH_USER;
    delete env.BETA_BASIC_AUTH_PASSWORD;
  }
  const server = spawn(resolve(repoRoot, 'node_modules/.bin/next'), ['start', '-p', String(port), '-H', '::'], {
    cwd: repoRoot, env, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  server.stdout.on('data', (d) => { log += d; });
  server.stderr.on('data', (d) => { log += d; });
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const r = await get(port, '/about', 'localhost');
      if (r.status === 200) return { port, stop: () => server.kill('SIGTERM') };
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  server.kill('SIGTERM');
  throw new Error(`next start did not serve /about with 200 within 120s\n${log.slice(-1500)}`);
}
