// nos-critique-r3 F3 — rendered check for R44 A5 (symposium jump link, presenter grid 2-up from 768).
// Starts `next start` on 3010-3019 (never 3002) via _server.mjs. On /national-show/symposium:
//   LINK   exactly one a.pc-jump-link reading "Presenters (N)" with N = number of .pc-card, href "#<id>"
//          resolving to .pc-sec-top, after the hero h1 and before .nos-presenters, >= 44px;
//          clicking lands the target at/below the sticky header (74px at 1280, 62px at 375) and sets the hash;
//   GRID   .pc-grid has 1 column at 375 and 2 at 768 and 1280; no horizontal overflow at 375/768/1280;
//          at 768 no card content overflows its card and the head text column is >= 150px;
//   NONE   wosa-conference does not get the jump link.
// Requires a current build. Run as: node contracts/checks/nos-critique-r3/check-rendered-f3.mjs
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { CSS, GRID, SECTION, finish, gitRoot } from './_lib.mjs';
import { AUTH, assertFreshBuild, require, startServer } from './_server.mjs';

const NAME = 'check-rendered-f3.mjs';
const failures = [];
const { chromium } = require('playwright');
const SHOTS = path.resolve(gitRoot, '..', 'critique-r3-shots');
const NS = 'app/(marketing)/national-show';

const stale = assertFreshBuild([GRID, SECTION, CSS, `${NS}/symposium/page.tsx`]);
if (stale.length > 0) finish(NAME, stale);

