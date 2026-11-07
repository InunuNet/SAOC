// nos-sticky-aside A2: headless sticky-aside offset measurement against the NOS host.
// Starts `next dev` on a free port from the cwd (repo root) in Sanity fixture-replay mode with the beta wall off, measures, and
// stops exactly the PID it started (pidfile .tmp/sandbox/nos-sticky-aside/server.pid, process group of that PID only; never pkill).
// Needs node_modules in the tree it runs from (no install is done here) and no window: Playwright chromium is headless.
// Exit codes: 0 all PASS · 1 a measurement FAIL · 2 setup failure · 3 BLOCKED (fixture miss, non-200, or #enquire could not reach the offset).
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';

const EXPECTED_TOP = 121; // pinned header bottom (97) + 24 (--space-5)
const TOLERANCE_PX = 1;
const STICKY_VIEWPORTS = [1024, 1440, 2056];
const NON_STICKY_VIEWPORTS = [1023, 768, 390];
const VIEWPORT_HEIGHT = 900;
const WE_SCROLL_Y = 600;
const SERVER_TIMEOUT_MS = 420_000;
const SANDBOX = '.tmp/sandbox/nos-sticky-aside';
const PIDFILE = `${SANDBOX}/server.pid`;
const FIXTURE_DIR = path.resolve('.agent/memory/project/specs/nos-content-standard/fixtures/sanity');
const FIXTURE_LOGDIR = path.resolve(`${SANDBOX}/fixture-logs`);
const NEXT_BIN = 'node_modules/next/dist/bin/next';

const results = [];
const verdict = (id, status, detail) => { results.push({ id, status, detail }); console.log(`${status} ${id} ${detail}`); };
const setupFail = (msg) => { console.error(`SETUP ${msg}`); process.exit(2); };

if (!existsSync(NEXT_BIN)) setupFail(`${NEXT_BIN} missing: node_modules is not present in ${process.cwd()}`);
let chromium;
try { ({ chromium } = createRequire(`${process.cwd()}/package.json`)('@playwright/test')); } catch (e) { setupFail(`@playwright/test not resolvable: ${e.message}`); }

const freePort = () => new Promise((resolve, reject) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); }); s.on('error', reject); });

mkdirSync(FIXTURE_LOGDIR, { recursive: true });
for (const f of ['_started.log', '_hits.log', '_misses.log', '_requests.log']) writeFileSync(`${FIXTURE_LOGDIR}/${f}`, '');
if (existsSync('scripts/generate-image-variants.mjs') && !existsSync('public/images/_opt')) spawnSync(process.execPath, ['scripts/generate-image-variants.mjs'], { stdio: 'ignore' });

const port = await freePort();
const nos = `http://nos.localhost:${port}`;
const env = {
  ...process.env, BETA_BASIC_AUTH_USER: '', BETA_BASIC_AUTH_PASSWORD: '', BETA_PASSWORD_WALL_OFF: 'true', SITE_PUBLIC_LAUNCH: '',
  SANITY_FIXTURE_MODE: 'replay', SANITY_FIXTURE_DIR: FIXTURE_DIR, SANITY_FIXTURE_LOGDIR: FIXTURE_LOGDIR,
  NEXT_PUBLIC_NOS_SITE_URL: nos, NEXT_PUBLIC_SAOC_SITE_URL: `http://saoc.localhost:${port}`, SITE_URL: nos,
};
delete env.K_SERVICE;
const server = spawn(process.execPath, [NEXT_BIN, 'dev', '--port', String(port)], { stdio: 'ignore', env, detached: true });
writeFileSync(PIDFILE, String(server.pid));
const stopServer = () => {
  try { process.kill(-server.pid, 'SIGTERM'); } catch { /* already gone */ }
  rmSync(PIDFILE, { force: true });
};
process.on('exit', stopServer);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(2));

