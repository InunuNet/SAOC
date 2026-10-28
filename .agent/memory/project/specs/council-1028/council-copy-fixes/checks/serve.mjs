// Starts `next dev` on a free port in fixture-replay mode (no Sanity or Firestore traffic, beta wall off) and stops exactly that PID. Both site
// origins differ (saoc.localhost / nos.localhost), so a request carries the NOS host in its Host header. COUNCIL_PORT reuses a server you already run.
import { spawn } from 'node:child_process';
import http from 'node:http';
import { createServer } from 'node:net';

const FIXTURE_DIR = '.agent/memory/project/specs/nos-content-standard/fixtures/sanity';
const READY_TIMEOUT_MS = 420_000;
const REQUEST_TIMEOUT_MS = 180_000;

const freePort = () => new Promise((resolve, reject) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); }); s.on('error', reject); });

/** GET path on the given host name (nos | saoc) of the local server; resolves { status, body }. */
export function get(port, host, path) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, headers: { Host: `${host}.localhost:${port}` }, timeout: REQUEST_TIMEOUT_MS }, (res) => {
      const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('timeout', () => req.destroy(new Error(`timeout ${host}${path}`)));
    req.on('error', reject); req.end();
  });
}

export async function withServer(fn) {
  let child = null; let port = Number(process.env.COUNCIL_PORT || 0);
  if (!port) {
    port = await freePort();
    child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--port', String(port)], {
      stdio: 'ignore',
      env: { ...process.env, BETA_BASIC_AUTH_USER: '', BETA_BASIC_AUTH_PASSWORD: '', BETA_PASSWORD_WALL_OFF: 'true', SANITY_FIXTURE_MODE: 'replay', SANITY_FIXTURE_DIR: FIXTURE_DIR, NEXT_PUBLIC_SAOC_SITE_URL: `http://saoc.localhost:${port}`, NEXT_PUBLIC_NOS_SITE_URL: `http://nos.localhost:${port}` },
    });
    const deadline = Date.now() + READY_TIMEOUT_MS;
    for (;;) {
      try { const r = await get(port, 'nos', '/what-to-expect'); if (r.status === 200) break; } catch { /* not up yet */ }
      if (Date.now() > deadline) { child.kill(); throw new Error('dev server did not serve nos /what-to-expect in time'); }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  try { return await fn({ port, get: (host, path) => get(port, host, path) }); } finally { if (child) child.kill(); }
}
