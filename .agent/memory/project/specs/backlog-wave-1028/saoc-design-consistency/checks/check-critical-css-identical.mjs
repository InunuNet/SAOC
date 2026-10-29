// F1e lever 3 (OPTIONAL): critical CSS (Next experimental.inlineCss or equivalent) is allowed ONLY if the first viewport is pixel-identical before and after, at 390, 1440 and 2056
// on the ten routes, with no flash of unstyled content on a throttled load. If next.config.ts does not enable inlineCss this check reports SKIP and passes, so the feature ships
// without critical CSS. When it is enabled, set DC_BASE_URL_BEFORE (a production build without it) and DC_BASE_URL_AFTER (with it): ANY differing pixel fails. FOUC: with stylesheet
// responses delayed 1500 ms the h1's computed font-size and colour at first paint must already equal the final values.
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { check, finish, TEN_ROUTES } from './lib.mjs';
const cfg = readFileSync('next.config.ts', 'utf8');
if (!/inlineCss\s*:\s*true/.test(cfg)) { console.log('SKIP: inlineCss is not enabled in next.config.ts (critical CSS not in use)'); process.exit(0); }
const before = process.env.DC_BASE_URL_BEFORE; const after = process.env.DC_BASE_URL_AFTER;
if (!before || !after) { console.error('FAIL: inlineCss is enabled but DC_BASE_URL_BEFORE / DC_BASE_URL_AFTER are not set'); process.exit(1); }
const shot = async (browser, base, path, width) => { const ctx = await browser.newContext({ viewport: { width, height: 900 } }); const page = await ctx.newPage(); await page.goto(base + path, { waitUntil: 'networkidle', timeout: 120000 }); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(800);
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' }); const png = await page.screenshot({ animations: 'disabled' }); await ctx.close(); return PNG.sync.read(png); };
const browser = await chromium.launch();
try {
  for (const width of [390, 1440, 2056]) for (const path of TEN_ROUTES) {
    const a = await shot(browser, before, path, width); const b = await shot(browser, after, path, width);
    if (a.width !== b.width || a.height !== b.height) { check(false, `${path}@${width}: viewport sizes differ`); continue; }
    let diff = 0; for (let i = 0; i < a.data.length; i += 4) if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2] || a.data[i + 3] !== b.data[i + 3]) diff++;
    check(diff === 0, `${path}@${width}: ${diff} pixels differ between before and after critical CSS`);
  }
  for (const path of ['/about']) { const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } }); const page = await ctx.newPage(); await page.route(/\.css(\?|$)/, async (r) => { await new Promise((x) => setTimeout(x, 1500)); await r.continue(); });
    await page.goto(after + path, { waitUntil: 'commit' }); await page.waitForSelector('h1', { state: 'attached' }); const early = await page.evaluate(() => { const c = getComputedStyle(document.querySelector('h1')); return c.fontSize + '|' + c.color; });
    await page.waitForLoadState('load'); await page.waitForTimeout(1500); const late = await page.evaluate(() => { const c = getComputedStyle(document.querySelector('h1')); return c.fontSize + '|' + c.color; });
    check(early === late, `${path}: FOUC, h1 is ${early} at first paint and ${late} after the stylesheets load`); await ctx.close(); }
} finally { await browser.close(); }
finish('critical-css-identical');
