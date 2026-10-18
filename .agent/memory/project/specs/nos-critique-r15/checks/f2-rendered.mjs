// nos-critique-r15 f2 rendered (PUBLIC production build, next start 3010-3019 minus 3013). QA input, hash-locked.
// F2: Tab through the SAOC header on goldens/f2-edits.json route at 1280 and 390, at rest and scrolled (the header gains its shadow and
// border when scrolled; its background stays parchment). For every focus stop inside <header>:
//   R1  it shows a focus ring: :focus-visible matches and its box-shadow carries a ring of >=2px spread.
//   R2  the ring colour (computed box-shadow colour, composited over the header background on a canvas) reaches minRatio (3:1, WCAG 1.4.11)
//       against the header background AND against its own ring-offset colour.
//   R3  the ring as painted reaches minRatio: the screenshot pixel inside the ring's outer band (left side, vertical middle) vs the
//       header background pixel 5px further out.
//   R4  at least minStops focus stops per width are reached in the header, including (at 1280) a MegaMenu trigger.
import { finish, goldenJson } from './_lib.mjs';
import { require, serve } from './_server.mjs';
import { IN_PAGE_PIXELS, IN_PAGE_RESOLVE, ratio, round2 } from './_color.mjs';

const { chromium } = require('playwright');
const NAME = 'f2-rendered.mjs';
const G = goldenJson('f2-edits.json');
const WIDTHS = [1280, 390];
const failures = [];
let stops = 0;

const srv = await serve('public');
if (srv.failures) finish(NAME, srv.failures);
const browser = await chromium.launch();
try {
  for (const width of WIDTHS) {
    for (const state of ['rest', 'scrolled']) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(`${srv.origin}${G.route}`, { waitUntil: 'networkidle' });
      if (state === 'scrolled') { await page.evaluate(() => scrollTo(0, 600)); await page.waitForTimeout(400); }
      await page.evaluate(() => { document.activeElement?.blur(); });
      const check = async (s) => {
        stops += 1;
        const key = `${width} ${state} ${s.id}`;
        if (!s.fv) { failures.push(`${key}: not :focus-visible after Tab (R1)`); return; }
        // box-shadow list: "<color> 0px 0px 0px <spread>, ..." -> [{ color, spread }]
        const layers = [...s.shadow.matchAll(/((?:rgba?|color|oklab|oklch|lab|lch|hsla?)\([^)]*\)|#[0-9a-f]{3,8})\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px/gi)].map((m) => ({ color: m[1], spread: Number(m[5]) }));
        const ring = layers.filter((l) => l.spread >= 2).sort((a, b) => b.spread - a.spread)[0];
        const offset = layers.filter((l) => ring && l.spread < ring.spread).sort((a, b) => b.spread - a.spread)[0];
        if (!ring || (offset && ring.spread - offset.spread < 2)) { failures.push(`${key}: no >=2px focus ring in box-shadow "${s.shadow}" (R1)`); return; }
        const bg = await page.evaluate(`(${IN_PAGE_RESOLVE})(${JSON.stringify(s.headerBg)}, [255,255,255])`);
        const ringRgb = await page.evaluate(`(${IN_PAGE_RESOLVE})(${JSON.stringify(ring.color)}, ${JSON.stringify(bg)})`);
        const offRgb = offset ? await page.evaluate(`(${IN_PAGE_RESOLVE})(${JSON.stringify(offset.color)}, ${JSON.stringify(bg)})`) : bg;
        const rBg = ratio(ringRgb, bg);
        const rOff = ratio(ringRgb, offRgb);
        if (rBg < G.minRatio) failures.push(`${key}: ring rgb(${ringRgb}) vs header bg rgb(${bg}) = ${round2(rBg)}:1, want >= ${G.minRatio} (R2)`);
        if (rOff < G.minRatio) failures.push(`${key}: ring rgb(${ringRgb}) vs its offset rgb(${offRgb}) = ${round2(rOff)}:1, want >= ${G.minRatio} (R2)`);
        // R3: painted pixels, left edge, vertical middle. The ring's outer 2px band starts at floor(x) - spread: sample its inner column
        // (floor(x) - spread + 1) and the header 5px further out, from one 16x3 capture in document coordinates (Playwright's clip).
        const y = Math.round(s.box.y + s.box.h / 2);
        const xRing = Math.floor(s.box.x) - ring.spread + 1;
        const x0 = xRing - 8;
        if (x0 >= 0) {
          const png = await page.screenshot({ clip: { x: x0, y: y - 1, width: 16, height: 3 } });
          const { w, px } = await page.evaluate(`(${IN_PAGE_PIXELS})(${JSON.stringify(png.toString('base64'))})`);
          const ringPx = px[w + 8];
          const outPx = px[w + 3];
          const painted = ratio(ringPx, outPx);
          if (painted < G.minRatio) failures.push(`${key}: painted ring rgb(${ringPx}) vs header rgb(${outPx}) = ${round2(painted)}:1, want >= ${G.minRatio} (R3)`);
        }
      };
      const seen = [];
      let entered = false;
      for (let k = 0; k < 60; k++) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(60);
        const info = await page.evaluate(() => {
          const e = document.activeElement;
          const header = document.querySelector('header');
          if (!e || !header || !header.contains(e)) return null;
          const r = e.getBoundingClientRect();
          const s = getComputedStyle(e);
          return {
            id: `${e.tagName.toLowerCase()} "${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 30)}"`,
            fv: e.matches(':focus-visible'), mega: e.matches('button[aria-haspopup]'), shadow: s.boxShadow,
            box: { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }, headerBg: getComputedStyle(header).backgroundColor,
          };
        });
        if (!info) { if (entered) break; continue; }
        entered = true;
        if (seen.some((x) => x.id === info.id)) break;
        seen.push(info);
        await check(info); // measured while focused, before a later Tab can scroll the page
      }
      if (seen.length < G.minStops[width]) failures.push(`${width} ${state}: ${seen.length} focus stop(s) in the header, want >= ${G.minStops[width]} (R4)`);
      if (width >= 1240 && !seen.some((x) => x.mega)) failures.push(`${width} ${state}: no MegaMenu trigger reached in the header (R4)`);
      await ctx.close();
    }
  }
} catch (e) {
  failures.push(`render error: ${e && e.message ? e.message : e}`);
} finally {
  await browser.close();
  await srv.stop();
}
finish(NAME, failures, `${stops} header focus stops at ${WIDTHS.join('/')} (rest and scrolled) show a ring >= ${G.minRatio}:1 against the header and its offset, computed and painted.`);
