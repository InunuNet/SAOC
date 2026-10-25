// Shared helpers for the nos-content-standard gates: goldens, a `next start` on a port this gate owns (killed by exact child PID),
// a Playwright launcher and a failure collector. Run from the repo root after build.sh.
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import net from 'node:net';
import { createRequire } from 'node:module';
import { appendFileSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const SPEC = '.agent/memory/project/specs/nos-content-standard';
export const STD = JSON.parse(readFileSync(`${SPEC}/goldens/standard.json`, 'utf8'));
const TABLE = JSON.parse(readFileSync(`${SPEC}/goldens/route-table.json`, 'utf8'));
const ALL_ROUTES = TABLE.routes;
export const RETIRED = TABLE.retired ?? [];
export const BANNED = TABLE.bannedStrings ?? [];
export const EXCLUDED = ALL_ROUTES.filter((r) => r.excluded);
export const ROUTES = ALL_ROUTES.filter((r) => !r.excluded);
export const CROPS = JSON.parse(readFileSync(`${SPEC}/goldens/crops/crop-proposals.json`, 'utf8')).crops;
export const BASE_PORT = Number(process.env.NOS_STD_PORT ?? 3091);
export const AUTH_USER = 'sandbox';
export const AUTH_PASS = 'sandbox-pass';
export const AUTH = `Basic ${Buffer.from(`${AUTH_USER}:${AUTH_PASS}`).toString('base64')}`;
const LOG_DIR = '.tmp/sandbox/nos-content-standard-gate';
mkdirSync(LOG_DIR, { recursive: true });

// Sanity fixture (mission rev 43B): the Sanity API CDN quota is shared and was exhausted by gate runs, so gates read GROQ responses from a captured
// fixture (fixtures/sanity/<hash>.json) through lib/sanity-fixture.ts and make zero Sanity API requests. NOS_STD_FIXTURE: unset or "replay" = replay
// (default), "record" = capture through the API host (never the CDN), "live" = no fixture (only for a deliberate live comparison; A15 then fails).
export const FIXTURE_MODE = process.env.NOS_STD_FIXTURE ?? 'replay';
export const FIXTURE_DIR = path.resolve(`${SPEC}/fixtures/sanity`);
const BLOCK_NET = path.resolve(`${SPEC}/checks/block-sanity-net.cjs`);
export const fixtureLogDir = (port) => path.resolve(`${LOG_DIR}/fixture-logs-${port}`);
/** The environment that turns the fixture on for a child process (next start, next build). */
export function fixtureEnv(port) {
  if (FIXTURE_MODE === 'live') return {};
  const logdir = fixtureLogDir(port);
  mkdirSync(logdir, { recursive: true });
  for (const f of ['_started.log', '_hits.log', '_misses.log', '_requests.log', '_net.log', '_assets.log', '_browser-net.log', '_proof.json']) writeFileSync(`${logdir}/${f}`, '');
  const nodeOptions = `${process.env.NODE_OPTIONS ?? ''} --require "${BLOCK_NET}"`.trim(); // double-quoted: the repo path has spaces and Node splits an unquoted NODE_OPTIONS value on them
  return { SANITY_FIXTURE_DIR: FIXTURE_DIR, SANITY_FIXTURE_MODE: FIXTURE_MODE === 'record' ? 'record' : 'replay', SANITY_FIXTURE_LOGDIR: logdir, NODE_OPTIONS: nodeOptions, ...(FIXTURE_MODE === 'record' ? { SANITY_NET_ALLOW: 'api', SANITY_FIXTURE_RECORD_CONFIRM: '1' } : {}) };
}
let activeFixtureLog = null;

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
  delete env.K_SERVICE; // the fixture is inert on the hosted runtime (K_SERVICE); the gate is never hosted
  Object.assign(env, fixtureEnv(port));
  if (FIXTURE_MODE !== 'live') activeFixtureLog = fixtureLogDir(port);
  // A retired or redirected route builds its target from a site-URL variable; every NEXT_PUBLIC_*URL the process or the dotenv files define must
  // name the gate's own origin, or the redirect leaves the gate server (ERR_CONNECTION_REFUSED). SAOC-named variables get the saoc origin.
  const urlKeys = new Set(Object.keys(process.env).filter((k) => /^NEXT_PUBLIC_.*URL$/.test(k)));
  for (const f of ['.env', '.env.local', '.env.production', '.env.production.local']) { if (existsSync(f)) for (const m of readFileSync(f, 'utf8').matchAll(/^\s*(NEXT_PUBLIC_[A-Z0-9_]*URL)\s*=/gm)) urlKeys.add(m[1]); }
  for (const k of urlKeys) { if (/^NEXT_PUBLIC_(FIREBASE|SANITY)/.test(k)) continue; env[k] = /SAOC/.test(k) ? `http://saoc.localhost:${port}` : `http://nos.localhost:${port}`; }
  env.SITE_URL = `http://nos.localhost:${port}`;

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

export async function newContext(browser, vp, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dsf, httpCredentials: { username: AUTH_USER, password: AUTH_PASS }, ...extra });
  // Browser-side guard: the page must never call the Sanity GROQ API (apicdn / api hosts) while the fixture is in use; cdn.sanity.io images are a separate quota and pass.
  if (activeFixtureLog) await ctx.route(/^https?:\/\/([^/]+\.)?(apicdn|api)\.sanity\.io\//, (route) => { appendFileSync(`${activeFixtureLog}/_browser-net.log`, `${new Date().toISOString()} ${route.request().url().slice(0, 160)}\n`); return route.abort(); });
  return ctx;
}

