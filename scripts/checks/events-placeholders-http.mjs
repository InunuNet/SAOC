// Mission nos-site-split — invented-events gate (rendered half). Needs a prior `pnpm build` made with the same
// mode: `--mode=preview` (SHOW_PLACEHOLDER_PREVIEW=true and the wall creds at build and run time, like the other
// COPY GAP prose) or `--mode=public` (no preview flag). Starts `next start` on a fixed local port and reads
// /events, /events.ics, /sitemap.xml and the home page with GET only; takes shots to ../split-shots.
//   preview  /events lists one row per invented event dated today or later (5 on 2026-10-23), the rows carry no
//            marker of their own and are not links, one AI-event note stands above the list, the JSON-LD names no
//            invented event, and the feeds and sitemap list none
//   public   /events shows no marker and no invented title
import { spawn } from 'node:child_process';
import { mkdirSync, openSync, readFileSync } from 'node:fs';
import http from 'node:http';
import { chromium } from '@playwright/test';

const MODE = (process.argv.find((a) => a.startsWith('--mode=')) ?? '').slice('--mode='.length);
if (!['preview', 'public'].includes(MODE)) throw new Error('pass --mode=preview or --mode=public');
const PORT = 3218;
const HOST = `saoc.localhost:${PORT}`;
const AUTH = `Basic ${Buffer.from('s:p').toString('base64')}`;
const SHOT_DIR = '../split-shots';
const LOG_DIR = '.tmp/sandbox/nos-split';
const VIEWPORTS = [390, 1280];

const source = readFileSync('lib/data/placeholder-events.ts', 'utf8');
const entries = [...source.matchAll(/date: '([\d-]+)',(?:\s+endDate: '([\d-]+)',)?\s+title: '([^']+)'/g)].map((m) => ({ end: m[2] ?? m[1], title: m[3] }));
const todayIso = new Date().toISOString().slice(0, 10);
// A real National Show event is in Sanity under the same title as the invented one, so that one title may
// legitimately appear in the feeds; every other invented title must not.
const REAL_COLLISION = /National Orchid Show/;
const NATIONAL_SHOW = 'National Orchid Show';
const EVENT_LABEL = "AI event: waiting on SAOC's official events";
const DEFAULT_LABEL = 'Not confirmed by SAOC';
const mentions = (text) => entries.filter((e) => !REAL_COLLISION.test(e.title) && text.includes(e.title)).length;
const upcoming = entries.filter((e) => e.end >= todayIso);

mkdirSync(SHOT_DIR, { recursive: true });
mkdirSync(LOG_DIR, { recursive: true });
const log = openSync(`${LOG_DIR}/events-check-start.log`, 'w');
const env = {
  ...process.env,
  NODE_ENV: 'production',
  BETA_BASIC_AUTH_USER: 's',
  BETA_BASIC_AUTH_PASSWORD: 'p',
  SITE_PUBLIC_LAUNCH: '',
  NEXT_PUBLIC_SAOC_SITE_URL: `http://${HOST}`,
  NEXT_PUBLIC_NOS_SITE_URL: `http://nos.localhost:${PORT}`,
  SITE_URL: `http://${HOST}`,
};
if (MODE === 'preview') env.SHOW_PLACEHOLDER_PREVIEW = 'true';
else delete env.SHOW_PLACEHOLDER_PREVIEW;
const portBusy = await new Promise((resolve) => {
  const probe = http.request({ host: '127.0.0.1', port: PORT, path: '/', method: 'HEAD' }, () => resolve(true));
  probe.on('error', () => resolve(false));
  probe.end();
});
if (portBusy) throw new Error(`port ${PORT} is already serving; a stale server would answer instead of this build`);
const server = spawn('node_modules/.bin/next', ['start', '-p', String(PORT)], { stdio: ['ignore', log, log], env });

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures += 1;
}

