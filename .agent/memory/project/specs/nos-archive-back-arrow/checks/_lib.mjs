// Shared helpers for the nos-archive-back-arrow gates: goldens, a `next start` on a port this gate owns (killed by its exact recorded PID, never pkill),
// a Playwright launcher and a failure collector. Run from the repo root after build.sh. Sanity is FIXTURE REPLAY only: the server and the browser make zero
// Sanity API requests (apicdn / api hosts are blocked and counted), and the gate fails if any occur or any fixture read misses.
import { spawn } from 'node:child_process';
import net from 'node:net';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { appendFileSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const SPEC_DIR = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
export const ROOT = process.cwd();
export const V = JSON.parse(readFileSync(`${SPEC_DIR}/goldens/values.json`, 'utf8'));
export const BASELINE_FILE = `${SPEC_DIR}/goldens/baseline-main.json`;
export const PORT = Number(process.env.NOS_ARROW_PORT ?? 3190);
export const AUTH_USER = 'sandbox';
export const AUTH_PASS = 'sandbox-pass';
export const AUTH = `Basic ${Buffer.from(`${AUTH_USER}:${AUTH_PASS}`).toString('base64')}`;
const LOG_DIR = `${ROOT}/.tmp/sandbox/nos-archive-back-arrow-gate`;
const PID_DIR = `${LOG_DIR}/pids`;
export const FIXTURE_DIR = `${ROOT}/.tmp/sandbox/nos-archive-back-arrow-fixtures/sanity`;
const BLOCK_NET = `${ROOT}/.agent/memory/project/specs/nos-content-standard/checks/block-sanity-net.cjs`;
const FIX_LOG = `${LOG_DIR}/fixture-logs-${PORT}`;
mkdirSync(PID_DIR, { recursive: true });
mkdirSync(FIX_LOG, { recursive: true });

// The environment that puts a child on fixture replay with the Sanity API blocked. The double quotes keep the repo path (it has spaces) in one NODE_OPTIONS token.
function fixtureEnv() {
  if (!existsSync(FIXTURE_DIR)) throw new Error(`the sandbox fixture copy is missing: ${FIXTURE_DIR} (run checks/build.sh first)`);
  for (const f of ['_started.log', '_hits.log', '_misses.log', '_requests.log', '_net.log', '_assets.log', '_browser-net.log']) writeFileSync(`${FIX_LOG}/${f}`, '');
  return { SANITY_FIXTURE_MODE: 'replay', SANITY_FIXTURE_DIR: FIXTURE_DIR, SANITY_FIXTURE_LOGDIR: FIX_LOG, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --require "${BLOCK_NET}"`.trim() };
}

/** `next start` on the A-build with the beta wall up and placeholder preview on (the NOS archive route is withheld in public mode until real records exist). */
export function startServer() {
  const env = {
    ...process.env, NODE_ENV: 'production', BETA_BASIC_AUTH_USER: AUTH_USER, BETA_BASIC_AUTH_PASSWORD: AUTH_PASS, SHOW_PLACEHOLDER_PREVIEW: 'true',
    NEXT_PUBLIC_NOS_SITE_URL: `http://nos.localhost:${PORT}`, NEXT_PUBLIC_SAOC_SITE_URL: `http://saoc.localhost:${PORT}`, SITE_URL: `http://nos.localhost:${PORT}`,
  };
  delete env.BETA_PASSWORD_WALL_OFF;
  delete env.SITE_PUBLIC_LAUNCH;
  delete env.K_SERVICE; // the fixture is inert on the hosted runtime; the gate is never hosted
  Object.assign(env, fixtureEnv());
  const log = openSync(`${LOG_DIR}/next-start-${PORT}.log`, 'w');
  const proc = spawn(`${ROOT}/node_modules/.bin/next`, ['start', '-p', String(PORT)], { cwd: ROOT, stdio: ['ignore', log, log], env });
  writeFileSync(`${PID_DIR}/${PORT}.pid`, String(proc.pid)); // the exact child PID is the only thing ever killed
  return { port: PORT, proc, nos: `http://nos.localhost:${PORT}` };
}

async function waitReady(server) {
  for (let i = 0; i < 90; i += 1) {
    try { const r = await fetch(`${server.nos}/faq`, { headers: { authorization: AUTH } }); if (r.status < 500) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('server never became ready');
}

/** Chromium for Playwright. If the default browser cache lacks the revision, point NOS_ARROW_PW_BROWSERS at a directory holding the reused build. */
export async function launchChromium() {
  if (process.env.NOS_ARROW_PW_BROWSERS) process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.NOS_ARROW_PW_BROWSERS;
  const require = createRequire(`${ROOT}/package.json`);
  const { chromium } = require('@playwright/test');
  return chromium.launch();
}

export async function newContext(browser, { reducedMotion = 'no-preference', viewport = { width: 1280, height: 900 } } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion, httpCredentials: { username: AUTH_USER, password: AUTH_PASS } });
  // The page must never call the Sanity GROQ API while the fixture is in use (cdn.sanity.io images are a separate quota and pass).
  await ctx.route(/^https?:\/\/([^/]+\.)?(apicdn|api)\.sanity\.io\//, (route) => { appendFileSync(`${FIX_LOG}/_browser-net.log`, `${route.request().url().slice(0, 160)}\n`); return route.abort(); });
  return ctx;
}

/** page.goto that waits for streaming to finish, fonts to load and layout to settle; returns the response. A failed navigation is recorded, never thrown. */
export async function gotoSettled(page, server, route, c) {
  let res = null;
  try { res = await page.goto(`${server.nos}${route}`, { waitUntil: 'load' }); } catch (e) { c.check(`navigate ${route}`, false, String(e.message).split('\n')[0]); return null; }
  c.check(`${route} responds 200 (got ${res?.status()})`, res?.status() === 200);
  await page.waitForFunction(() => !document.querySelector('[hidden][id^="S:"]') && !document.querySelector('template[id^="B:"]') && document.readyState === 'complete', null, { timeout: 25000 }).catch(() => c.check(`${route} streaming finished`, false));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  return res;
}

/** The fixture proof, written before the server is killed: replay ran, zero misses, zero Sanity API requests from the server and from the browser. */
function fixtureProof(c) {
  const lines = (f) => (existsSync(`${FIX_LOG}/${f}`) ? readFileSync(`${FIX_LOG}/${f}`, 'utf8').split('\n').filter(Boolean) : []);
  const started = lines('_started.log'); const hits = lines('_hits.log'); const misses = lines('_misses.log'); const netl = lines('_net.log'); const bnet = lines('_browser-net.log');
  c.check(`the server ran on fixture replay (${started.length} _started line(s), ${hits.length} hits)`, started.some((l) => l.includes('mode=replay')) && hits.length > 0);
  c.check(`no fixture miss (${misses.length}): ${misses.slice(0, 3).join(' | ')}`, misses.length === 0);
  c.check(`zero Sanity API requests from the server (${netl.length})`, netl.length === 0);
  c.check(`zero Sanity API requests from the browser (${bnet.length})`, bnet.length === 0);
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

export async function withServer(label, body) {
  const c = collector(label);
  const busy = await new Promise((resolve) => { const s = net.createConnection({ port: PORT, host: '127.0.0.1' }); s.once('connect', () => { s.destroy(); resolve(true); }); s.once('error', () => resolve(false)); });
  if (busy) { console.error(`port ${PORT} is already in use; stop that PID or set NOS_ARROW_PORT (the build bakes the same port)`); process.exit(1); }
  const server = startServer();
  server.proc.on('exit', (code, signal) => { if (!c.done) { console.error(`next start exited early (code ${code}, signal ${signal}); see ${LOG_DIR}/next-start-${PORT}.log`); process.exit(1); } });
  try { await waitReady(server); await body(server, c); fixtureProof(c); } catch (e) { c.fail(e); console.error(e); }
  c.finish(server);
}
