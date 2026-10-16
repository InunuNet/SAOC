// nos-critique-r3 F4 — rendered check for the R36 (F2 architect) .pc-title alignment. On
// /national-show/symposium .pc-title ("Presenters") computes the literal section-h2 role, NOT a probe
// comparison (origin/main's nos-theme.css still has the old clamp; the F2 branch changes it):
//   font-size clamp(2rem, 1.2rem + 2.667vw, 3rem): 32px at 375, 39.68px at 768, 48px at 1280;
//   line-height 1.15 (36.8px / 45.63px / 55.2px), letter-spacing -0.01em (-0.32px / -0.397px / -0.48px),
//   font-variation-settings "opsz" 48, margin 0 on all sides, Fraunces, weight 400.
// Requires a current build. Run as: node contracts/checks/nos-critique-r3/check-rendered-f4.mjs
import { CSS, finish } from './_lib.mjs';
import { AUTH, assertFreshBuild, require, startServer } from './_server.mjs';

const NAME = 'check-rendered-f4.mjs';
const failures = [];
const { chromium } = require('playwright');
const stale = assertFreshBuild([CSS]);
if (stale.length > 0) finish(NAME, stale);

const CASES = [{ w: 375, size: 32 }, { w: 768, size: 39.68 }, { w: 1280, size: 48 }];
const rows = [];
let browser;
let stop = () => {};
try {
  const srv = await startServer();
  stop = srv.stop;
  browser = await chromium.launch();
  for (const c of CASES) {
    const ctx = await browser.newContext({ viewport: { width: c.w, height: 900 }, extraHTTPHeaders: { authorization: AUTH } });
    const page = await ctx.newPage();
    const tag = `symposium .pc-title @${c.w}`;
    const res = await page.goto(`${srv.origin}/national-show/symposium`, { waitUntil: 'networkidle' });
    if (!res || res.status() !== 200) { failures.push(`${tag}: HTTP ${res && res.status()}`); await ctx.close(); continue; }
    const t = await page.evaluate(() => {
      const el = document.querySelector('.nos-presenters .pc-title');
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { size: parseFloat(cs.fontSize), lh: parseFloat(cs.lineHeight), ls: parseFloat(cs.letterSpacing), fvs: cs.fontVariationSettings, weight: cs.fontWeight, mt: cs.marginTop, mb: cs.marginBottom, ml: cs.marginLeft, mr: cs.marginRight, fam: cs.fontFamily.split(',')[0].replace(/['"]/g, '').trim() };
    });
    if (!t) { failures.push(`${tag}: not rendered`); await ctx.close(); continue; }
    rows.push(`  @${c.w}: ${t.size}px / ${t.lh.toFixed(2)}px / ${t.ls.toFixed(3)}px, ${t.fvs}, margin ${t.mt}/${t.mr}/${t.mb}/${t.ml}`);
    const near = (a, b) => Math.abs(a - b) <= 0.06;
    if (!near(t.size, c.size)) failures.push(`${tag}: font-size ${t.size}px, want ${c.size}px`);
    if (!near(t.lh, c.size * 1.15)) failures.push(`${tag}: line-height ${t.lh}px, want ${(c.size * 1.15).toFixed(2)}px (1.15)`);
    if (!near(t.ls, -0.01 * c.size)) failures.push(`${tag}: letter-spacing ${t.ls}px, want ${(-0.01 * c.size).toFixed(3)}px (-0.01em)`);
    if (t.fvs !== '"opsz" 48') failures.push(`${tag}: font-variation-settings ${t.fvs}, want "opsz" 48`);
    if (t.weight !== '400') failures.push(`${tag}: weight ${t.weight}, want 400`);
    if (!/fraunces/i.test(t.fam)) failures.push(`${tag}: family ${t.fam}, want Fraunces`);
    if ([t.mt, t.mb, t.ml, t.mr].some((m) => m !== '0px')) failures.push(`${tag}: margin ${t.mt} ${t.mr} ${t.mb} ${t.ml}, want 0 (spacing comes from .pc-sec-head/.pc-sec-top)`);
    await ctx.close();
  }
} catch (err) {
  failures.push(`${err.name}: ${err.message}`);
} finally {
  if (browser) await browser.close();
  stop();
}
finish(NAME, failures, `.pc-title is the literal R36 section-h2 role (32px at 375, 48px at 1280):\n${rows.join('\n')}`);
