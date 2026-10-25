// Shared helpers for the nos-content-standard gates: goldens, a `next start` on a port this gate owns (killed by exact child PID),
// a Playwright launcher and a failure collector. Run from the repo root after build.sh.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import net from 'node:net';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, openSync, readFileSync } from 'node:fs';

const SPEC = '.agent/memory/project/specs/nos-content-standard';
export const STD = JSON.parse(readFileSync(`${SPEC}/goldens/standard.json`, 'utf8'));
const ALL_ROUTES = JSON.parse(readFileSync(`${SPEC}/goldens/route-table.json`, 'utf8')).routes;
export const EXCLUDED = ALL_ROUTES.filter((r) => r.excluded);
export const ROUTES = ALL_ROUTES.filter((r) => !r.excluded);
export const CROPS = JSON.parse(readFileSync(`${SPEC}/goldens/crops/crop-proposals.json`, 'utf8')).crops;
export const BASE_PORT = Number(process.env.NOS_STD_PORT ?? 3091);
export const AUTH_USER = 'sandbox';
export const AUTH_PASS = 'sandbox-pass';
export const AUTH = `Basic ${Buffer.from(`${AUTH_USER}:${AUTH_PASS}`).toString('base64')}`;
const LOG_DIR = '.tmp/sandbox/nos-content-standard-gate';
mkdirSync(LOG_DIR, { recursive: true });

export const normalise = (t) => t.replace(/[ \s]+/g, ' ').trim();

/** The Drive source state of a route, read from the frozen copy: ok, or why not. A route with no source is a GAP (listed); a corrupt, edited or
 missing frozen copy is a hard failure (the sha256 recorded in the route table must match). */
export function driveState(route) {
  if (!route.drive) return { state: route.verifiedBySaoc ? 'verified-by-saoc' : 'gap', text: '' };
  if (!existsSync(route.drive.path)) return { state: 'missing', text: '' };
  const buf = readFileSync(route.drive.path);
  const text = buf.toString('utf8');
  if (createHash('sha256').update(buf).digest('hex') !== route.drive.sha256) return { state: 'edited-after-freeze', text };
  if (text.trim() === '' || /^\[ERROR\]/.test(text.trim())) return { state: 'corrupt', text };
  return { state: 'ok', text };
}

export function startServer(offset, { preview = true } = {}) {
  const port = BASE_PORT + offset;
  const env = {
    ...process.env, NODE_ENV: 'production', BETA_BASIC_AUTH_USER: AUTH_USER, BETA_BASIC_AUTH_PASSWORD: AUTH_PASS, SITE_PUBLIC_LAUNCH: '',
    NEXT_PUBLIC_NOS_SITE_URL: `http://nos.localhost:${port}`, NEXT_PUBLIC_SAOC_SITE_URL: `http://saoc.localhost:${port}`,
  };
  delete env.BETA_PASSWORD_WALL_OFF;
  if (preview) env.SHOW_PLACEHOLDER_PREVIEW = 'true'; else delete env.SHOW_PLACEHOLDER_PREVIEW;
  const log = openSync(`${LOG_DIR}/next-start-${port}.log`, 'w');
  const proc = spawn('node_modules/.bin/next', ['start', '-p', String(port)], { stdio: ['ignore', log, log], env });
  return { port, proc, nos: `http://nos.localhost:${port}` };
}

export async function waitReady(server) {
  for (let i = 0; i < 90; i += 1) {
    try { const r = await fetch(`${server.nos}/faq`, { headers: { authorization: AUTH } }); if (r.status < 500) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('server never became ready');
}

export async function launchChromium() {
  const require = createRequire(`${process.cwd()}/package.json`);
  const { chromium } = require('@playwright/test');
  return chromium.launch();
}

export function newContext(browser, vp, extra = {}) {
  return browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dsf, httpCredentials: { username: AUTH_USER, password: AUTH_PASS }, ...extra });
}

export function collector(label) {
  const failures = [];
  return {
    check: (name, ok, detail = '') => { if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ''}`); },
    note: (line) => console.log(line),
    finish(server) {
      this.done = true;
      server?.proc.kill(); // the exact child this gate spawned; never pkill, never by name
      if (failures.length) { console.error(`${label} FAILED:\n- ${failures.join('\n- ')}`); process.exit(1); }
      console.log(`${label} pass`);
      process.exit(0);
    },
    fail: (e) => failures.push(`exception ${e.message}`),
  };
}

export async function withServer(offset, label, body, opts) {
  const c = collector(label);
  const port = BASE_PORT + offset;
  const busy = await new Promise((resolve) => { const s = net.createConnection({ port, host: '127.0.0.1' }); s.once('connect', () => { s.destroy(); resolve(true); }); s.once('error', () => resolve(false)); });
  if (busy) { c.fail(new Error(`port ${port} is already in use (stale next start?); stop that PID or set NOS_STD_PORT`)); console.error(`port ${port} is already in use`); c.finish(null); }
  const server = startServer(offset, opts);
  server.proc.on('exit', (code, signal) => { if (!c.done) { c.fail(new Error(`next start exited early (code ${code}, signal ${signal}); see ${LOG_DIR}/next-start-${server.port}.log`)); console.error(`next start exited early (code ${code}, signal ${signal})`); } });
  try { await waitReady(server); await body(server, c); } catch (e) { c.fail(e); console.error(e); }
  c.finish(server);
}
