// nos-critique-r9 f3 rendered (production build, public mode): the chip's tracking and short-tag steps leave no gap at fractional widths.
//   Headless Chrome snaps viewports to integers, so fractional widths cannot be rendered. Two measurements instead:
//   (1) computed values at 359, 360, 374, 375, 419, 420, 700, 701 on exhibitors (ShowStatusLine) and plan-your-visit (VisitDisclosure): tracking 0 / 0.02em / 0.06em / default,
//       and the painted label (displayed, not sr-only) is the short tag at <=359 only.
//   (2) CSSOM coverage of the production stylesheets on a 0.05px grid from 300 to 701: every width <=700 is matched by an important tracking rule that sets the expected value
//       (0 below 375, 0.02em below 420, 0.06em up to and including 700), no such rule matches above 700.05, and every display toggle that swaps the full label and short tag
//       flips at exactly 360 (true iff width<360). Media conditions are evaluated here from their text (max-width, min-width and range syntax, joined by and).
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

import { finish, repoRoot } from './_lib.mjs';
import { AUTH } from './_server.mjs';
import { F3_PATHS, openMode } from './r9-lib.mjs';

const NAME = 'f3-rendered.mjs';
const failures = [];
const sourceFiles = [...F3_PATHS].filter((rel) => existsSync(path.join(repoRoot, rel)));
const SHORT = 'To be confirmed';
const ROUTES = [
  { route: '/national-show/exhibitors', sel: '[data-status-disclosure] :is([data-exhibitor-marker], [data-confirmation-badge])' },
  { route: '/national-show/plan-your-visit', sel: '[role="group"] [data-confirmation-badge]' },
];
const WIDTHS = [359, 360, 374, 375, 419, 420, 700, 701];
const expectedEm = (w) => (w < 375 ? 0 : w < 420 ? 0.02 : w <= 700 ? 0.06 : null);

const px = (s) => parseFloat(s);
// One parenthesised feature against a width.
function feature(f, w) {
  let m;
  if ((m = f.match(/^max-width:\s*([\d.]+)px$/))) return w <= px(m[1]);
  if ((m = f.match(/^min-width:\s*([\d.]+)px$/))) return w >= px(m[1]);
  const ops = { '<': (a, b) => a < b, '<=': (a, b) => a <= b, '>': (a, b) => a > b, '>=': (a, b) => a >= b };
  if ((m = f.match(/^width\s*(<=|>=|<|>)\s*([\d.]+)px$/))) return ops[m[1]](w, px(m[2]));
  if ((m = f.match(/^([\d.]+)px\s*(<=|>=|<|>)\s*width$/))) return ops[m[2]](px(m[1]), w);
  if ((m = f.match(/^([\d.]+)px\s*(<=|<)\s*width\s*(<=|<)\s*([\d.]+)px$/))) return ops[m[2]](px(m[1]), w) && ops[m[3]](w, px(m[4]));
  return false; // not a width query we emit (print, rem or container); never a chip step
}
// One media condition: "not all and (X)" (what lightningcss lowers a range to) is the negation of X; "not all" alone never matches; otherwise features joined by and.
const matches = (conds, w) => conds.every((c) => {
  const t = c.trim().toLowerCase();
  if (t === 'not all') return false;
  const neg = t.match(/^not all and (.*)$/);
  if (neg) return !matches([neg[1]], w);
  return t.split(/\)\s*and\s*\(/).map((f) => f.replace(/^\(|\)$/g, '').trim()).every((f) => feature(f, w));
});

const collect = () => {
  const rows = [];
  const walk = (rules, conds) => {
    for (const r of rules) {
      if (r.media) walk(r.cssRules, [...conds, r.conditionText || r.media.mediaText]);
      else if (r.style) {
        if (/\\@media/.test(r.selectorText) && r.style.getPropertyValue('letter-spacing') && r.style.getPropertyPriority('letter-spacing') === 'important') rows.push({ conds, sel: r.selectorText, kind: 'ls', v: r.style.getPropertyValue('letter-spacing') });
        if (/\\@media/.test(r.selectorText) && r.style.getPropertyValue('display') && /hidden|inline/.test(r.selectorText) && conds.length) rows.push({ conds, sel: r.selectorText, kind: 'display', v: r.style.getPropertyValue('display') });
        // F18b hides the full label with sr-only (position + clip), not display: that rule is a toggle too and must flip at 360 with the short tag's.
        if (/\\@media/.test(r.selectorText) && /sr-only/.test(r.selectorText) && r.style.getPropertyValue('position') && conds.length) rows.push({ conds, sel: r.selectorText, kind: 'display', v: r.style.getPropertyValue('position') });
        if (r.cssRules && r.cssRules.length) walk(r.cssRules, conds);
      } else if (r.cssRules) walk(r.cssRules, conds); // @layer and other grouping rules
    }
  };
  for (const sheet of document.styleSheets) { try { walk(sheet.cssRules, []); } catch { /* cross-origin sheet */ } }
  return rows;
};

