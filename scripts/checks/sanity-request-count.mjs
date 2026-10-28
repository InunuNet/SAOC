// m3-f3-sanity-volume harness: counts Sanity HTTP requests per route against a local production
// build with Sanity stubbed. Never uses the real project id or a token; Firebase is blanked.
//   --build      next build with the counting preload
//   --assert     BEFORE/AFTER table, compare with goldens/request-count-targets.json
//   --ttl-check  cache expires after SANITY_REVALIDATE_SECONDS and then holds again
//   --notfound   unmatched URL returns 404 with host-correct chrome on both hosts
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  REPO_ROOT,
  SANDBOX_DIR,
  clearFetchCache,
  countLines,
  countedGet,
  resetCountLog,
  sleep,
  startServer,
  stubbedEnv,
} from './lib/local-next-server.mjs';

const TARGETS_PATH = resolve(
  REPO_ROOT,
  '.agent/memory/project/specs/backlog-wave-1028/m3-f3-sanity-volume/goldens/request-count-targets.json',
);
const PORT = 3218;
const COUNT_LOG = resolve(SANDBOX_DIR, 'run.log');
const BUILD_LOG = resolve(SANDBOX_DIR, 'build.log');
const BUILD_STAMP = resolve(SANDBOX_DIR, 'build.stamp');
const REVALIDATE_SECONDS = 60;
const TTL_MARGIN_SECONDS = 5;
const ISR_CACHE_CONTROL = 's-maxage=60';
const UNMATCHED_PATHS = {
  saoc: ['/no-such-page-m3f3', '/societies/no-such-society-m3f3/deeper', '/newsletter/zz'],
  nos: ['/no-such-page-m3f3', '/vsp/zz', '/tickets/a/b', '/newsletter/zz'],
};
const SAOC_TITLE_SUFFIX = 'South African Orchid Council';
const NOS_TITLE_PART = 'The National Orchid Show';
// Routes that must read Sanity on their first request (per-request pages): proves the stub is
// reached, so zero warm counts mean the data cache held, not that no read ever happened.
const POSITIVE_CONTROL_ROUTES = ['nos /workshops', 'nos /symposium', 'nos /wosa-conference'];
// SAOC-host paths under the show trees are handed to the NOS origin by proxy.ts (308).
const SAOC_REDIRECT_PATHS = ['/vsp/zz', '/tickets/a/b'];
const PERMANENT_REDIRECT = 308;
const EXIT_FAIL = 1;
const EXIT_SETUP = 2;

