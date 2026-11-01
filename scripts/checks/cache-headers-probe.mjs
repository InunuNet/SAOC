// m3-f3-sanity-volume F3a: read-only Cache-Control probe for both hosts.
//   --selftest              offline: classifier against the golden's selftest vectors
//   --spawn                 local `next start` (launched, Sanity stubbed), both hosts via Host header
//   --live --mode walled|launched [--payments testing|live]
//                           GET beta.saoc.co.za and nos.saoc.co.za (Basic Auth from env)
// GET only. Exit 0 pass, 1 mismatch, 2 setup error, 77 skip (live credentials absent).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  REPO_ROOT,
  SANDBOX_DIR,
  get,
  startServer,
} from './lib/local-next-server.mjs';
import { classify } from './lib/cache-classify.mjs';

const EXPECTATIONS_PATH = resolve(
  REPO_ROOT,
  '.agent/memory/project/specs/backlog-wave-1028/m3-f3-sanity-volume/goldens/cache-header-expectations.json',
);
const SPAWN_PORT = 3219;
const COUNT_LOG = resolve(SANDBOX_DIR, 'probe.log');
const LIVE_TIMEOUT_MS = 30000;
const EXIT_MISMATCH = 1;
const EXIT_SETUP = 2;
const EXIT_SKIP = 77;
const TEST_MODE_PATH = resolve(REPO_ROOT, 'lib/ticketing-test-mode.ts');
const TEST_TITLE_PREFIX = '[Testing only, not live]';
const PAYMENTS_MODES = ['testing', 'live'];
const PAYMENTS_CONSTANT = /TICKETING_PAYMENTS_LIVE\s*=\s*(true|false)/g;

const expectations = JSON.parse(readFileSync(EXPECTATIONS_PATH, 'utf8'));

function ruleFor(mode, routeClass) {
  const rules = expectations.modes[mode];
  return rules.all ?? rules[routeClass];
}

function plannedRoutes(mode) {
  const statics = expectations.routes.static.map((route) => ({ ...route, routeClass: 'static' }));
  const perRequest = [...expectations.routes.dynamic, ...expectations.routes.admin];
  if (mode === 'walled') {
    return [...expectations.routes.isr, ...perRequest]
      .map((route) => ({ ...route, routeClass: 'isr' }))
      .concat(statics);
  }
  return [
    ...expectations.routes.isr.map((route) => ({ ...route, routeClass: 'isr' })),
    ...perRequest.map((route) => ({ ...route, routeClass: 'dynamic' })),
    ...statics,
  ];
}

// The payments mode is read from the same constant that renders the "[Testing only]" title prefix,
// so the title check can never disagree with the build. Zero or several matches is a setup error.
function readPaymentsMode(source = readFileSync(TEST_MODE_PATH, 'utf8')) {
  const matches = [...source.matchAll(PAYMENTS_CONSTANT)];
  if (matches.length !== 1) {
    throw new Error(`expected exactly one TICKETING_PAYMENTS_LIVE constant, found ${matches.length}`);
  }
  return matches[0][1] === 'true' ? 'live' : 'testing';
}

// 'skip' while payments are in testing mode (the prefix is deliberately on); in live mode the
// title must exist and must not carry the prefix. A missing title never passes.
function titleVerdict(payments, html) {
  if (payments === 'testing') return 'skip';
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  if (title === undefined) return 'fail';
  return title.includes(TEST_TITLE_PREFIX) ? 'fail' : 'pass';
}

// The anchor must be an element id, not merely a link to it.
function anchorVerdict(anchor, html) {
  return new RegExp(`\\sid=["']${anchor}["']`).test(html) ? 'pass' : 'fail';
}

const expectedStatus = (route) => route.status ?? 200;

// The first /_next/static asset of the wanted extension that the page's HTML links to.
function discoverAsset(html, ext) {
  const pattern = new RegExp(`/_next/static/[^"' <>\\\\]+\\.${ext}`);
  return pattern.exec(html)?.[0] ?? null;
}

