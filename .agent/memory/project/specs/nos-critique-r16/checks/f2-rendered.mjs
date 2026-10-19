// nos-critique-r16 F2 rendered (fresh PUBLIC and PREVIEW production builds, next start 3010-3019 minus 3013). QA input, hash-locked.
// Golden: goldens/f2-edits.json. Both modes, 1280 and 390.
//   R1  the root 404 (an unmatched URL) carries the full SAOC chrome: HTTP 404; one "Utility bar" region, one header, one main#main-content,
//       one footer; the first Tab stop is the skip link to #main-content; the header, footer and utility bar read exactly as on
//       compareChromeRoute (/terms); at 1280 the "Primary" nav shows.
//   R2  no empty band: the hero section's bottom meets main's bottom and the footer's top (+-1px), and the footer ends the document.
//   R3  on both 404 routes (root and a marketing notFound()) the hero links read exactly "Go home", "Find a society" and the eyebrow keeps
//       its text and r15 ivory colour.
//   R4  /sponsors CTA: computed background is the handoff primary rgb(56,65,56), every corner radius 2px, ivory text >= 4.5:1, label and
//       href unchanged, and keyboard focus paints an indicator outside it >= 3:1 against its ground.
import { finish, goldenJson } from './_lib.mjs';
import { MODES, require, serve } from './_server.mjs';
import { ratio, round2 } from './_color.mjs';
import { fillOf, focusIndicator } from './_probe.mjs';

const { chromium } = require('playwright');
const NAME = 'f2-rendered.mjs';
const G = goldenJson('f2-edits.json');
const NF = G.notFound;
const SP = G.sponsors;
const WIDTHS = [1280, 390];
const failures = [];
let checks = 0;
const near = (a, b, d = 1) => Math.abs(a - b) <= d;

const chromeText = (page) => page.evaluate((util) => ({
  util: document.querySelector(`[role="region"][aria-label="${util}"]`)?.innerText.trim() ?? null,
  header: document.querySelector('header')?.innerText.trim() ?? null,
  footer: document.querySelector('footer')?.innerText.trim() ?? null,
}), NF.chrome.utilityBar);