const targets = JSON.parse(readFileSync(TARGETS_PATH, 'utf8'));
const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${message}`);
};

const splitRoute = (label) => {
  const [site, path] = label.split(' ');
  return { site, path };
};

// Identifies the source revision a build was made from: HEAD plus a digest of any uncommitted
// change, so --assert can refuse to measure a stale `.next`.
function sourceRevision() {
  const git = (...args) => execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' });
  const dirty = createHash('sha256').update(git('status', '--porcelain')).update(git('diff', 'HEAD')).digest('hex');
  return `${git('rev-parse', 'HEAD').trim()} ${dirty}`;
}

function measuredRoutes() {
  const labels = Object.keys(targets.baseline_origin_main_d52d3eb6.routes);
  return labels.map((label) => ({ label, ...splitRoute(label) }));
}

async function runBuild() {
  resetCountLog(BUILD_LOG);
  const env = { ...stubbedEnv(PORT, BUILD_LOG), NODE_ENV: 'production' };
  const build = spawn(resolve(REPO_ROOT, 'node_modules/.bin/next'), ['build'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env,
  });
  const code = await new Promise((done) => build.on('exit', done));
  console.log(`build-time sanity requests: ${countLines(BUILD_LOG)} (baseline ${targets.baseline_origin_main_d52d3eb6.build_time_sanity_requests})`);
  if (code !== 0) return EXIT_FAIL;
  writeFileSync(BUILD_STAMP, sourceRevision());
  return 0;
}

async function runAssert() {
  const baseline = targets.baseline_origin_main_d52d3eb6;
  const builtFrom = existsSync(BUILD_STAMP) ? readFileSync(BUILD_STAMP, 'utf8') : null;
  check(builtFrom === sourceRevision(), 'the .next build was made from this exact source revision (run --build first)');
  const server = await startServer({ port: PORT, countLog: COUNT_LOG, launched: true });
  const rows = [];
  try {
    for (const route of measuredRoutes()) {
      const host = server.hostFor(route.site);
      const first = await countedGet(PORT, COUNT_LOG, host, route.path);
      const second = await countedGet(PORT, COUNT_LOG, host, route.path);
      rows.push({ ...route, status: first.status, cold: first.requests, warm: second.requests, cacheControl: first.cacheControl });
    }
  } finally {
    server.stop();
  }
  console.log('route | status | cold | warm | baseline warm | cache-control');
  for (const row of rows) {
    console.log(`${row.label} | ${row.status} | ${row.cold} | ${row.warm} | ${baseline.routes[row.label].warm} | ${row.cacheControl}`);
  }
  const warmTotal = rows.reduce((sum, row) => sum + row.warm, 0);
  const reduction = (1 - warmTotal / baseline.warm_total_per_pass) * 100;
  console.log(`BEFORE warm total ${baseline.warm_total_per_pass}, AFTER warm total ${warmTotal}, reduction ${reduction.toFixed(1)}%`);
  for (const label of POSITIVE_CONTROL_ROUTES) {
    const row = rows.find((candidate) => candidate.label === label);
    check(Boolean(row) && row.cold > 0, `positive control ${label} cold ${row ? row.cold : 'missing'} > 0 (reads reach the stub)`);
  }
  check(existsSync(BUILD_LOG) && countLines(BUILD_LOG) > 0, `build-time Sanity requests recorded (${countLines(BUILD_LOG)}); run --build first`);
  check(rows.every((row) => row.status === 200), 'every measured route answers 200');
  check(warmTotal <= targets.targets.warm_total_per_pass_max, `warm total ${warmTotal} <= ${targets.targets.warm_total_per_pass_max}`);
  check(rows.every((row) => row.warm <= targets.targets.warm_per_route_max), `no route above ${targets.targets.warm_per_route_max} warm`);
  check(reduction >= targets.targets.min_reduction_percent_vs_baseline_warm_total, `reduction ${reduction.toFixed(1)}% >= ${targets.targets.min_reduction_percent_vs_baseline_warm_total}%`);
  for (const label of targets.isr_routes_expected) {
    const row = rows.find((candidate) => candidate.label === label);
    check(Boolean(row) && row.warm === 0, `ISR ${label} warm 0`);
    check(Boolean(row) && (row.cacheControl ?? '').includes(ISR_CACHE_CONTROL), `ISR ${label} answers ${ISR_CACHE_CONTROL}`);
  }
}

async function runTtlCheck() {
  const server = await startServer({ port: PORT, countLog: COUNT_LOG, launched: true });
  const host = server.hostFor('saoc');
  try {
    await countedGet(PORT, COUNT_LOG, host, '/about');
    const held = await countedGet(PORT, COUNT_LOG, host, '/about');
    check(held.requests === 0, `/about inside the window costs 0 requests (got ${held.requests})`);
    const waitSeconds = REVALIDATE_SECONDS + TTL_MARGIN_SECONDS;
    console.log(`waiting ${waitSeconds}s for the cache to expire`);
    await sleep(waitSeconds * 1000);
    const expired = await countedGet(PORT, COUNT_LOG, host, '/about');
    console.log(`after expiry the first request cost ${expired.requests}`);
    check(expired.requests >= 1 && expired.requests <= 2, `after expiry /about refetches 1 or 2 (got ${expired.requests})`);
    const again = await countedGet(PORT, COUNT_LOG, host, '/about');
    check(again.requests === 0, `the next /about holds again at 0 (got ${again.requests})`);
  } finally {
    server.stop();
  }
}

const titleOf = (html) => (/<title[^>]*>([^<]*)<\/title>/i.exec(html) ?? [])[1] ?? '';

async function runNotFound() {
  const server = await startServer({ port: PORT, countLog: COUNT_LOG, launched: true });
  try {
    for (const [site, paths] of Object.entries(UNMATCHED_PATHS)) {
      for (const path of paths) {
        const response = await countedGet(PORT, COUNT_LOG, server.hostFor(site), path, { wantBody: true });
        const title = titleOf(response.body);
        console.log(`${site} ${path}: ${response.status} title="${title}"`);
        check(response.status === 404, `${site} ${path} is 404 (got ${response.status})`);
        const titleOk = site === 'nos' ? title.includes(NOS_TITLE_PART) : title.endsWith(SAOC_TITLE_SUFFIX);
        check(titleOk, `${site} ${path} title is host-correct`);
      }
    }
    for (const path of SAOC_REDIRECT_PATHS) {
      const response = await countedGet(PORT, COUNT_LOG, server.hostFor('saoc'), path);
      console.log(`saoc ${path}: ${response.status} location=${response.location}`);
      check(response.status === PERMANENT_REDIRECT, `saoc ${path} is 308 (got ${response.status})`);
      check(
        (response.location ?? '').startsWith(`http://nos.localhost:${PORT}${path}`),
        `saoc ${path} redirects to the NOS origin`,
      );
    }
  } finally {
    server.stop();
  }
}

const MODES = {
  '--build': runBuild,
  '--assert': runAssert,
  '--ttl-check': runTtlCheck,
  '--notfound': runNotFound,
};

const mode = process.argv.slice(2).find((arg) => arg in MODES);
if (!mode) {
  console.error(`usage: sanity-request-count.mjs ${Object.keys(MODES).join(' | ')}`);
  process.exit(EXIT_SETUP);
}
try {
  clearFetchCache();
  const code = await MODES[mode]();
  process.exit(code ?? (failures.length ? EXIT_FAIL : 0));
} catch (error) {
  console.error(`sanity-request-count ${mode} failed:`, error instanceof Error ? error.message : error);
  process.exit(EXIT_SETUP);
}