// A static route has no fixed path: fetch `discover_from`, find an asset, probe that. No asset is a
// failure, never a skip. `fetchPage(route, path)` returns { status, cacheControl, body }.
async function probeRoute(route, mode, fetchPage, { payments, emit = console.log, live = false } = {}) {
  let target = route;
  if (route.routeClass === 'static') {
    const page = await fetchPage(route, route.discover_from, true);
    const asset = discoverAsset(page.body, route.ext);
    if (!asset) {
      emit(`FAIL ${route.host} no /_next/static ${route.ext} asset found in ${route.discover_from}`);
      return false;
    }
    target = { ...route, path: asset };
  }
  const response = await fetchPage(target, target.path, target.routeClass !== 'static');
  const verdict = verdictLine(target, mode, response);
  emit(verdict.line);
  let pass = verdict.pass;
  if (verdict.pass && target.routeClass !== 'static' && response.status === 200) {
    pass = checkPage(target, response.body, { payments, emit, live });
  }
  return pass;
}

// Pure: the one line and boolean for a route's observed status and Cache-Control.
function verdictLine(route, mode, response) {
  const expected = expectedStatus(route);
  const observed = response.cacheControl ?? null;
  const pass = response.status === expected && classify(ruleFor(mode, route.routeClass), observed);
  const prefix = `${route.host} ${route.path} class=${route.routeClass}`;
  if (pass) return { pass, line: `PASS ${prefix} cache-control=${observed ?? '(none)'}` };
  return {
    pass,
    line: `FAIL ${prefix} status=${response.status} expected=${expected} cache-control=${observed ?? '(none)'}`,
  };
}

// Title check on every HTML 200 route; the #ticket-wosa anchor on the NOS /tickets hub, live only.
function checkPage(route, html, { payments, emit, live }) {
  let pass = true;
  const title = titleVerdict(payments, html);
  if (title === 'skip') emit(`SKIP title ${route.host} ${route.path} payments=${payments}`);
  else {
    emit(`${title === 'pass' ? 'PASS' : 'FAIL'} title ${route.host} ${route.path} payments=${payments}`);
    pass = title === 'pass';
  }
  for (const check of expectations.page_checks) {
    if (!live || check.host !== route.host || check.path !== route.path) continue;
    const anchor = anchorVerdict(check.anchor, html);
    emit(`${anchor === 'pass' ? 'PASS' : 'FAIL'} anchor ${route.host} ${route.path} #${check.anchor}`);
    pass = pass && anchor === 'pass';
  }
  return pass;
}

async function selftest() {
  let failed = 0;
  for (const vector of expectations.selftest_vectors) {
    const verdict = classify(ruleFor(vector.mode, vector.class), vector.cache_control) ? 'pass' : 'fail';
    const ok = verdict === vector.expect;
    if (!ok) failed += 1;
    console.log(`${ok ? 'ok' : 'WRONG'} ${vector.mode}/${vector.class} ${vector.cache_control ?? '(none)'} -> ${verdict} (expected ${vector.expect})`);
  }
  return failed + (await selftestPackVectors()) === 0 ? 0 : EXIT_MISMATCH;
}

function logVector(ok, label) {
  console.log(`${ok ? 'ok' : 'WRONG'} ${label}`);
  return ok ? 0 : 1;
}

// Status/FAIL-line vectors run through probeRoute itself so a silent mismatch cannot hide.
async function selftestStatusVectors() {
  let failed = 0;
  for (const vector of expectations.status_vectors) {
    const route = {
      host: 'nos',
      path: '/selftest',
      routeClass: vector.class,
      status: vector.expected_status,
    };
    const lines = [];
    const fetchPage = async () => ({
      status: vector.observed_status,
      cacheControl: vector.cache_control,
      body: '<title>x</title>',
    });
    const pass = await probeRoute(route, 'launched', fetchPage, {
      payments: 'testing',
      emit: (line) => lines.push(line),
    });
    const wantPass = vector.expect_line.startsWith('^PASS');
    const ok = pass === wantPass && lines.some((line) => new RegExp(vector.expect_line).test(line));
    failed += logVector(ok, `status ${vector.observed_status}/${vector.expected_status} -> ${lines[0]}`);
  }
  return failed;
}

