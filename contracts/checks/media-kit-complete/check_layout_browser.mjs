#!/usr/bin/env node
// A13 — Codi's pinned layout, rendered. Needs a LOCAL PRODUCTION BUILD already serving
// (pnpm build && pnpm start -p $PORT); BASE_URL defaults to http://localhost:3002.
// Test hooks the page must expose: data-kit-card on every download card, data-ground="light|dark"
// on the card and data-kit-preview on its preview box, section ids from goldens/labels.json.
import { readFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { chromium } from 'playwright';
import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: '.env.local' });
const LAB = JSON.parse(readFileSync('.agent/memory/project/specs/media-kit-complete/goldens/labels.json', 'utf8'));
const INV = JSON.parse(readFileSync('.agent/memory/project/specs/media-kit-complete/goldens/inventory.json', 'utf8'));
const PORT = 3021; // the one place the port is set; never 3002
const BASE = `http://localhost:${PORT}`;
if (PORT === 3002) { console.error('FAIL: 3002 is the live dev server; refusing'); process.exit(2); }
if (!existsSync('.next/BUILD_ID')) { console.error('FAIL: no production build (.next/BUILD_ID); run pnpm build first'); process.exit(2); }
const inUse = await new Promise((res) => { const t = net.createServer().once('error', () => res(true)).once('listening', () => t.close(() => res(false))); t.listen(PORT, '127.0.0.1'); });
if (inUse) { console.error(`FAIL: port ${PORT} is already in use; free it (this check never kills a process it did not start)`); process.exit(2); }
const server = spawn('pnpm', ['exec', 'next', 'start', '-p', String(PORT)], { stdio: 'ignore', env: { ...process.env, SITE_PUBLIC_LAUNCH: 'true' } });
const stop = () => { if (!server.killed) server.kill('SIGTERM'); };
process.on('exit', stop);
for (let i = 0; i < 60; i++) { try { if ((await fetch(BASE + '/')).status > 0) break; } catch { await new Promise((r) => setTimeout(r, 1000)); } }
const u = process.env.BETA_BASIC_AUTH_USER, p = process.env.BETA_BASIC_AUTH_PASSWORD;
const httpCredentials = u && p ? { username: u, password: p } : undefined;
const problems = [];
const bad = (m) => problems.push(m);
const norm = (s) => s.replace(/\s+/g, ' ').replace(/[’‘]/g, "'").trim();
const INKS = ['indigo', 'prussian', 'viridian', 'violet', 'teal', 'plum'];

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, httpCredentials });
  const page = await ctx.newPage();
  try { await page.goto(BASE + '/media-kit', { waitUntil: 'networkidle', timeout: 30000 }); }
  catch (e) { console.error('FAIL: cannot reach ' + BASE + ' (' + e.message + ')'); process.exit(2); }

  const ids = await page.$$eval('main section[id], section[id]', (els) => els.map((e) => e.id));
  const want = LAB.page_sections_in_order.map((s) => s.id);
  const got = want.filter((i) => ids.includes(i));
  if (got.join() !== want.join() || ids.filter((i) => want.includes(i)).join() !== want.join()) bad(`section order ${ids.join(',')} != ${want.join(',')}`);

  const qs = await page.$$eval('#quick-start [data-kit-card]', (c) => c.length);
  if (qs !== 1) bad(`quick start has ${qs} cards, want 1`);
  if (!(await page.locator('#quick-start').getByText('Download everything (zip)').count())) bad('quick start lacks "Download everything (zip)"');
  for (const id of ['full-colour', 'greyscale', 'duotone', 'mark-only', 'national-show'])
    if (!(await page.locator('#' + id).getByText('Download this section (zip)').count())) bad(`#${id} lacks "Download this section (zip)"`);

  // 2x2 lockup grids, real grounds
  for (const id of ['full-colour', 'greyscale']) {
    const n = await page.$$eval(`#${id} [data-kit-card]`, (c) => c.filter((e) => e.getBoundingClientRect().height > 0).length);
    if (n !== 4) bad(`#${id} shows ${n} cards, want 4`);
  }
  const grounds = await page.$$eval('[data-kit-card][data-ground] [data-kit-preview]', (els) => els.map((e) => [e.closest('[data-kit-card]').getAttribute('data-ground'), getComputedStyle(e).backgroundColor]));
  for (const [g, bg] of grounds) {
    const want = g === 'dark' ? 'rgb(56, 65, 56)' : 'rgb(244, 243, 236)';
    if (bg !== want) { bad(`preview on ${g} ground has background ${bg}, want ${want}`); break; }
  }

  // duotone ink picker
  const radios = await page.$$eval('#duotone input[type="radio"]', (r) => r.length);
  if (radios !== 6) bad(`duotone has ${radios} radios, want 6`);
  const four = await page.$$eval('#duotone [data-kit-card]', (c) => c.filter((e) => e.getBoundingClientRect().height > 0).length);
  if (four !== 4) bad(`duotone shows ${four} cards at 1280, want exactly 4`);
  const pickerText = await page.locator('#duotone').innerText();
  for (const [ink, hex] of Object.entries(INV.inks)) if (!pickerText.toLowerCase().includes(hex.toLowerCase())) bad(`picker lacks hex ${hex}`);
  const first = page.locator('#duotone input[type="radio"]').first();
  await first.focus();
  await page.keyboard.press('ArrowRight');
  const ring = await page.evaluate(() => { const a = document.activeElement, s = getComputedStyle(a); const sib = a.nextElementSibling || a.parentElement; const t = getComputedStyle(sib); return { os: s.outlineStyle, ow: s.outlineWidth, bs: s.boxShadow, tos: t.outlineStyle, tbs: t.boxShadow }; });
  if (!(ring.os !== 'none' || ring.bs !== 'none' || ring.tos !== 'none' || ring.tbs !== 'none')) bad('no visible focus ring on the ink picker after keyboard focus');
  const hash = await page.evaluate(() => location.hash);
  if (!INKS.some((i) => hash.includes(i))) bad(`hash ${JSON.stringify(hash)} does not name the selected ink`);
  const picked = INKS.find((i) => hash.includes(i));
  await page.goto(BASE + '/media-kit#duotone-teal', { waitUntil: 'networkidle' });
  const checked = await page.$$eval('#duotone input[type="radio"]:checked', (r) => r.map((e) => (e.value || e.id || '').toLowerCase()));
  if (!checked.some((v) => v.includes('teal'))) bad(`loading #duotone-teal selects ${checked.join()}`);

  // mark-only row, usage copy, nav, tabs
  const chips = await page.$$eval('#mark-only [data-kit-card]', (c) => c.length);
  if (chips < 16) bad(`mark-only has ${chips} cards, want >= 16 chips`);
  const body = norm(await page.locator('body').innerText());
  for (const t of LAB.usage_copy_verbatim) if (!body.includes(norm(t))) bad(`usage copy missing: ${t.slice(0, 50)}`);
  if (await page.locator('[role="tab"], [role="tablist"]').count()) bad('tabs present');
  const sticky = await page.$$eval('*', (els) => els.some((e) => getComputedStyle(e).position === 'sticky' && /on this page/i.test(e.textContent || '') && (e.textContent || '').length < 600));
  if (!sticky) bad('no sticky "On this page" at 1280');

  // every download link resolves
  const hrefs = await page.$$eval('a[download]', (a) => a.map((x) => x.getAttribute('href')));
  if (hrefs.length < 20) bad(`only ${hrefs.length} a[download] links`);
  for (const h of [...new Set(hrefs)].slice(0, 400)) {
    const r = await ctx.request.head(new URL(h, BASE).toString());
    if (r.status() !== 200) bad(`${h} -> ${r.status()}`);
  }
  await ctx.close();

  // 390: no overflow, one card per row, disclosure instead of anchor row
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, httpCredentials });
  const mp = await m.newPage();
  await mp.goto(BASE + '/media-kit', { waitUntil: 'networkidle' });
  const o = await mp.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: window.innerWidth }));
  if (o.sw > o.vw) bad(`390px: horizontal overflow ${o.sw} > ${o.vw}`);
  const tops = await mp.$$eval('#full-colour [data-kit-card]', (c) => c.filter((e) => e.getBoundingClientRect().height > 0).map((e) => Math.round(e.getBoundingClientRect().left)));
  if (new Set(tops).size > 1) bad(`390px: cards not one per row (lefts ${[...new Set(tops)].join()})`);
  if (!(await mp.locator('details summary', { hasText: 'On this page' }).count())) bad('390px: "On this page" is not a disclosure');
  await m.close();
} finally { await browser.close(); stop(); }

if (problems.length) { console.error(problems.join('\n')); console.error(`FAIL: ${problems.length} problem(s)`); process.exit(1); }
console.log('OK: pinned layout renders as ruled at 1280 and 390');