function get(path) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: PORT, path, headers: { host: HOST, authorization: AUTH } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function waitUp() {
  for (let i = 0; i < 90; i += 1) {
    try {
      if ((await get('/robots.txt')).status) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`next start did not come up; see ${LOG_DIR}/events-check-start.log`);
}

async function run() {
  await waitUp();
  check('the invented-events module parses to 17 entries', entries.length === 17, `parsed ${entries.length}`);
  const page = await get('/events');
  check(`${MODE}: /events 200`, page.status === 200, `status=${page.status}`);
  const ld = [...page.body.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, httpCredentials: { username: 's', password: 'p' } });
  const tab = await context.newPage();
  await tab.goto(`http://${HOST}/events`, { waitUntil: 'networkidle' });
  const all = await tab.$$eval('article', (articles) =>
    articles.map((a) => ({ text: a.textContent, marked: a.querySelector('[data-placeholder-marker]') !== null, linked: a.querySelector('a') !== null })),
  );
  const noteLabels = await tab.$$eval('[data-events-about] [data-placeholder-marker]', (n) => n.map((x) => x.textContent));
  const rows = all.filter((r) => upcoming.some((e) => r.text.includes(e.title)));
  const showRows = all.filter((r) => r.text.includes(NATIONAL_SHOW)).length;
  const other = await context.newPage();
  await other.goto(`http://${HOST}/`, { waitUntil: 'networkidle' });
  const otherLabels = MODE === 'preview' ? await other.$$eval('[data-placeholder-marker]', (n) => n.map((x) => x.textContent)) : [];
  await context.close();
  if (MODE === 'preview') {
    check(`preview: ${upcoming.length} invented rows (today ${todayIso}), none with a marker of its own`, upcoming.length > 0 && rows.length === upcoming.length && rows.every((r) => !r.marked), `rows=${rows.length}`);
    check('preview: the National Orchid Show is listed once', showRows === 1, `rows=${showRows}`);
    check('preview: one AI-event note stands above the list', noteLabels.length === 1 && noteLabels[0] === EVENT_LABEL, `notes=${JSON.stringify(noteLabels)}`);
    check('preview: another page keeps the default marker text', otherLabels.length > 0 && otherLabels.every((t) => t === DEFAULT_LABEL), `labels=${JSON.stringify(otherLabels.slice(0, 3))}`);
    check('preview: invented rows are not links', rows.every((r) => !r.linked));
  } else {
    check('public: no invented row and no note on /events', rows.length === 0 && noteLabels.length === 0, `rows=${rows.length} notes=${noteLabels.length}`);
    check('public: no invented-only title on /events', mentions(page.body) === 0, `found ${mentions(page.body)}`);
  }
  check(`${MODE}: JSON-LD names no invented event`, mentions(ld) === 0, `found ${mentions(ld)}`);
  const ics = await get('/api/events.ics');
  check(`${MODE}: /events.ics lists no invented event`, mentions(ics.body) === 0, `status=${ics.status}`);
  const sitemap = await get('/sitemap.xml');
  check(`${MODE}: sitemap lists no invented event`, mentions(sitemap.body) === 0 && !/placeholder-\d+-\d{4}/.test(sitemap.body));
  const home = await get('/');
  check(`${MODE}: home lists no invented event`, mentions(home.body) === 0 && !/placeholder-\d+-\d{4}/.test(home.body));

  const shotBrowser = await chromium.launch();
  for (const width of VIEWPORTS) {
    const context = await shotBrowser.newContext({ viewport: { width, height: 900 }, httpCredentials: { username: 's', password: 'p' } });
    const shot = await context.newPage();
    await shot.goto(`http://${HOST}/events`, { waitUntil: 'networkidle' });
    await shot.screenshot({ path: `${SHOT_DIR}/events-${MODE}-${width}.png`, fullPage: true });
    await context.close();
  }
  await shotBrowser.close();
  await browser.close();
}

try {
  await run();
} catch (e) {
  console.log(`FAIL harness ${e.message}`);
  failures += 1;
} finally {
  server.kill();
}
console.log(failures === 0 ? `events ${MODE}: all passed` : `events ${MODE}: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
