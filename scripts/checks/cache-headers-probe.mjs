// m3-f3-sanity-volume F3a: read-only Cache-Control probe for both hosts.
//   --selftest              offline: classifier against the golden's selftest vectors
//   --spawn                 local `next start` (launched, Sanity stubbed), both hosts via Host header
//   --live --mode walled|launched   GET beta.saoc.co.za and nos.saoc.co.za (Basic Auth from env)
// GET only. Exit 0 pass, 1 mismatch, 2 setup error, 77 skip (live credentials absent).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  REPO_ROOT,
  SANDBOX_DIR,
  get,
  startServer,
} from './lib/local-next-server.mjs';

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

const expectations = JSON.parse(readFileSync(EXPECTATIONS_PATH, 'utf8'));

// A header value passes a class when it matches `must_match` and does not match `must_not_match`.
// A missing header never passes.
export function classify(rule, cacheControl) {
  if (cacheControl === null || cacheControl === undefined) return false;
  return new RegExp(rule.must_match).test(cacheControl) && !new RegExp(rule.must_not_match).test(cacheControl);
}

function ruleFor(mode, routeClass) {
  const rules = expectations.modes[mode];
  return rules.all ?? rules[routeClass];
}

function plannedRoutes(mode) {
  if (mode === 'walled') {
    return [...expectations.routes.isr, ...expectations.routes.dynamic].map((route) => ({ ...route, routeClass: 'isr' }));
  }
  return [
    ...expectations.routes.isr.map((route) => ({ ...route, routeClass: 'isr' })),
    ...expectations.routes.dynamic.map((route) => ({ ...route, routeClass: 'dynamic' })),
  ];
}

function report(route, mode, observed) {
  const pass = classify(ruleFor(mode, route.routeClass), observed);
  console.log(`${pass ? 'PASS' : 'FAIL'} ${route.host} ${route.path} class=${route.routeClass} cache-control=${observed ?? '(none)'}`);
  return pass;
}

function selftest() {
  let failed = 0;
  for (const vector of expectations.selftest_vectors) {
    const verdict = classify(ruleFor(vector.mode, vector.class), vector.cache_control) ? 'pass' : 'fail';
    const ok = verdict === vector.expect;
    if (!ok) failed += 1;
    console.log(`${ok ? 'ok' : 'WRONG'} ${vector.mode}/${vector.class} ${vector.cache_control ?? '(none)'} -> ${verdict} (expected ${vector.expect})`);
  }
  return failed === 0 ? 0 : EXIT_MISMATCH;
}

async function spawnMode() {
  const server = await startServer({ port: SPAWN_PORT, countLog: COUNT_LOG, launched: true });
  let failed = 0;
  try {
    for (const route of plannedRoutes('launched')) {
      const host = expectations.hosts[route.host].local_host_header.replace('.localhost', '');
      const response = await get(SPAWN_PORT, server.hostFor(host), route.path);
      if (response.status !== 200 || !report(route, 'launched', response.cacheControl)) failed += 1;
    }
  } finally {
    server.stop();
  }
  return failed === 0 ? 0 : EXIT_MISMATCH;
}

async function liveMode(mode) {
  const user = process.env.BETA_BASIC_AUTH_USER;
  const password = process.env.BETA_BASIC_AUTH_PASSWORD;
  if (!user || !password) {
    console.log('SKIP BETA_BASIC_AUTH_USER/PASSWORD not set');
    return EXIT_SKIP;
  }
  const authorization = `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
  let failed = 0;
  for (const route of plannedRoutes(mode)) {
    const url = `${expectations.hosts[route.host].live_base}${route.path}`;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { authorization },
        redirect: 'manual',
        signal: AbortSignal.timeout(LIVE_TIMEOUT_MS),
      });
      await response.arrayBuffer();
      if (response.status !== 200 || !report(route, mode, response.headers.get('cache-control'))) failed += 1;
    } catch (error) {
      console.log(`FAIL ${route.host} ${route.path} request error: ${error instanceof Error ? error.name : 'unknown'}`);
      failed += 1;
    }
  }
  return failed === 0 ? 0 : EXIT_MISMATCH;
}

const args = process.argv.slice(2);
try {
  if (args.includes('--selftest')) process.exit(selftest());
  if (args.includes('--spawn')) process.exit(await spawnMode());
  if (args.includes('--live')) {
    const mode = args[args.indexOf('--mode') + 1];
    if (mode !== 'walled' && mode !== 'launched') {
      console.error('--live needs --mode walled|launched');
      process.exit(EXIT_SETUP);
    }
    process.exit(await liveMode(mode));
  }
  console.error('usage: cache-headers-probe.mjs --selftest | --spawn | --live --mode walled|launched');
  process.exit(EXIT_SETUP);
} catch (error) {
  console.error('cache-headers-probe failed:', error instanceof Error ? error.message : error);
  process.exit(EXIT_SETUP);
}