let browser;
try {
  const deadline = Date.now() + SERVER_TIMEOUT_MS;
  for (;;) {
    try { const r = await fetch(`${nos}/sponsors`); if (r.status === 200) break; } catch { /* not up yet */ }
    if (Date.now() > deadline) setupFail('NOS /sponsors never answered 200 on the dev server');
    await new Promise((r) => setTimeout(r, 2000));
  }
  await fetch(`${nos}/what-to-expect`).catch(() => {});

  browser = await chromium.launch();
  const settle = async (page) => {
    let last = -1;
    for (let i = 0; i < 20; i += 1) {
      await page.waitForTimeout(150);
      const y = await page.evaluate(() => window.scrollY);
      if (y === last) return;
      last = y;
    }
  };
  const open = async (width, route) => {
    const ctx = await browser.newContext({ viewport: { width, height: VIEWPORT_HEIGHT } });
    const page = await ctx.newPage();
    const resp = await page.goto(`${nos}${route}`, { waitUntil: 'load', timeout: 120_000 });
    await page.waitForSelector('header', { timeout: 60_000 }).catch(() => {});
    await page.waitForTimeout(500);
    return { ctx, page, status: resp ? resp.status() : 0 };
  };
  const top = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().top : null; }, sel);
  const position = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).position : null; }, sel);
  const near = (v, want) => v !== null && Math.abs(v - want) <= TOLERANCE_PX;

  for (const width of STICKY_VIEWPORTS) {
    const sp = await open(width, '/sponsors#enquire');
    if (sp.status !== 200) { verdict(`sponsors-${width}`, 'BLOCKED', `status ${sp.status}`); await sp.ctx.close(); continue; }
    await settle(sp.page);
    const aside = await top(sp.page, '[data-doc-aside-kind="content"]');
    const enquire = await top(sp.page, '#enquire');
    const header = await sp.page.evaluate(() => document.querySelector('header')?.getBoundingClientRect().bottom ?? null);
    console.log(`INFO sponsors-${width} header-bottom=${header} aside-top=${aside} enquire-top=${enquire}`);
    if (aside === null || enquire === null) verdict(`sponsors-${width}`, 'FAIL', `missing element (aside=${aside}, #enquire=${enquire})`);
    else if (!near(enquire, EXPECTED_TOP)) verdict(`sponsors-${width}`, 'BLOCKED', `#enquire landed at ${enquire}, not ${EXPECTED_TOP}: page too short to scroll it there, offset not measurable`);
    else if (near(aside, enquire) && near(aside, EXPECTED_TOP)) verdict(`sponsors-${width}`, 'PASS', `aside ${aside} = #enquire ${enquire} = ${EXPECTED_TOP}±${TOLERANCE_PX}`);
    else verdict(`sponsors-${width}`, 'FAIL', `aside top ${aside} vs #enquire top ${enquire} (want both ${EXPECTED_TOP}±${TOLERANCE_PX})`);
    await sp.ctx.close();

    const we = await open(width, '/what-to-expect');
    if (we.status !== 200) { verdict(`what-to-expect-${width}`, 'BLOCKED', `status ${we.status}`); await we.ctx.close(); continue; }
    await we.page.evaluate((y) => window.scrollTo(0, y), WE_SCROLL_Y);
    await settle(we.page);
    const card = await top(we.page, '.nos-we-card');
    verdict(`what-to-expect-${width}`, near(card, EXPECTED_TOP) ? 'PASS' : 'FAIL', `dates card top ${card} (want ${EXPECTED_TOP}±${TOLERANCE_PX})`);
    await we.ctx.close();
  }

  for (const width of NON_STICKY_VIEWPORTS) {
    for (const [route, sel] of [['/sponsors', '[data-doc-aside-kind="content"]'], ['/what-to-expect', '.nos-we-card']]) {
      const p = await open(width, route);
      if (p.status !== 200) { verdict(`non-sticky-${route}-${width}`, 'BLOCKED', `status ${p.status}`); await p.ctx.close(); continue; }
      const pos = await position(p.page, sel);
      verdict(`non-sticky-${route}-${width}`, pos !== null && pos !== 'sticky' ? 'PASS' : 'FAIL', `${sel} position=${pos}`);
      await p.ctx.close();
    }
  }

  const misses = existsSync(`${FIXTURE_LOGDIR}/_misses.log`) ? readFileSync(`${FIXTURE_LOGDIR}/_misses.log`, 'utf8').split('\n').filter(Boolean) : [];
  if (misses.length) verdict('fixture-misses', 'BLOCKED', `${misses.length} Sanity fixture miss(es), first: ${misses[0].slice(0, 160)}`);
} finally {
  if (browser) await browser.close();
}

const fail = results.some((r) => r.status === 'FAIL');
const blocked = results.some((r) => r.status === 'BLOCKED');
process.exit(fail ? 1 : blocked ? 3 : 0);