/** Written just before a gate kills its server: the proof that this gate ran with the switch and saw zero Sanity API traffic (A15 reads it). */
export function fixtureProof(server, c) {
  if (FIXTURE_MODE === 'live') { c.check('the gate server ran with the Sanity fixture (NOS_STD_FIXTURE=live was set)', false); return; }
  const dir = fixtureLogDir(server.port);
  const lines = (f) => (existsSync(`${dir}/${f}`) ? readFileSync(`${dir}/${f}`, 'utf8').split('\n').filter(Boolean) : []);
  const started = lines('_started.log'); const hits = lines('_hits.log'); const misses = lines('_misses.log'); const net = lines('_net.log'); const bnet = lines('_browser-net.log');
  const mode = FIXTURE_MODE === 'record' ? 'record' : 'replay';
  c.check(`the gate server saw SANITY_FIXTURE_DIR (_started.log has mode=${mode}; ${started.length} line(s))`, started.some((l) => l.includes(`mode=${mode}`) && l.includes(FIXTURE_DIR)));
  if (mode === 'replay') {
    c.check(`the server served reads from the fixture (${hits.length} hits)`, hits.length > 0);
    c.check(`no fixture miss (${misses.length}): ${misses.slice(0, 3).join(' | ')}`, misses.length === 0);
  }
  c.check(`zero Sanity API requests from the server process (${net.length} blocked)`, net.length === 0);
  c.check(`zero Sanity API requests from the browser (${bnet.length})`, bnet.length === 0);
  writeFileSync(`${dir}/_proof.json`, `${JSON.stringify({ ok: started.length > 0 && net.length === 0 && bnet.length === 0 && (mode === 'record' || (hits.length > 0 && misses.length === 0)), mode, started: started.length > 0, hits: hits.length, misses: misses.length, missSample: misses.slice(0, 3), net: net.length, browserNet: bnet.length, port: server.port, at: new Date().toISOString() })}\n`);
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
  try { await waitReady(server); await body(server, c); fixtureProof(server, c); } catch (e) { c.fail(e); console.error(e); }
  c.finish(server);
}

/** page.goto that never aborts the gate: a cross-origin redirect (or a refused connection after one) is a clear route FAIL. Returns the response, or null
 after recording the failure on the collector. */
export async function gotoRoute(page, server, path, c, tag, opts = { waitUntil: 'load' }) {
  let res = null;
  try { res = await page.goto(`${server.nos}${path}`, opts); } catch (e) {
    c.check(`${tag} navigation stays on the gate origin ${server.nos}`, false, `${String(e.message).split('\n')[0]} (a cross-origin redirect or a retired route; check the route is live and its redirect target uses the gate origin)`);
    return null;
  }
  const landed = new URL(page.url()).origin;
  if (landed !== new URL(server.nos).origin) { c.check(`${tag} navigation stays on the gate origin ${server.nos}`, false, `redirected to ${page.url()}`); return null; }
  // Wait for React streaming to finish: no suspended-boundary placeholders left, so a loading.tsx fallback is never what the gate measures.
  const settled = await page.waitForFunction(() => !document.querySelector('[hidden][id^="S:"]') && !document.querySelector('template[id^="B:"]') && document.readyState === 'complete', null, { timeout: 25000 }).then(() => true, () => false);
  if (!settled) c.check(`${tag} streaming finished (no [hidden][id^="S:"] or template[id^="B:"] left within 25s)`, false);
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  // NosShowIndex (nav.nos-index) is site chrome that sits inside <main>: it is not content, so the content gates (uppercase labels, h2/h3 counts and styles) never see it.
  // Its own overflow is still measured here, before it is set aside.
  const overflow = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
  if (overflow.sw > overflow.iw) c.check(`${tag} no horizontal overflow before the show index is set aside (${overflow.sw} <= ${overflow.iw})`, false);
  await page.evaluate(() => document.querySelectorAll('nav.nos-index').forEach((e) => e.remove()));
  return res;
}

/** SAOC's html scroll-padding-top stacks on the h2 scroll-margin, so a clicked heading lands near 216px (a known SAOC defect, not a NOS workaround case). The
 * landing upper bound is required only once SAOC's fix commit (NOS_STD_SAOC_SCROLLFIX) is an ancestor of HEAD; until then an overshoot is a loud note. */
export function saocScrollFixLanded() {
  const ref = process.env.NOS_STD_SAOC_SCROLLFIX; if (!ref) return false;
  try { execFileSync('git', ['merge-base', '--is-ancestor', ref, 'HEAD']); return true; } catch { return false; }
}
