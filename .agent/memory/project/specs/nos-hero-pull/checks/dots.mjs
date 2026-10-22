// rPL guard (Codi 2026-10-22, WCAG 1.4.11; QA input, hash-locked): every pager dot's bar against the hero rows just above and below it,
// on every slide at 1280 (DPR 1) and 390 (DPR 2), from one public build. The rHB pull (BASE) is injected for the comparison run.
// PASS when the rPL minimum is >= goldens/pull.json dots.minRatio and no more than dots.maxDropFromBase under the BASE minimum.
// Uses the r45 spec's public-build server (committed on main). Run from the checkout with NODE_OPTIONS='--require ../r19-chrome/use-chrome.cjs'.
import { serve, require } from '../../nos-ticket-day-stub/checks/_server.mjs';
import { finish, goldenJson } from './_lib.mjs';
const G = goldenJson('pull.json');
const { chromium } = require('playwright');
const OLD = `[data-hero-scrim='bone']{background-image:linear-gradient(to top,var(--parchment) 0,rgb(244 243 236/.82) 16px,rgb(244 243 236/.5) 36px,rgb(244 243 236/.2) 56px,rgb(244 243 236/.1451) 60px,rgb(244 243 236/.102) 64px,rgb(244 243 236/.0667) 68px,rgb(244 243 236/.0353) 72px,rgb(244 243 236/.0157) 76px,rgb(244 243 236/.0039) 80px,rgb(244 243 236/0) 84px)!important}`;
const srv = await serve('public');
if (srv.failures) { console.error(srv.failures.join('\n')); process.exit(1); }
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const [h, l] = [lum(a), lum(b)].sort((x, y) => y - x); return (h + 0.05) / (l + 0.05); };
let worst = { base: 99, rpl: 99 };
const measured = { base: 0, rpl: 0 };
const missing = [];
try {
  for (const [width, dpr] of [[1280, 1], [390, 2]]) for (const v of ['base', 'rpl']) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: dpr, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(`${srv.origin}/`, { waitUntil: 'networkidle' });
    if (v === 'base') await page.addStyleTag({ content: OLD });
    const dots = page.locator('[aria-label="Carousel navigation"] button');
    const n = await dots.count();
    if (n < 3) missing.push(`${width} ${v}: ${n} pager dots, expected at least 3`);
    for (let i = 0; i < n; i++) {
      await dots.nth(i).click(); await page.waitForTimeout(1500); await page.mouse.move(0, 0);
      // measure every dot's visible bar against the hero pixels just above and below it
      for (let j = 0; j < n; j++) {
        const bar = await dots.nth(j).evaluate((b) => { const el = b.querySelector('span') ?? b; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
        const pad = 6;
        const clip = { x: Math.max(0, bar.x - 2), y: Math.max(0, bar.y - pad - 2), width: bar.w + 4, height: bar.h + 2 * pad + 4 };
        const png = (await page.screenshot({ clip })).toString('base64');
        const px = await page.evaluate(async ({ png, pad, dpr }) => {
          const img = new Image(); img.src = `data:image/png;base64,${png}`; await img.decode();
          const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
          const d = x.getImageData(0, 0, c.width, c.height).data; const W = c.width, H = c.height;
          const at = (yy) => { let s = [0, 0, 0]; let k = 0; for (let xx = Math.round(2 * dpr); xx < W - 2 * dpr; xx++) { const o = (yy * W + xx) * 4; s[0] += d[o]; s[1] += d[o + 1]; s[2] += d[o + 2]; k++; } return s.map((q) => q / k); };
          return { above: at(0), below: at(H - 1), mid: at(Math.floor(H / 2)) };
        }, { png, pad, dpr });
        const r = Math.min(ratio(px.mid, px.above), ratio(px.mid, px.below));
        worst[v] = Math.min(worst[v], r);
        measured[v] += 1;

      }
    }
    await ctx.close();
  }
} finally { await browser.close(); await srv.stop(); }
const failures = [...missing];
for (const v of ['base', 'rpl']) if (measured[v] < 18) failures.push(`${v}: only ${measured[v]} dot measurements (expected 3 slides x 3 dots x 2 widths at least)`);
if (worst.rpl < G.dots.minRatio) failures.push(`pager dot contrast ${worst.rpl.toFixed(2)} < ${G.dots.minRatio}:1`);
if (worst.base - worst.rpl > G.dots.maxDropFromBase) failures.push(`pager dot contrast fell from ${worst.base.toFixed(2)} (BASE pull) to ${worst.rpl.toFixed(2)}`);
finish('dots.mjs', failures, `pager dots ${worst.rpl.toFixed(2)}:1 worst (BASE pull ${worst.base.toFixed(2)}:1), all slides, 1280 and 390.`);
