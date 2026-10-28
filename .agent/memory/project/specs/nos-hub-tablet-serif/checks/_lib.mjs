// Shared helpers for the nos-hub-tablet-serif gates: golden loading, a `next start` server on the A6 build, a Playwright launcher
// and a failure collector. Every gate runs from the repo root against the production build (build.sh first).
// SITE_PUBLIC_LAUNCH and BETA_PASSWORD_WALL_OFF are deleted from the child env, never set.
import { execFileSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { appendFileSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { probeSlugsFrom, writeTodayStubs, writeUnknownSlugStubs } from './gen-today-stub.mjs';

// Resolved from this file, so the gates read the goldens and write evidence into the spec dir whatever the build root is.
export const SPEC_DIR = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
// The tree under test (default: the cwd, which the contract runs from the repo root). HUB_SERIF_ROOT lets a sandbox worktree be gated.
export const ROOT = process.env.HUB_SERIF_ROOT ?? process.cwd();
export const VALUES = JSON.parse(readFileSync(`${SPEC_DIR}/goldens/values.json`, 'utf8'));
export const ROUTES = JSON.parse(readFileSync(`${SPEC_DIR}/goldens/sweep-routes.json`, 'utf8'));
export const EVIDENCE_DIR = `${SPEC_DIR}/evidence`;
export const BASE_PORT = Number(process.env.NOS_HUB_SERIF_PORT ?? 3081);
export const AUTH_USER = 'sandbox';
export const AUTH_PASS = 'sandbox-pass';
export const AUTH = `Basic ${Buffer.from(`${AUTH_USER}:${AUTH_PASS}`).toString('base64')}`;
const LOG_DIR = `${ROOT}/.tmp/sandbox/nos-hub-tablet-serif-gate`;
// Fixture replay only (SANITY_FIXTURE_MODE=replay): no gate, no build and no baseline reads live Sanity. The fixture dir is a sandbox COPY of the tracked
// nos-content-standard capture, so a gate can never write into the tracked set; K_SERVICE is unset (the fixture is inert on the hosted runtime).
export const FIXTURE_SRC = `${ROOT}/.agent/memory/project/specs/nos-content-standard/fixtures/sanity`;
export const FIXTURE_DIR = `${ROOT}/.tmp/sandbox/nos-hub-tablet-serif-fixtures/sanity`;
export const BLOCK_NET = `${SPEC_DIR}/checks/block-sanity-net.cjs`;
export const PID_DIR = `${LOG_DIR}/pids`;
const BROWSER_NET_LOG = `${LOG_DIR}/_browser-net.log`;
mkdirSync(LOG_DIR, { recursive: true });
writeFileSync(BROWSER_NET_LOG, '');
export const fixtureLogDir = (port) => `${LOG_DIR}/fixture-logs-${port}`;
if (!existsSync(FIXTURE_SRC)) throw new Error(`the tracked Sanity fixture is missing: ${FIXTURE_SRC}`);
mkdirSync(FIXTURE_DIR, { recursive: true });
execFileSync('rsync', ['-a', '--delete', `${FIXTURE_SRC}/`, `${FIXTURE_DIR}/`]);
if (process.env.HUB_SERIF_FIXTURE_STRICT !== '1') writeUnknownSlugStubs(FIXTURE_SRC, FIXTURE_DIR, probeSlugsFrom(`${SPEC_DIR}/goldens/sweep-routes.json`)); // test-only unknown-slug stub, permanent, skipped under strict
if (process.env.HUB_SERIF_FIXTURE_STRICT !== '1') writeTodayStubs(FIXTURE_SRC, FIXTURE_DIR); // date-keyed entries re-keyed for today, sandbox copy only (closed by fix/fixture-stable-clock)
if (process.env.HUB_SERIF_FIXTURE_STRICT !== '1') execFileSync('rsync', ['-a', '--ignore-existing', `${SPEC_DIR}/${VALUES.fixture.stubs.dir}/`, `${FIXTURE_DIR}/`]); // empty build-time stubs, sandbox copy only; a real capture of the same key wins; strict mode skips them

// The environment that puts a child (next build, next start) on fixture replay with the Sanity API blocked. The double quotes keep the repo path (it has spaces) in one NODE_OPTIONS token.
export function fixtureEnv(port) {
  const dir = fixtureLogDir(port);
  mkdirSync(dir, { recursive: true });
  for (const f of ['_started.log', '_hits.log', '_misses.log', '_requests.log', '_net.log', '_assets.log', '_browser-net.log']) writeFileSync(`${dir}/${f}`, '');
  return { SANITY_FIXTURE_MODE: 'replay', SANITY_FIXTURE_DIR: FIXTURE_DIR, SANITY_FIXTURE_LOGDIR: dir, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --require "${BLOCK_NET}"`.trim() };
}

// Misses that are known-pending a named PR (values.json fixture.knownMisses); anything else is a real fixture gap.
const STRICT_FIXTURE = process.env.HUB_SERIF_FIXTURE_STRICT === '1';
const knownFor = (line) => (STRICT_FIXTURE ? undefined : VALUES.fixture.knownMisses.find((k) => line.includes(k.contains)));
export const unknownMisses = (lines) => lines.filter((l) => !knownFor(l));
export const knownMissSummary = (lines) => [...new Set(lines.map(knownFor).filter(Boolean).map((k) => k.closedBy))];

// Written before a gate kills its server: zero fixture misses and zero Sanity API traffic from the server, or the gate fails.
export function fixtureProof(server, c) {
  const dir = fixtureLogDir(server.port);
  const lines = (f) => (existsSync(`${dir}/${f}`) ? readFileSync(`${dir}/${f}`, 'utf8').split('\n').filter(Boolean) : []);
  const started = lines('_started.log'); const hits = lines('_hits.log'); const misses = lines('_misses.log'); const net = lines('_net.log');
  c.check(`[fixture ${server.port}] the server ran on fixture replay (${started.length} _started line(s), ${hits.length} hits)`, started.some((l) => l.includes('mode=replay')) && hits.length > 0);
  const unknown = unknownMisses(misses);
  if (misses.length > unknown.length) console.log(`note: [fixture ${server.port}] ${misses.length - unknown.length} known-pending miss(es), each closed by: ${knownMissSummary(misses).join(' | ')}`);
  c.check(`[fixture ${server.port}] no unexpected fixture miss (${unknown.length} of ${misses.length}; the rest are known-pending, see the note below): ${unknown.slice(0, 3).join(' | ')}`, unknown.length === 0);
  c.check(`[fixture ${server.port}] zero Sanity API requests from the server (${net.length})`, net.length === 0);
  const bnet = readFileSync(BROWSER_NET_LOG, 'utf8').split('\n').filter(Boolean);
  c.check(`[fixture ${server.port}] zero Sanity API requests from the browser (${bnet.length})`, bnet.length === 0);
}
mkdirSync(LOG_DIR, { recursive: true });
mkdirSync(EVIDENCE_DIR, { recursive: true });

/** Start `next start` on BASE_PORT + offset with the beta wall up and placeholder preview on (the same environment the nos-pagehero gates used). `preview: false` is public mode: SHOW_PLACEHOLDER_PREVIEW unset, so the placeholder prose is withheld (the public-launch flag is still never set, see the top of this file). */
export function startServer(offset, { preview = true, root = ROOT } = {}) {
  const port = BASE_PORT + offset;
  const env = {
    ...process.env, NODE_ENV: 'production', BETA_BASIC_AUTH_USER: AUTH_USER, BETA_BASIC_AUTH_PASSWORD: AUTH_PASS, SHOW_PLACEHOLDER_PREVIEW: preview ? 'true' : 'false',
    NEXT_PUBLIC_NOS_SITE_URL: `http://nos.localhost:${port}`, NEXT_PUBLIC_SAOC_SITE_URL: `http://saoc.localhost:${port}`,
  };
  if (!preview) delete env.SHOW_PLACEHOLDER_PREVIEW;
  delete env.BETA_PASSWORD_WALL_OFF;
  delete env.SITE_PUBLIC_LAUNCH;
  delete env.K_SERVICE;
  Object.assign(env, fixtureEnv(port));
  const log = openSync(`${LOG_DIR}/next-start-${port}.log`, 'w');
  const proc = spawn(`${root}/node_modules/.bin/next`, ['start', '-p', String(port)], { cwd: root, stdio: ['ignore', log, log], env });
  // The exact child PID goes in a pidfile and is the only thing ever killed: never pkill, never by name.
  mkdirSync(PID_DIR, { recursive: true });
  writeFileSync(`${PID_DIR}/${port}.pid`, String(proc.pid));
  return { port, proc, nos: `http://nos.localhost:${port}`, saoc: `http://saoc.localhost:${port}` };
}

export async function waitReady(server) {
  for (let i = 0; i < 90; i += 1) {
    try {
      const r = await fetch(`${server.nos}/faq`, { headers: { authorization: AUTH } });
      if (r.status < 500) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('server never became ready');
}

export async function launchChromium() {
  const require = createRequire(`${ROOT}/package.json`);
  const { chromium } = require('@playwright/test');
  return chromium.launch();
}

export async function newContext(browser, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dsf ?? 1, httpCredentials: { username: AUTH_USER, password: AUTH_PASS } });
  // Browser-side guard: the page must never call the Sanity GROQ API while the fixture is in use (cdn.sanity.io images are a separate quota and pass).
  await ctx.route(/^https?:\/\/([^/]+\.)?(apicdn|api)\.sanity\.io\//, (route) => { appendFileSync(BROWSER_NET_LOG, `${route.request().url().slice(0, 160)}\n`); return route.abort(); });
  return ctx;
}

// P1 (NOS Design, 2026-10-27): a screenshot or a measurement of the hub hero is only taken once the page has hydrated and the countdown shows a value.
// Hydrated = React has attached its fiber to the countdown value element; shown = that element has text and a painted, visible, non-transparent box.
const COUNTDOWN_VALUE = '[data-nos-hero-text="countdown-days-value"], [data-nos-hero-text="countdown-tbc"]';
export async function settleCountdown(page, timeout = 20000) {
  try {
    await page.waitForFunction((sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      const hydrated = Object.keys(el).some((k) => k.startsWith('__reactFiber') || k.startsWith('__reactProps'));
      const cs = getComputedStyle(el);
      const b = el.getBoundingClientRect();
      return hydrated && (el.textContent ?? '').trim() !== '' && b.width > 0 && b.height > 0 && cs.visibility === 'visible' && cs.display !== 'none' && Number(cs.opacity) > 0;
    }, COUNTDOWN_VALUE, { timeout });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    return true;
  } catch { return false; }
}

export function collector(label) {
  const failures = [];
  return {
    check: (name, ok, detail = '') => { if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ''}`); },
    note: (line) => console.log(line),
    finish(server) {
      server?.proc.kill();
      if (failures.length) { console.error(`${label} FAILED:\n- ${failures.join('\n- ')}`); process.exit(1); }
      console.log(`${label} pass`);
      process.exit(0);
    },
    fail: (e) => failures.push(`exception ${e.message}`),
  };
}

/** Run `body` with a started server, always reporting through the collector. */
export async function withServer(offset, label, body) {
  const c = collector(label);
  const server = startServer(offset);
  try { await waitReady(server); await body(server, c); fixtureProof(server, c); } catch (e) { c.fail(e); console.error(e); }
  c.finish(server);
}
