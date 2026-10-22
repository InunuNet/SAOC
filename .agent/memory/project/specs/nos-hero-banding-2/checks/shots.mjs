// rHB2 shot set for Codi (not an assertion; the eye check in Canary stays Codi's). PREVIEW build of the checkout (Brad's beta: 4 slides,
// pager, "Not confirmed by SAOC"), copy visible, reduced motion, every slide made active by its dot, at 1280@1, 2056@2, 2560@1 and
// 390@3: the bottom `ABOVE` CSS px of the hero plus `NEXT` px of the next section. Writes .tmp/sandbox/hb2-out/<label>-<w>x<dpr>-s<k>.png
// (cwd-relative). --label <name> (default "checkout"); --golden injects goldens/pull.css, --base goldens/base-pull.css (c6702259), so a
// before/after pair can be shot from one build.
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { golden } from './_lib.mjs';
import { authorize, launchOptions, require, serve } from './_server.mjs';

const { chromium } = require('playwright');
const VIEWPORTS = [[1280, 1], [2056, 2], [2560, 1], [390, 3]];
const ABOVE = 360;
const NEXT = 80;
const HERO = 'section[aria-roledescription="carousel"]';
const SLIDES = `${HERO} > [aria-roledescription="slide"]`;
const DOTS = `${HERO} [aria-label="Carousel navigation"] button`;
const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const inject = process.argv.includes('--golden') ? golden('pull.css') : process.argv.includes('--base') ? golden('base-pull.css') : null;
const label = arg('--label') ?? (process.argv.includes('--golden') ? 'golden' : process.argv.includes('--base') ? 'base' : 'checkout');
const OUT = path.resolve('.tmp/sandbox/hb2-out');
mkdirSync(OUT, { recursive: true });

const srv = await serve('preview');
if (srv.failures) { console.error(srv.failures.join('\n')); process.exit(1); }
const browser = await chromium.launch(launchOptions());
let written = 0;
try {
  for (const [width, dpr] of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width, height: 1600 }, deviceScaleFactor: dpr, reducedMotion: 'reduce' });
    await authorize(ctx, srv);
    const page = await ctx.newPage();
    page.setDefaultTimeout(60_000);
    await page.goto(`${srv.origin}/`, { waitUntil: 'networkidle' });
    await page.evaluate(async () => { await document.fonts.ready; });
    if (inject) await page.addStyleTag({ content: inject });
    const n = await page.locator(DOTS).count();
    for (let i = 0; i < n; i++) {
      await page.locator(DOTS).nth(i).click();
      await page.mouse.move(0, 0);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForFunction(({ SLIDES, i }) => {
        const g = document.querySelectorAll(SLIDES)[i]; const img = g && g.querySelector('img');
        return g && !g.hasAttribute('aria-hidden') && img && img.complete && img.naturalWidth > 0 && getComputedStyle(g).opacity === '1';
      }, { SLIDES, i });
      const box = await page.evaluate((HERO) => { const r = document.querySelector(HERO).getBoundingClientRect(); return { y: r.top + scrollY, w: r.width, h: r.height }; }, HERO);
      const top = Math.max(box.y, box.y + box.h - ABOVE);
      const file = path.join(OUT, `${label}-${width}x${dpr}-s${i + 1}.png`);
      await page.screenshot({ path: file, clip: { x: 0, y: top, width: box.w, height: box.y + box.h - top + NEXT }, animations: 'disabled', caret: 'hide' });
      written += 1;
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  await srv.stop();
}
console.log(`${written} shots (${label}) in ${OUT}`);