for (const mode of MODES) {
  const srv = await serve(mode);
  if (srv.failures) { failures.push(...srv.failures.map((f) => `${mode}: ${f}`)); continue; }
  const browser = await chromium.launch();
  try {
    for (const width of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, extraHTTPHeaders: srv.headers ?? {} });
      const page = await ctx.newPage();
      const at = (route) => `${mode} ${route} @${width}`;
      const go = async (route) => { const r = await page.goto(`${srv.origin}${route}`, { waitUntil: 'networkidle' }); return r ? r.status() : 0; };

      // R1 + R2
      checks += 1;
      await go(NF.compareChromeRoute);
      const ref = await chromeText(page);
      const status = await go(NF.rootRoute);
      if (status !== 404) failures.push(`${at(NF.rootRoute)}: HTTP ${status}, want 404 (R1)`);
      const s = await page.evaluate(({ util, mainId, primary }) => {
        const q = (sel) => document.querySelectorAll(sel);
        const main = document.querySelector('main'); const sec = main?.querySelector('section'); const foot = document.querySelector('footer');
        const nav = document.querySelector(`nav[aria-label="${primary}"]`);
        const b = (e) => (e ? e.getBoundingClientRect() : null);
        return {
          util: q(`[role="region"][aria-label="${util}"]`).length, header: q('header').length, main: q('main').length, mainId: main?.id ?? null, footer: q('footer').length,
          navVisible: nav ? nav.getBoundingClientRect().width > 0 && getComputedStyle(nav).display !== 'none' : false,
          secBottom: sec ? b(sec).bottom + scrollY : null, mainBottom: main ? b(main).bottom + scrollY : null, footTop: foot ? b(foot).top + scrollY : null,
          footBottom: foot ? b(foot).bottom + scrollY : null, docH: document.documentElement.scrollHeight,
        };
      }, { util: NF.chrome.utilityBar, mainId: NF.chrome.mainId, primary: NF.chrome.primaryNav });
      const where = at(NF.rootRoute);
      if (s.util !== 1 || s.header !== 1 || s.main !== 1 || s.footer !== 1) failures.push(`${where}: chrome landmarks utility=${s.util} header=${s.header} main=${s.main} footer=${s.footer}, want 1 each (R1)`);
      if (s.mainId !== NF.chrome.mainId) failures.push(`${where}: main id ${JSON.stringify(s.mainId)}, want "${NF.chrome.mainId}" (R1)`);
      if (width >= 1240 && !s.navVisible) failures.push(`${where}: the "${NF.chrome.primaryNav}" nav is not shown (R1)`);
      await page.keyboard.press('Tab');
      const first = await page.evaluate(() => { const e = document.activeElement; return e ? { tag: e.tagName, href: e.getAttribute('href') } : null; });
      if (!first || first.href !== NF.chrome.skipHref) failures.push(`${where}: first Tab stop ${JSON.stringify(first)}, want the skip link to ${NF.chrome.skipHref} (R1)`);
      const got = await chromeText(page);
      for (const k of ['util', 'header', 'footer']) if (got[k] !== ref[k]) failures.push(`${where}: ${k} text differs from ${NF.compareChromeRoute}: ${JSON.stringify((got[k] ?? '').slice(0, 80))} vs ${JSON.stringify((ref[k] ?? '').slice(0, 80))} (R1)`);
      if (s.secBottom === null || s.mainBottom === null || s.footTop === null || !near(s.secBottom, s.mainBottom) || !near(s.mainBottom, s.footTop) || !near(s.footBottom, s.docH)) failures.push(`${where}: band below the hero: section bottom ${s.secBottom}, main bottom ${s.mainBottom}, footer ${s.footTop}-${s.footBottom}, document ${s.docH} (R2)`);

      // R3
      for (const route of NF.routes) {
        checks += 1;
        const st = await go(route);
        if (st !== 404) failures.push(`${at(route)}: HTTP ${st}, want 404 (R3)`);
        const t = await page.evaluate((eyebrow) => {
          const sec = document.querySelector('main section');
          const p = sec && [...sec.querySelectorAll('p')].find((x) => x.textContent.trim() === eyebrow);
          return { links: sec ? [...sec.querySelectorAll('a')].map((a) => a.textContent.trim()) : [], eyebrow: p ? getComputedStyle(p).color : null };
        }, NF.eyebrow.text);
        if (JSON.stringify(t.links) !== JSON.stringify(NF.labels.after)) failures.push(`${at(route)}: hero links ${JSON.stringify(t.links)}, want ${JSON.stringify(NF.labels.after)} (R3)`);
        if (t.eyebrow !== NF.eyebrow.color) failures.push(`${at(route)}: eyebrow "${NF.eyebrow.text}" colour ${t.eyebrow}, want ${NF.eyebrow.color} (R3)`);
      }

      // R4
      checks += 1;
      await go(SP.route);
      const cta = page.locator('main a').filter({ hasText: new RegExp(`^\\s*${SP.label}\\s*$`) }).first();
      if (!(await cta.count())) failures.push(`${at(SP.route)}: no "${SP.label}" link (R4)`);
      else {
        const f = await fillOf(page, cta);
        const c = await cta.evaluate((e) => { const s = getComputedStyle(e); return { href: e.getAttribute('href'), radii: [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius, s.borderBottomLeftRadius] }; });
        const bg = `rgb(${f.bg.join(', ')})`;
        if (bg !== SP.background) failures.push(`${at(SP.route)}: CTA background ${bg}, want ${SP.background} (R4)`);
        if (!c.radii.every((r) => r === SP.radius)) failures.push(`${at(SP.route)}: CTA radii ${c.radii.join(' ')}, want ${SP.radius} (R4)`);
        if (c.href !== SP.href) failures.push(`${at(SP.route)}: CTA href ${c.href}, want ${SP.href} (R4)`);
        const tr = ratio(f.fg, f.bg);
        if (tr < SP.minTextRatio) failures.push(`${at(SP.route)}: CTA text rgb(${f.fg}) on rgb(${f.bg}) = ${round2(tr)}:1, want >= ${SP.minTextRatio} (R4)`);
        const fi = await focusIndicator(page, cta, f.ground);
        if (!fi.fv || fi.changed === 0 || fi.best < SP.minFocusRatio) failures.push(`${at(SP.route)}: CTA focus indicator fv=${fi.fv} changed=${fi.changed}px best=${round2(fi.best)}:1 against rgb(${f.ground}), want >= ${SP.minFocusRatio} (R4)`);
      }
      await ctx.close();
    }
  } catch (e) {
    failures.push(`${mode}: render error: ${e && e.message ? e.message : e}`);
  } finally {
    await browser.close();
    await srv.stop();
  }
}
finish(NAME, failures, `F2 rendered: ${checks} checks across ${MODES.join('/')} at ${WIDTHS.join('/')}: root 404 in the full SAOC chrome with no band, sentence-case 404 links, handoff-primary sponsors CTA with focus.`);
