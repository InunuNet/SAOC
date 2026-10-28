// council-copy-fixes server helper. Serves a PRODUCTION build (`next start`) through the nos-content-standard library, in fixture-replay mode (no Sanity or
// Firestore traffic, beta basic-auth). It never runs `next dev`: dev deletes .next/BUILD_ID, which made the later production gates (A7-A9) report "no
// production build". The build is made here when .next/BUILD_ID is missing or older than the newest tracked source file, by the same build.sh the gates use,
// so A2 never tests a stale build and later gates reuse the fresh one. Env that apphosting.yaml supplies in production is set here, not left to the runner.
import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import http from 'node:http';
import { startServer, waitReady, AUTH } from '../../../nos-content-standard/checks/_lib.mjs';

const PORT_OFFSET = 9;
const REQUEST_TIMEOUT_MS = 180_000;
const BUILD_SCRIPT = '.agent/memory/project/specs/nos-content-standard/checks/build.sh';
const SOURCE_DIRS = ['app', 'components', 'lib', 'sanity', 'public', 'types', 'next.config.ts', 'package.json', 'pnpm-lock.yaml'];
// From apphosting.yaml (variable / value pairs), set explicitly so the check never depends on the runner's environment.
const PROD_ENV = { NEXT_PUBLIC_SANITY_PROJECT_ID: '26yfbug4', NEXT_PUBLIC_SANITY_DATASET: 'production', SHOW_PLACEHOLDER_PREVIEW: 'true' };

function buildIsFresh() {
  if (!existsSync('.next/BUILD_ID')) return false;
  const builtAt = statSync('.next/BUILD_ID').mtimeMs;
  const files = spawnSync('git', ['ls-files', '-z', '--', ...SOURCE_DIRS], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).stdout.split('\0').filter(Boolean);
  return files.every((f) => !existsSync(f) || statSync(f).mtimeMs <= builtAt);
}

/** GET path on the given host name (nos | saoc) of the local server; resolves { status, body }. */
function get(port, host, path) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, headers: { Host: `${host}.localhost:${port}`, authorization: AUTH }, timeout: REQUEST_TIMEOUT_MS }, (res) => {
      const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('timeout', () => req.destroy(new Error(`timeout ${host}${path}`)));
    req.on('error', reject); req.end();
  });
}

export async function withServer(fn) {
  Object.assign(process.env, PROD_ENV);
  if (!buildIsFresh()) {
    const b = spawnSync('bash', [BUILD_SCRIPT], { stdio: 'inherit', env: { ...process.env, ...PROD_ENV } });
    if (b.status !== 0) throw new Error(`production build failed (${BUILD_SCRIPT} exit ${b.status})`);
  }
  const server = startServer(PORT_OFFSET, { preview: true });
  try {
    await waitReady(server);
    return await fn({ port: server.port, get: (host, path) => get(server.port, host, path) });
  } finally { server.proc.kill(); }
}
