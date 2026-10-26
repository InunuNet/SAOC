// Per-glyph contrast gate. Usage: node gate-contrast.mjs <inner|sponsors|home>.
// Every glyph's box is sampled in a screenshot of the hero with all text made transparent (so the pill fill, the scrim and the photograph
// are what the glyph really sits on); the worst case in each box is the 0.5th-percentile contrast, and the worst glyph per kind is gated:
// lede >= 4.5 AND painted in solid ivory (alpha 1 through every ancestor), eyebrow >= 3, h1 >= 3, call-to-action text >= 4.5.
// `sponsors` is the dedicated /sponsors lede gate (logged as a P1 a11y fix). `home` runs both carousel slides (HS-1).
import { writeFileSync } from 'node:fs';
import { GOLDEN, SHOT_DIR, T, contrastByKind, docRect, freeze, glyphBoxes, heroBackgroundShot, heroTextShot, launchChromium, newContext, openHeroRoute, pixelPage, withServer } from './_lib.mjs';

const mode = process.argv[2];
if (!['inner', 'sponsors', 'home'].includes(mode)) { console.error('usage: gate-contrast.mjs <inner|sponsors|home>'); process.exit(2); }
const LIMITS = { lede: T.ledeContrastMin, eyebrow: T.eyebrowContrastMin, h1: T.h1ContrastMin, cta: T.ctaTextContrastMin };

async function gateHero(page, px, c, tag, heroSel) {
  await freeze(page);
  const glyphs = await glyphBoxes(page, heroSel);
  const { b64, clip } = await heroBackgroundShot(page, heroSel);
  const ink = await heroTextShot(page, heroSel);
  const res = await contrastByKind(px, b64, ink, clip, glyphs);
  c.check(`${tag} the hero has an h1`, Boolean(res.h1));
  c.note(`note: ${tag} worst contrast ${Object.entries(res).map(([k, r]) => `${k} ${r.worst.toFixed(2)}`).join(', ')}`);
  for (const [kind, min] of Object.entries(LIMITS)) {
    const r = res[kind];
    if (!r) continue;
    c.check(`${tag} ${kind} worst-glyph contrast ${r.worst.toFixed(2)} >= ${min} (glyph "${r.ch}" at ${r.at}, ${r.count} glyphs)`, r.worst >= min);
    if (kind === 'lede') c.check(`${tag} lede is solid ivory: minimum alpha ${r.minAlpha} === 1`, r.minAlpha === 1);
  }
  return res;
}

await withServer(mode === 'home' ? 5 : mode === 'sponsors' ? 4 : 3, `contrast (${mode})`, async (server, c) => {
  const browser = await launchChromium();
  const px = await pixelPage(browser);
  try {
    for (const vp of GOLDEN.viewports.contrast) {
      const context = await newContext(browser, { ...vp, dsf: 1 });
      const page = await context.newPage();
      if (mode === 'home') {
        await page.goto(`${server.saoc}/`, { waitUntil: 'load' });
        for (let i = 0; i < GOLDEN.home.slides.length; i += 1) {
          const slide = GOLDEN.home.slides[i];
          const pause = page.getByRole('button', { name: 'Pause' });
          if (await pause.count()) await pause.click();
          const dot = page.getByRole('button', { name: new RegExp(`^Show slide ${i + 1}`) });
          if (await dot.count()) await dot.click();
          await page.waitForTimeout(1700);
          await page.evaluate(() => document.fonts.ready);
          await gateHero(page, px, c, `[saoc ${vp.name} / slide ${slide.key}]`, 'section[data-home-hero]');
          const clip = await docRect(page, 'section[data-home-hero]');
          writeFileSync(`${SHOT_DIR}/home-${slide.key}-${vp.name}.png`, await page.screenshot({ fullPage: true, clip: { x: clip.x, y: clip.y, width: clip.w, height: clip.h } }));
        }
      } else {
        const routes = mode === 'sponsors' ? GOLDEN.heroRoutes.filter((r) => r.lede) : GOLDEN.heroRoutes;
        for (const route of routes) {
          const tag = `[saoc ${vp.name} ${route.path}]`;
          const path = await openHeroRoute(page, server, route, c, tag);
          if (!path) continue;
          const res = await gateHero(page, px, c, tag, 'section[data-page-hero]');
          if (mode === 'sponsors') c.check(`${tag} /sponsors lede present and measured`, Boolean(res.lede));
        }
      }
      await context.close();
    }
  } finally { await px.close(); await browser.close(); }
});