const measure = (sel) => [...document.querySelectorAll(sel)].map((b) => {
  const cs = getComputedStyle(b);
  // The painted label (F18b model, main 81490e7a): displayed and not sr-only (a 1px absolute clip); the ※ glyph is not a label. The sr-only full label at <=359 is not painted.
  const labels = [...b.children].filter((c) => {
    if (c.textContent.trim() === '※') return false;
    const s = getComputedStyle(c);
    const r = c.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && !(s.position === 'absolute' && r.width <= 1 && r.height <= 1);
  });
  return { shown: labels.map((c) => c.textContent).join(' ').replace(/\s+/g, ' ').trim(), fs: parseFloat(cs.fontSize), ls: parseFloat(cs.letterSpacing) || 0, lines: Math.round(b.getBoundingClientRect().height / (parseFloat(cs.lineHeight) || 1)) };
});

let browser;
let handle;
try {
  browser = await chromium.launch({ args: ['--hide-scrollbars'] });
  handle = await openMode('public', sourceFiles);
  if (handle.stale) finish(NAME, handle.stale);
  let rows = [];
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, extraHTTPHeaders: { authorization: AUTH } });
    const page = await ctx.newPage();
    for (const { route, sel } of ROUTES) {
      const tag = `${route} @${width}`;
      const res = await page.goto(`${handle.origin}${route}`, { waitUntil: 'networkidle' });
      if (!res || res.status() !== 200) { failures.push(`${tag}: HTTP ${res && res.status()}`); continue; }
      await page.evaluate(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))));
      if (!rows.length) rows = await page.evaluate(collect);
      const chips = await page.evaluate(measure, sel);
      if (!chips.length) { failures.push(`${tag}: no disclosure chip found`); continue; }
      for (const c of chips) {
        const em = expectedEm(width);
        if (em === null) { if (Math.abs(c.ls / c.fs - 0.14) > 0.005) failures.push(`${tag}: letter-spacing ${(c.ls / c.fs).toFixed(3)}em above 700px, want the default 0.14em`); }
        else if (Math.abs(c.ls - em * c.fs) > 0.03) failures.push(`${tag}: letter-spacing ${(c.ls / c.fs).toFixed(3)}em, want ${em}em`);
        if (width <= 359 ? c.shown !== SHORT : c.shown === SHORT) failures.push(`${tag}: shows "${c.shown}", want ${width <= 359 ? `the short tag "${SHORT}"` : 'the full label'}`);
      }
    }
    await ctx.close();
  }
  const ls = rows.filter((r) => r.kind === 'ls' && /\\!tracking/.test(r.sel) && [0, 0.02, 0.06].includes(parseFloat(r.v) || 0)).map((r) => ({ ...r, n: parseFloat(r.v) || 0 }));
  const toggles = rows.filter((r) => r.kind === 'display');
  if (!ls.length) failures.push('coverage: no important tracking rules found in the production CSS');
  if (!toggles.length) failures.push('coverage: no display toggles for the full label and short tag found in the production CSS');
  for (let w = 300; w <= 701.001; w += 0.05) {
    const x = Math.round(w * 100) / 100;
    const hit = ls.filter((r) => matches(r.conds, x));
    const em = expectedEm(x);
    if (x <= 700) {
      if (!hit.some((r) => Math.abs(r.n - (em ?? 0)) < 1e-6)) { failures.push(`coverage: at ${x}px no important tracking rule sets ${em}em (matching: ${hit.map((r) => r.n).join(', ') || 'none'})`); break; }
    } else if (x > 700.05 && hit.length) { failures.push(`coverage: at ${x}px a tracking step still applies (${hit.map((r) => r.n).join(', ')}), want the default`); break; }
  }
  for (let w = 300; w <= 420; w += 0.05) {
    const x = Math.round(w * 100) / 100;
    const bad = toggles.filter((r) => matches(r.conds, x) !== x < 360);
    if (bad.length) { failures.push(`coverage: at ${x}px the full-label and short-tag toggle ${bad[0].conds.join(' and ')} is ${x < 360 ? 'off' : 'on'}, want it on exactly below 360px`); break; }
  }
} catch (e) {
  failures.push(`render error: ${e && e.message ? e.message : e}`);
} finally {
  if (handle) await handle.stop();
  if (browser) await browser.close();
}

finish(NAME, failures, 'tracking is 0 / 0.02em / 0.06em / default and the short tag shows only at <=359 at the integer widths, and the production CSS covers every width on a 0.05px grid with no gap at 374-375, 359-360 or 419-420.');
