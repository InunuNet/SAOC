// nos-critique-r8 f1 rendered: every R11 disclosure chip is one line at narrow widths, on all three routes, in public mode (where the disclosures render).
//   exhibitors, what-to-expect: chips inside [data-status-disclosure]; plan-your-visit: chips inside the role=group disclosures
//   widths 320, 359, 360, 374, 375, 390, 419, 420, 700: the page content width equals the viewport (scrollbars hidden), chip is one line and one line tall, font >= 12px
//   <=700: 10px inline padding; <=374: 0 tracking; 375..419: 0.02em; 420..700: 0.06em (inclusive at 374, 419 and 700)
//   Labels (F18b model on main 81490e7a, FINAL): exactly ONE label string is painted (displayed and not sr-only) and exactly ONE is exposed to assistive tech (displayed and not
//   aria-hidden; an sr-only full label counts). Painted = the short tag at <=359, the label assistive tech gets from 360. The chip's group/note keeps a full aria-label, never the short tag.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

import { finish, repoRoot } from './_lib.mjs';
import { AUTH } from './_server.mjs';
import { F1_PATHS, openMode } from './r8-lib.mjs';

const NAME = 'f1-rendered.mjs';
const failures = [];
const sourceFiles = [...F1_PATHS].filter((rel) => existsSync(path.join(repoRoot, rel)));
const ROUTES = [
  { route: '/national-show/exhibitors', sel: '[data-status-disclosure] :is([data-exhibitor-marker], [data-confirmation-badge])' },
  { route: '/national-show/what-to-expect', sel: '[data-status-disclosure] :is([data-exhibitor-marker], [data-confirmation-badge])' },
  { route: '/national-show/plan-your-visit', sel: '[role="group"] [data-confirmation-badge]' },
];
// <=359: the chip's visible text is the existing short tag (Codi FINAL), so 320 and 359 are asserted too; from 360 the full label shows.
const SHORT = 'To be confirmed';
const WIDTHS = [320, 359, 360, 374, 375, 390, 419, 420, 700];