const rows = [];
let browser;
let stop = () => {};
try {
  const srv = await startServer();
  stop = srv.stop;
  const { origin } = srv;
  mkdirSync(SHOTS, { recursive: true });
  browser = await chromium.launch();
  const headers = { authorization: AUTH };

  // ---------------- R44 A5 on symposium ----------------
  for (const vp of [{ width: 375, height: 812, header: 62, cols: 1 }, { width: 768, height: 1024, header: 74, cols: 2 }, { width: 1280, height: 800, header: 74, cols: 2 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, extraHTTPHeaders: headers });
    const page = await ctx.newPage();
    const tag = `/national-show/symposium @${vp.width}`;
    const res = await page.goto(`${origin}/national-show/symposium`, { waitUntil: 'networkidle' });
    if (!res || res.status() !== 200) { failures.push(`${tag}: HTTP ${res && res.status()}`); await ctx.close(); continue; }
    await page.waitForSelector('.pc-grid[data-clamp]', { timeout: 10_000 }).catch(() => failures.push(`${tag}: grid never hydrated`));
    const m = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.nos-presenters .pc-card')];
      const links = [...document.querySelectorAll('a.pc-jump-link')];
      const link = links[0];
      const target = link ? document.getElementById((link.getAttribute('href') || '').slice(1)) : null;
      const h1 = document.querySelector('main h1');
      const host = document.querySelector('.nos-presenters');
      const lb = link ? link.getBoundingClientRect() : null;
      const cols = new Set(cards.map((c) => Math.round(c.getBoundingClientRect().left))).size;
      const card0 = cards[0];
      const ov = cards.filter((c) => c.scrollWidth > c.clientWidth + 1).length;
      const idCol = card0 ? card0.querySelector('.pc-id') : null;
      const nameOv = cards.filter((c) => [...c.querySelectorAll('.pc-name, .pc-role')].some((e) => e.scrollWidth > e.clientWidth + 1)).length;
      return {
        count: cards.length,
        links: links.length,
        text: link ? link.textContent.replace(/\s+/g, ' ').trim() : null,
        href: link ? link.getAttribute('href') : null,
        targetIsSecTop: !!(target && target.classList.contains('pc-sec-top')),
        orderOk: !!(link && h1 && host && (h1.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING) && (link.compareDocumentPosition(host) & Node.DOCUMENT_POSITION_FOLLOWING)) && (() => { const cs = document.querySelector('[data-nos-content-state]'); return !!cs && !!(link.compareDocumentPosition(cs) & Node.DOCUMENT_POSITION_FOLLOWING); })(),
        w: lb ? lb.width : 0,
        h: lb ? lb.height : 0,
        cols,
        ov,
        nameOv,
        idW: idCol ? idCol.getBoundingClientRect().width : 0,
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
        scrollMargin: target ? parseFloat(getComputedStyle(target).scrollMarginTop) : 0,
      };
    });
    rows.push(`  ${tag}: ${m.cols} column(s), jump link ${JSON.stringify(m.text)}, head column ${Math.round(m.idW)}px`);
    if (m.count === 0) { failures.push(`${tag}: no presenter cards`); await ctx.close(); continue; }
    if (m.links !== 1) failures.push(`${tag}: ${m.links} a.pc-jump-link elements, want exactly 1`);
    if (m.text !== `Presenters (${m.count})`) failures.push(`${tag}: jump link reads ${JSON.stringify(m.text)}, want "Presenters (${m.count})" (count derived from the ${m.count} cards)`);
    if (!m.href || !m.targetIsSecTop) failures.push(`${tag}: href ${JSON.stringify(m.href)} does not resolve to the presenters .pc-sec-top`);
    if (!m.orderOk) failures.push(`${tag}: jump link must follow the hero h1 and precede [data-nos-content-state] and .nos-presenters`);
    if (m.h < 44 || m.w < 44) failures.push(`${tag}: jump link target ${Math.round(m.w)}x${Math.round(m.h)}px, want >= 44x44`);
    if (m.scrollMargin < vp.header) failures.push(`${tag}: scroll-margin-top ${m.scrollMargin}px < sticky header ${vp.header}px`);
    if (m.cols !== vp.cols) failures.push(`${tag}: ${m.cols} card column(s), want ${vp.cols}`);
    if (m.sw > m.cw) failures.push(`${tag}: horizontal overflow ${m.sw} > ${m.cw}`);
    if (m.ov > 0 || m.nameOv > 0) failures.push(`${tag}: ${m.ov} card(s) overflow horizontally, ${m.nameOv} with clipped name/role`);
    if (vp.width === 768 && m.idW < 150) failures.push(`${tag}: head text column ${Math.round(m.idW)}px < 150px in the 2-up card`);
    await page.screenshot({ path: path.join(SHOTS, `r44-symposium-${vp.width}.png`), fullPage: true });
    if (vp.width !== 768) {
      await page.locator('a.pc-jump-link').click();
      await page.waitForTimeout(500);
      const top = await page.evaluate(() => document.querySelector('.nos-presenters .pc-sec-top').getBoundingClientRect().top);
      if (top < vp.header - 1) failures.push(`${tag}: after the jump the presenters heading is at ${Math.round(top)}px, under the ${vp.header}px sticky header`);
      if (!/#presenters-/.test(page.url())) failures.push(`${tag}: URL hash not set after click (${page.url()})`);
    }
    await ctx.close();
  }

  // ---------------- no jump link elsewhere ----------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, extraHTTPHeaders: headers });
    const page = await ctx.newPage();
    const res = await page.goto(`${origin}/national-show/wosa-conference`, { waitUntil: 'networkidle' });
    if (res && res.status() === 200 && (await page.locator('a.pc-jump-link').count()) !== 0) failures.push('wosa-conference: jump link must be symposium-only (R44 A5)');
    await ctx.close();
  }
} catch (err) {
  failures.push(`${err.name}: ${err.message}`);
} finally {
  if (browser) await browser.close();
  stop();
}

finish(NAME, failures, `R44 A5: jump link text/count/target/order/44px/header clearance, columns 1/2/2 at 375/768/1280, no overflow, 768 head column >= 150px, no link on wosa-conference. Measured:\n${rows.join('\n')}\nShots: ${SHOTS}`);
