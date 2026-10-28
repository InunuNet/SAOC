// A7 (node gate-render.mjs url) and A8 (node gate-render.mjs content): the built site on the NOS host, from `next start` on a port this gate owns
// (killed by exact child PID, never pkill), reading Sanity ONLY from the captured fixture (replay, zero Sanity API requests). Run after checks/build.sh.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import net from 'node:net';
import { existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { awardLinkViolations, followWithAuth } from './_lib.mjs';

const MODE = process.argv[2];
if (!['url', 'content'].includes(MODE)) { console.error('usage: gate-render.mjs url|content'); process.exit(2); }
const SPEC = '.agent/memory/project/specs/nos-award-entries';
const FIXTURE_DIR = path.resolve('.agent/memory/project/specs/nos-content-standard/fixtures/sanity');
const BLOCK_NET = path.resolve('.agent/memory/project/specs/nos-content-standard/checks/block-sanity-net.cjs');
const LOG_DIR = path.resolve('.tmp/sandbox/nos-award-entries-gate');
const FIX_LOG = `${LOG_DIR}/fixture-logs-${MODE}`;
const PORT = Number(process.env.NOS_AE_PORT ?? 3141) + 1; // the port build.sh baked into the site URLs
const AUTH_USER = 'sandbox';
const AUTH_PASS = 'sandbox-pass';
const AUTH = `Basic ${Buffer.from(`${AUTH_USER}:${AUTH_PASS}`).toString('base64')}`;
const NOS = `http://nos.localhost:${PORT}`;
const audit = JSON.parse(readFileSync(`${SPEC}/goldens/exhibitor-audit.json`, 'utf8')).rows;
const copy = JSON.parse(readFileSync(`${SPEC}/goldens/award-copy.json`, 'utf8'));
// Class-b phrases that legitimately contain the word on the Award Entries page (stand-booking terms and the /vendors nav label).
const CLASS_B_PHRASES = [/Display Exhibitors?/g, /Exhibitors and vendors/g, /Retail Vendors/g];
const norm = (t) => t.replace(/[\s ]+/g, ' ').trim();
const failures = [];
const check = (name, ok, detail = '') => { if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ''}`); };

mkdirSync(LOG_DIR, { recursive: true });
mkdirSync(FIX_LOG, { recursive: true });
for (const f of ['_started.log', '_hits.log', '_misses.log', '_requests.log', '_net.log', '_assets.log']) writeFileSync(`${FIX_LOG}/${f}`, '');
const busy = await new Promise((r) => { const s = net.createConnection({ port: PORT, host: '127.0.0.1' }); s.once('connect', () => { s.destroy(); r(true); }); s.once('error', () => r(false)); });
if (busy) { console.error(`port ${PORT} is already in use; stop that exact PID or set NOS_AE_PORT`); process.exit(1); }

const env = {
  ...process.env, NODE_ENV: 'production', BETA_BASIC_AUTH_USER: AUTH_USER, BETA_BASIC_AUTH_PASSWORD: AUTH_PASS, SITE_PUBLIC_LAUNCH: '',
  NEXT_PUBLIC_NOS_SITE_URL: NOS, NEXT_PUBLIC_SAOC_SITE_URL: `http://saoc.localhost:${PORT}`, SITE_URL: NOS,
  SANITY_FIXTURE_MODE: 'replay', SANITY_FIXTURE_DIR: FIXTURE_DIR, SANITY_FIXTURE_LOGDIR: FIX_LOG,
  NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --require "${BLOCK_NET}"`.trim(),
};
delete env.BETA_PASSWORD_WALL_OFF; delete env.K_SERVICE; delete env.SANITY_NET_ALLOW;
const proc = spawn('node_modules/.bin/next', ['start', '-p', String(PORT)], { stdio: ['ignore', openSync(`${LOG_DIR}/next-start-${MODE}.log`, 'w'), openSync(`${LOG_DIR}/next-start-${MODE}.log`, 'a')], env });
writeFileSync(`${LOG_DIR}/server-${MODE}.pid`, String(proc.pid));
let finished = false;
proc.on('exit', (code) => { if (!finished) { console.error(`next start exited early (code ${code}); see ${LOG_DIR}/next-start-${MODE}.log`); process.exit(1); } });
const finish = () => {
  finished = true; proc.kill(); // the exact child this gate spawned
  if (failures.length) { console.error(`gate-render ${MODE} FAILED (${failures.length}):\n- ${failures.join('\n- ')}`); process.exit(1); }
  console.log(`gate-render ${MODE} pass`); process.exit(0);
};

const get = (p, opts = {}) => fetch(`${NOS}${p}`, { headers: { authorization: AUTH }, redirect: 'manual', ...opts });
try {
  let up = false;
  for (let i = 0; i < 90 && !up; i += 1) { try { up = (await get('/exhibitors')).status < 500; } catch { await new Promise((r) => setTimeout(r, 1000)); } }
  check('server became ready', up);

  const require = createRequire(`${process.cwd()}/package.json`);
  const { chromium } = require('@playwright/test');
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, httpCredentials: { username: AUTH_USER, password: AUTH_PASS } });
  const open = async (p) => { const page = await context.newPage(); const res = await page.goto(`${NOS}${p}`, { waitUntil: 'load' }); await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {}); return { page, res }; };

  if (MODE === 'url') {
    const NEW = '/award-entries';
    const ok = await get(NEW);
    check(`${NEW} on the NOS host returns 200`, ok.status === 200, `status ${ok.status}`);
    const loc = (r) => r.headers.get('location') ?? '';
    for (const old of ['/exhibitors', '/national-show/exhibitors']) {
      const r1 = await get(`${old}`);
      check(`NOS host ${old} is a 308 permanent redirect`, r1.status === 308, `status ${r1.status}`);
      check(`NOS host ${old} lands on ${NEW} in one hop`, new URL(loc(r1), NOS).pathname === NEW, loc(r1));
      const r2 = await get(`${old}?utm_source=x&a=1`);
      check(`NOS host ${old} keeps the query string`, new URL(loc(r2), NOS).search === '?utm_source=x&a=1', loc(r2));
    }
    const saoc = `http://saoc.localhost:${PORT}`;
    const sr = await fetch(`${saoc}/national-show/exhibitors?utm_source=x`, { headers: { authorization: AUTH }, redirect: 'manual' });
    check('SAOC host /national-show/exhibitors is a 308 straight to the NOS /award-entries (one hop, query kept)', sr.status === 308 && new URL(loc(sr), saoc).pathname === NEW && new URL(loc(sr), saoc).search === '?utm_source=x' && new URL(loc(sr), saoc).host.startsWith('nos.'), `${sr.status} ${loc(sr)}`);
    const sf = await followWithAuth(`${saoc}/national-show/award-entries`, AUTH);
    check('SAOC host /national-show/award-entries redirects to a 200 on /award-entries (auth re-sent on every hop)', sf.status === 200 && new URL(sf.url).pathname === NEW && sf.hops >= 1, `${sf.status} ${sf.url} hops ${sf.hops}`);
    const site = await get('/sitemap.xml');
    const xml = await site.text();
    check('sitemap lists /award-entries', xml.includes('/award-entries'));
    check('sitemap does not list /exhibitors', !/\/exhibitors<|\/exhibitors\//.test(xml));

    const { page } = await open(NEW);
    check('document title contains "Award Entries"', (await page.title()).includes(copy.pageTitle), await page.title());
    check('og:title contains "Award Entries"', ((await page.locator('meta[property="og:title"]').getAttribute('content').catch(() => '')) ?? '').includes(copy.pageTitle));
    check('h1 reads "Award Entries"', norm(await page.locator('h1').first().textContent()) === copy.pageTitle);
    const crumb = norm((await page.locator('nav[aria-label="Breadcrumb"] [aria-current="page"]').first().textContent().catch(() => '')) ?? '');
    check('breadcrumb current page reads "Award Entries"', crumb === copy.pageTitle, crumb);
    for (const p of [NEW, '/']) {
      const { page: pg } = p === NEW ? { page } : await open(p);
      const links = await pg.$$eval('a[href]', (as) => as.map((a) => ({ href: a.getAttribute('href'), path: new URL(a.href).pathname, text: (a.textContent ?? '').replace(/[→\s ]+/g, ' ').trim() })));
      const lv = awardLinkViolations(links, NEW, copy.pageTitle);
      check(`${p}: every link to ${NEW} reads "Award Entries" (header, footer, show index; same-page fragment links excluded; ${lv.found} found)`, lv.found > 0 && lv.bad.length === 0, JSON.stringify(lv.bad.map((l) => l.text)));
      check(`${p}: no link points at /exhibitors`, !links.some((l) => /^\/(national-show\/)?exhibitors$/.test(l.path)), JSON.stringify(links.filter((l) => /exhibitors$/.test(l.path))));
      check(`${p}: "Plant Entry/Registration" is gone`, !(await pg.evaluate(() => document.documentElement.textContent)).includes('Plant Entry/Registration'));
    }
    // Vendor pages keep their titles (AE-1 open questions a, b, c are with Lee-Ann).
    const v = await open('/vendors');
    check('/vendors h1 is unchanged ("Exhibitors and vendors")', norm(await v.page.locator('h1').first().textContent()) === 'Exhibitors and vendors');
  } else {
    const { page } = await open('/award-entries');
    const sections = await page.$$eval('section[data-award-type]', (els) => els.map((s) => ({
      type: s.getAttribute('data-award-type'),
      h2: s.querySelector('h2')?.textContent ?? '',
      ps: [...s.querySelectorAll('p')].filter((p) => !p.hasAttribute('data-exhibitor-marker')).map((p) => p.textContent ?? ''),
      marker: s.querySelector('[data-exhibitor-marker]')?.textContent ?? null,
      total: s.textContent ?? '',
    })));
    check(`exactly two award sections, in order (${copy.sections.map((s) => s.awardType).join(', ')})`, JSON.stringify(sections.map((s) => s.type)) === JSON.stringify(copy.sections.map((s) => s.awardType)), JSON.stringify(sections.map((s) => s.type)));
    for (const want of copy.sections) {
      const s = sections.find((x) => x.type === want.awardType);
      if (!s) continue;
      check(`${want.awardType}: h2 reads "${want.heading}"`, norm(s.h2) === want.heading, norm(s.h2));
      check(`${want.awardType}: the lede is the bare definition sentence, verbatim`, s.ps.map(norm).includes(want.lede), JSON.stringify(s.ps.map(norm)));
      check(`${want.awardType}: the awaiting-committee-copy marker is visible`, !!s.marker && norm(s.marker).toLowerCase().includes(copy.markerLabel.toLowerCase()), String(s.marker));
      const rest = norm(s.total.replace(s.h2, '').replace(want.lede, '').replace(s.marker ?? '', ''));
      check(`${want.awardType}: nothing else is written in the section (no invented copy)`, rest === '', rest);
    }
    const headings = await page.$$eval('main h2', (els) => els.map((e) => e.textContent));
    check('the two award h2s are sequential siblings at the same level', headings.length >= 2 && headings.filter((h) => copy.sections.some((s) => s.heading === norm(h ?? ''))).length === 2);
    const body = await page.evaluate(() => { const m = document.querySelector('main').cloneNode(true); m.querySelectorAll('nav.nos-index').forEach((e) => e.remove()); return m.textContent ?? ''; });
    let text = norm(body); for (const re of CLASS_B_PHRASES) text = text.replace(re, '');
    const stray = text.match(/.{0,40}exhibitors?.{0,40}/gi);
    check('/award-entries body has no class-a "exhibitor" wording', !stray, stray ? stray.join(' | ') : '');

    // Audit rows with a rendered route: old text gone, new text present (change); class-b text kept (keep). Sanity-held rows are notes.
    const cache = new Map();
    const loaded = async (route) => { if (!cache.has(route)) { const { page: pg } = await open(route); cache.set(route, { text: norm(await pg.evaluate(() => document.documentElement.textContent)), aria: await pg.$$eval('[aria-label]', (els) => els.map((e) => e.getAttribute('aria-label'))) }); } return cache.get(route); };
    for (const r of audit) {
      if (!r.route || (r.class === 'c')) continue;
      const oldText = r.visible ?? r.current; const newText = r.visibleNew ?? r.new;
      if (r.sanityHeld) { const { text } = await loaded(r.route); console.log(`NOTE ${r.id} (Sanity-held, SAOC to update): old text ${text.includes(norm(oldText.split(' / ')[0])) ? 'still rendered' : 'not rendered'} on ${r.route}`); continue; }
      if (r.action === 'change') {
        const { text, aria } = await loaded(r.route);
        const hay = r.where === 'aria-label' ? aria.join('\n') : text;
        check(`${r.id} ${r.route}: old text gone ("${oldText}")`, !hay.includes(norm(oldText)));
        check(`${r.id} ${r.route}: new text rendered ("${newText}")`, hay.includes(norm(newText)));
      } else if (r.action === 'keep') {
        const { text } = await loaded(r.route);
        check(`${r.id} ${r.route}: class-b text kept ("${oldText}")`, text.includes(norm(oldText)));
      }
    }

    // AE-1 gate: every visible "exhibitor" on every indexable NOS page must be in the signed-off list (goldens/exhibitor-visible-list.json).
    const allow = JSON.parse(readFileSync(`${SPEC}/goldens/exhibitor-visible-list.json`, 'utf8')).entries;
    const manifest = JSON.parse(readFileSync('content/national-show-routes.json', 'utf8')).routes;
    const crawl = ['/', ...manifest.filter((r) => r.indexable && !r.dynamic && r.slug.startsWith('/national-show/')).map((r) => r.slug.replace('/national-show', ''))];
    let seen = 0;
    for (const route of [...new Set(crawl)]) {
      const { page: pg, res } = await open(route);
      if (!res || res.status() !== 200) { console.log(`NOTE crawl ${route}: status ${res?.status()}`); await pg.close(); continue; }
      const text = await pg.evaluate(() => document.body.innerText);
      for (const line of text.split('\n').filter((l) => /exhibitor/i.test(l))) {
        seen += 1;
        const low = line.toLowerCase();
        const hit = allow.find((e) => (e.exact ? low.trim() === e.fragment : low.includes(e.fragment)));
        if (!hit) check(`visible "exhibitor" on ${route} is in the signed-off list`, false, line.trim().slice(0, 160));
        else if (hit.status !== 'stand') console.log(`NOTE ${route}: ${hit.status} (${hit.ref ?? '-'}): ${line.trim().slice(0, 100)}`);
      }
      await pg.close();
    }
    console.log(`visible-exhibitor crawl: ${seen} line(s) across ${new Set(crawl).size} route(s)`);
  }
  // Fixture proof: this server read Sanity only from the capture.
  const lines = (f) => (existsSync(`${FIX_LOG}/${f}`) ? readFileSync(`${FIX_LOG}/${f}`, 'utf8').split('\n').filter(Boolean) : []);
  check('server ran with SANITY_FIXTURE_MODE=replay (_started.log)', lines('_started.log').some((l) => l.includes('mode=replay')));
  check('zero Sanity API requests from the server', lines('_net.log').length === 0, lines('_net.log').slice(0, 3).join(' | '));
  check('zero fixture misses', lines('_misses.log').length === 0, lines('_misses.log').slice(0, 3).join(' | '));
  await browser.close();
} catch (e) { failures.push(`exception ${e.message}`); console.error(e); }
finish();
