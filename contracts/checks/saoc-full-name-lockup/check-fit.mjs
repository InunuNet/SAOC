#!/usr/bin/env node
// A8 — header, footer and mobile drawer fit at 1440/1280/1240/1024/768/390/360
// with the full-name lockup. Needs a LOCAL PRODUCTION BUILD already serving
// (pnpm build && pnpm start -p $PORT); BASE_URL defaults to http://localhost:3002.
// Beta wall credentials are read from .env.local when both are set.
import { chromium } from 'playwright';
import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: '.env.local' });
const BASE = process.env.BASE_URL || 'http://localhost:3002';
const u = process.env.BETA_BASIC_AUTH_USER, p = process.env.BETA_BASIC_AUTH_PASSWORD;
const httpCredentials = u && p ? { username: u, password: p } : undefined;
const WIDTHS = [1440, 1280, 1240, 1024, 768, 390, 360];
const problems = [];
const warnings = [];
const bad = (w, m) => problems.push(`${w}px: ${m}`);

const browser = await chromium.launch();
try {
  for (const w of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, httpCredentials });
    const page = await ctx.newPage();
    try { await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 }); }
    catch (e) { console.error('FAIL: cannot reach ' + BASE + ' (' + e.message + ')'); process.exit(2); }

    const m = await page.evaluate(() => {
      const vw = window.innerWidth;
      const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { l: b.left, r: b.right, w: b.width, h: b.height }; };
      const header = document.querySelector('header');
      const logo = header.querySelector('a[aria-label^="South African Orchid Council"] img');
      const burger = header.querySelector('button[aria-label="Open menu"]');
      const nav = header.querySelector('nav[aria-label="Primary"]');
      const navVisible = nav && getComputedStyle(nav).display !== 'none';
      // Single-line proof per nav item: every text rect sits on one baseline (a two-line
      // wrap yields two distinct tops), plus its height vs the shortest item.
      const items = navVisible ? [...nav.querySelectorAll('a, button')].filter((e) => e.getBoundingClientRect().height > 0) : [];
      const lines = (e) => { const rg = document.createRange(); rg.selectNodeContents(e); return new Set([...rg.getClientRects()].filter((q) => q.width > 0).map((q) => Math.round(q.top / 4))).size; };
      const heights = items.map((e) => e.getBoundingClientRect().height);
      const minH = heights.length ? Math.min(...heights) : 0;
      const wrapped = items.filter((e) => lines(e) > 1 || e.getBoundingClientRect().height > minH * 1.35).map((e) => e.textContent.trim().slice(0, 30));
      // Overflow attribution: elements past the viewport edge and whether they live in header/footer.
      const offenders = [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > vw + 0.5)
        .map((e) => ({ where: e.closest('header') ? 'header' : e.closest('footer') ? 'footer' : 'page', desc: e.tagName.toLowerCase() + ' ' + String(e.className).slice(0, 40) + ' r=' + e.getBoundingClientRect().right.toFixed(2) }));
      const footer = document.querySelector('footer');
      const fw = footer ? [...footer.querySelectorAll('span')].filter((s) => s.textContent.trim() === 'South African Orchid Council') : [];
      return {
        vw, docW: document.documentElement.scrollWidth,
        offenders, wrapped, logo: r(logo), burger: r(burger), burgerVisible: burger && getComputedStyle(burger).display !== 'none',
        navVisible, navBox: r(nav),
        footerW: footer ? footer.scrollWidth : 0, footerBox: r(footer),
        wordmarks: fw.map((s) => ({ ...r(s), sw: s.scrollWidth, cw: s.clientWidth, parent: r(s.closest('footer > div, footer div')) })),
      };
    });
    if (m.docW > m.vw) {
      // Only header/footer overflow is this change's responsibility; other page content is reported.
      const own = m.offenders.filter((o) => o.where !== 'page');
      if (own.length) bad(w, `header/footer overflow: scrollWidth ${m.docW} > ${m.vw} (${own.map((o) => o.desc).join('; ')})`);
      else if (!m.offenders.length) bad(w, `unattributed horizontal overflow: scrollWidth ${m.docW} > ${m.vw}`);
      else warnings.push(`${w}px: page-body overflow outside header/footer: ${m.offenders.map((o) => o.desc).join('; ')}`);
    }
    if (!m.logo || m.logo.w < 60) bad(w, 'header logo missing or collapsed');
    if (m.logo && m.logo.r > m.vw) bad(w, 'header logo exceeds viewport');
    if (m.burgerVisible && m.burger.r > m.vw) bad(w, `hamburger outside viewport (right ${m.burger.r})`);
    if (m.navVisible) {
      if (m.wrapped.length) bad(w, `primary nav item(s) wrap to two lines: ${m.wrapped.join(', ')}`);
      if (m.logo && m.navBox && m.logo.r > m.navBox.l) bad(w, 'logo overlaps primary nav');
    }
    if (m.footerW > m.vw) bad(w, 'footer overflows viewport');
    if (!m.wordmarks.length) bad(w, 'footer full-name wordmark span not found');
    for (const wm of m.wordmarks) {
      if (wm.r > m.vw || wm.l < 0) bad(w, 'footer wordmark outside viewport');
      if (wm.sw > wm.cw + 1) bad(w, 'footer wordmark clipped');
    }
    if (w <= 768) {
      await page.locator('header button[aria-label="Open menu"]').click();
      // Wait for slideInFromRight (250ms) to finish so geometry is the settled position.
      await page.locator('[role="dialog"] aside').waitFor();
      await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));
      await page.evaluate(() => Promise.all(document.querySelector('[role="dialog"] aside').getAnimations().map((a) => a.finished)));
      const d = await page.evaluate(() => {
        const dlg = document.querySelector('[role="dialog"]');
        const aside = dlg.querySelector('aside');
        const img = aside.querySelector('img[alt="South African Orchid Council"]');
        const close = aside.querySelector('button[aria-label="Close menu"]');
        const g = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, r: b.right }; };
        return { aside: g(aside), img: img ? g(img) : null, close: g(close), vw: window.innerWidth };
      });
      if (!d.img) bad(w, 'drawer lockup missing');
      else {
        if (d.img.r > d.close.l) bad(w, 'drawer lockup overlaps close button');
        if (d.img.l < d.aside.l || d.close.r > d.vw) bad(w, 'drawer content outside viewport');
      }
    }
    await ctx.close();
  }
} finally { await browser.close(); }

for (const x of warnings) console.warn('WARN: ' + x);
if (problems.length) { console.error('FAIL:\n' + problems.join('\n')); process.exit(1); }
console.log(`OK: header, footer and drawer fit at ${WIDTHS.join('/')}px`);