const measure = (sel) => {
  const chips = [...document.querySelectorAll(sel)];
  const out = chips.map((b) => {
    const cs = getComputedStyle(b);
    // Label spans (the ※ glyph is not one). painted = drawn: displayed and not visually hidden (sr-only is a 1px absolute clip); at = in the accessibility tree.
    const spans = [...b.children].filter((c) => c.textContent.trim() !== '※').map((c) => {
      const s = getComputedStyle(c);
      const r = c.getBoundingClientRect();
      const shown = s.display !== 'none' && s.visibility !== 'hidden';
      return { el: c, text: c.textContent.replace(/\s+/g, ' ').trim(), painted: shown && !(s.position === 'absolute' && r.width <= 1 && r.height <= 1), at: shown && c.getAttribute('aria-hidden') !== 'true' };
    });
    const unpainted = spans.filter((x) => !x.painted).map((x) => x.el);
    // Lines are counted over painted text only: an sr-only label wraps inside its 1px clip box by design.
    const walker = document.createTreeWalker(b, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (unpainted.some((e) => e.contains(n)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    const tops = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const re = /\S+/g; let m;
      while ((m = re.exec(n.data))) { const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length); const rc = r.getClientRects()[0]; if (rc) tops.push({ t: rc.top, h: rc.height }); }
    }
    const lines = tops.reduce((acc, w) => (acc.length && Math.abs(acc[acc.length - 1] - w.t) < w.h / 2 ? acc : [...acc, w.t]), []).length;
    const fs = parseFloat(cs.fontSize);
    const lh = cs.lineHeight === 'normal' ? fs * 1.2 : parseFloat(cs.lineHeight);
    const box = ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth'].reduce((a, k) => a + parseFloat(cs[k]), 0);
    // textContent, not innerText: the chip is text-transform: uppercase, so innerText would never match the source-case strings.
    const painted = spans.filter((x) => x.painted).map((x) => x.text);
    const at = spans.filter((x) => x.at).map((x) => x.text);
    const owner = b.closest('[role="group"], [role="note"]');
    return { text: b.textContent.replace(/\s+/g, ' ').trim().slice(0, 40), painted, at, groupLabel: owner ? (owner.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim() : null, lines, h: b.getBoundingClientRect().height, oneLineH: lh + box, fs, ls: parseFloat(cs.letterSpacing) || 0, pl: parseFloat(cs.paddingLeft), pr: parseFloat(cs.paddingRight) };
  });
  return { chips: out, cw: document.documentElement.clientWidth, iw: window.innerWidth };
};

let browser;
let handle;
try {
  browser = await chromium.launch({ args: ['--hide-scrollbars'] });
  handle = await openMode('public', sourceFiles);
  if (handle.stale) finish(NAME, handle.stale);
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, extraHTTPHeaders: { authorization: AUTH } });
    const page = await ctx.newPage();
    for (const { route, sel } of ROUTES) {
      const tag = `${route} @${width}`;
      const res = await page.goto(`${handle.origin}${route}`, { waitUntil: 'networkidle' });
      if (!res || res.status() !== 200) { failures.push(`${tag}: HTTP ${res && res.status()}`); continue; }
      // Fonts first: the fallback face is wider than the web font, so a pre-swap measurement can wrap. Await fonts.ready and two frames, then take the first measurement that two
      // consecutive reads agree on (max 5), so a font-load race cannot fail the run and a wrap that persists cannot pass.
      const settle = () => page.evaluate(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))));
      await settle();
      let m = await page.evaluate(measure, sel);
      for (let i = 0; i < 5; i += 1) {
        await settle();
        const again = await page.evaluate(measure, sel);
        const same = JSON.stringify(again) === JSON.stringify(m);
        m = again;
        if (same) break;
      }
      if (m.cw !== width) failures.push(`${tag}: content width ${m.cw}, want ${width} (a scrollbar is eating the viewport)`);
      if (m.chips.length < 1) { failures.push(`${tag}: no disclosure chip found`); continue; }
      for (const c of m.chips) {
        const who = `${tag} chip "${c.text}"`;
        if (c.painted.length !== 1) failures.push(`${who}: ${c.painted.length} label strings are painted ${JSON.stringify(c.painted)}, want exactly one`);
        if (c.at.length !== 1) failures.push(`${who}: ${c.at.length} label strings are exposed to assistive tech ${JSON.stringify(c.at)}, want exactly one`);
        if (width <= 359) { if (c.painted[0] !== SHORT) failures.push(`${who}: paints "${c.painted[0]}" at <=359px, want the short tag "${SHORT}"`); }
        else if (c.painted[0] !== c.at[0]) failures.push(`${who}: paints "${c.painted[0]}" at ${width}px but exposes "${c.at[0]}"; the full label is painted from 360px up`);
        if (c.groupLabel === null || c.groupLabel === '' || c.groupLabel === SHORT) failures.push(`${who}: its group/note aria-label is ${JSON.stringify(c.groupLabel)}, want the full label text`);
        if (c.lines !== 1) failures.push(`${who}: wraps to ${c.lines} lines, want one`);
        if (c.h > c.oneLineH + 1) failures.push(`${who}: height ${c.h.toFixed(1)}px, want one line (${c.oneLineH.toFixed(1)}px)`);
        if (c.fs < 12) failures.push(`${who}: font-size ${c.fs}px, never below 12px`);
        if (c.pl !== 10 || c.pr !== 10) failures.push(`${who}: inline padding ${c.pl}/${c.pr}, want 10px at <=700`);
        const em = width <= 374 ? 0 : width <= 419 ? 0.02 : 0.06;
        const wantLs = em * c.fs;
        if (Math.abs(c.ls - wantLs) > 0.03) failures.push(`${who}: letter-spacing ${c.ls}px, want ${em}em (${wantLs.toFixed(2)}px)`);
      }
    }
    await ctx.close();
  }
} catch (e) {
  failures.push(`render error: ${e && e.message ? e.message : e}`);
} finally {
  if (handle) handle.stop();
  if (browser) await browser.close();
}

finish(NAME, failures, 'every disclosure chip on exhibitors, what-to-expect and plan-your-visit is one line at 320, 359, 360, 374, 375, 390, 419, 420 and 700 (content width), 0 tracking at <=374, 0.02em at 375..419, 0.06em up to and including 700, 10px padding, >=12px.');