async function selftestPackVectors() {
  let failed = await selftestStatusVectors();
  for (const vector of expectations.title_vectors) {
    const verdict = titleVerdict(vector.payments, vector.html);
    failed += logVector(verdict === vector.expect, `title ${vector.payments} -> ${verdict} (expected ${vector.expect})`);
  }
  for (const vector of expectations.anchor_vectors) {
    const verdict = anchorVerdict(vector.anchor, vector.html);
    failed += logVector(verdict === vector.expect, `anchor #${vector.anchor} -> ${verdict} (expected ${vector.expect})`);
  }
  const constant = (value) => `const TICKETING_PAYMENTS_LIVE = ${value};`;
  const modeVectors = [
    [constant('false'), 'testing'],
    [constant('true'), 'live'],
    ['export const OTHER = 1;', 'throws'],
    [`${constant('true')}\n${constant('false')}`, 'throws'],
  ];
  for (const [source, expect] of modeVectors) {
    let got;
    try {
      got = readPaymentsMode(source);
    } catch {
      got = 'throws';
    }
    failed += logVector(got === expect, `payments-mode ${expect}`);
  }
  return failed;
}

async function spawnMode() {
  const payments = readPaymentsMode();
  const server = await startServer({ port: SPAWN_PORT, countLog: COUNT_LOG, launched: true });
  let failed = 0;
  try {
    const fetchPage = (route, path, wantBody) => {
      const host = expectations.hosts[route.host].local_host_header.replace('.localhost', '');
      return get(SPAWN_PORT, server.hostFor(host), path, { wantBody });
    };
    for (const route of plannedRoutes('launched')) {
      if (!(await probeRoute(route, 'launched', fetchPage, { payments }))) failed += 1;
    }
  } finally {
    server.stop();
  }
  return failed === 0 ? 0 : EXIT_MISMATCH;
}

async function liveMode(mode, payments) {
  const user = process.env.BETA_BASIC_AUTH_USER;
  const password = process.env.BETA_BASIC_AUTH_PASSWORD;
  if (!user || !password) {
    console.log('SKIP BETA_BASIC_AUTH_USER/PASSWORD not set');
    return EXIT_SKIP;
  }
  const authorization = `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
  const fetchPage = async (route, path) => {
    const response = await fetch(`${expectations.hosts[route.host].live_base}${path}`, {
      method: 'GET',
      headers: { authorization },
      redirect: 'manual',
      signal: AbortSignal.timeout(LIVE_TIMEOUT_MS),
    });
    const body = await response.text();
    return { status: response.status, cacheControl: response.headers.get('cache-control'), body };
  };
  let failed = 0;
  for (const route of plannedRoutes(mode)) {
    try {
      if (!(await probeRoute(route, mode, fetchPage, { payments, live: true }))) failed += 1;
    } catch (error) {
      console.log(`FAIL ${route.host} ${route.path ?? route.discover_from} request error: ${error instanceof Error ? error.name : 'unknown'}`);
      failed += 1;
    }
  }
  return failed === 0 ? 0 : EXIT_MISMATCH;
}

const args = process.argv.slice(2);
try {
  if (args.includes('--selftest')) process.exit(await selftest());
  if (args.includes('--spawn')) process.exit(await spawnMode());
  if (args.includes('--live')) {
    const mode = args[args.indexOf('--mode') + 1];
    if (mode !== 'walled' && mode !== 'launched') {
      console.error('--live needs --mode walled|launched');
      process.exit(EXIT_SETUP);
    }
    const override = args.includes('--payments') ? args[args.indexOf('--payments') + 1] : null;
    if (override !== null && !PAYMENTS_MODES.includes(override)) {
      console.error('--payments needs testing|live');
      process.exit(EXIT_SETUP);
    }
    process.exit(await liveMode(mode, override ?? readPaymentsMode()));
  }
  console.error('usage: cache-headers-probe.mjs --selftest | --spawn | --live --mode walled|launched [--payments testing|live]');
  process.exit(EXIT_SETUP);
} catch (error) {
  console.error('cache-headers-probe failed:', error instanceof Error ? error.message : error);
  process.exit(EXIT_SETUP);
}
