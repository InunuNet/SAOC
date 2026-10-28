// HM-5 (NOS Design 2026-10-26): the copy scrim's ramp is eased, not linear. The computed gradient of [data-hero-scrim="copy"] on every
// photographic hero must be 90deg sage with the ruled stops (alpha, position%) from goldens/f2.json hm5.stops, and fully transparent
// before the first stop. Measured from the browser's computed background-image, so a linear 44%-52% ramp (the f1 build) fails.
import { F2, GOLDEN, launchChromium, newContext, openHeroRoute, withServer } from './f2-lib.mjs';

const H = F2.hm5;
const HERO = 'section[data-page-hero]';

function parseStops(css, heroW) {
  if (!/^linear-gradient\(\s*(90deg|to right)/.test(css)) return { error: `not a 90deg gradient: ${css.slice(0, 80)}` };
  const stops = [];
  const re = /(rgba?\(([^)]*)\)|transparent)\s+(-?[\d.]+)(%|px)/g;
  for (let m = re.exec(css); m; m = re.exec(css)) {
    const parts = m[1] === 'transparent' ? [0, 0, 0, 0] : m[2].split(',').map((v) => parseFloat(v));
    const alpha = parts.length > 3 ? parts[3] : 1;
    const pos = m[4] === '%' ? parseFloat(m[3]) : (parseFloat(m[3]) / heroW) * 100;
    stops.push({ alpha, pos, rgb: parts.slice(0, 3) });
  }
  return { stops };
}

await withServer(8, 'HM-5 scrim stops (saoc)', async (server, c) => {
  const browser = await launchChromium();
  try {
    for (const vp of H.viewports) {
      const context = await newContext(browser, vp);
      const page = await context.newPage();
      for (const route of GOLDEN.heroRoutes.filter((r) => r.variant !== 'type')) {
        const tag = `[saoc ${vp.name} ${route.path}]`;
        const path = await openHeroRoute(page, server, route, c, tag);
        if (!path) continue;
        const css = await page.evaluate((h) => { const s = document.querySelector(`${h} [data-hero-scrim="copy"]`); return s ? getComputedStyle(s).backgroundImage : ''; }, HERO);
        const heroW = await page.evaluate((h) => document.querySelector(h).getBoundingClientRect().width, HERO);
        const parsed = parseStops(css, heroW);
        if (parsed.error) { c.check(`${tag} scrim is the ruled gradient`, false, parsed.error); continue; }
        // Entries at or before the first ruled stop must be fully transparent (the lead-in); the rest must equal the ruled list.
        const first = H.stops[0][1];
        const lead = parsed.stops.filter((s) => s.pos < first - H.positionTolerancePct);
        c.check(`${tag} transparent before ${first}%`, lead.every((s) => s.alpha <= H.alphaTolerance), JSON.stringify(lead));
        const body = parsed.stops.filter((s) => s.pos >= first - H.positionTolerancePct);
        c.check(`${tag} ${H.stops.length} eased stops from ${first}% (found ${body.length}: ${body.map((s) => `${s.alpha}@${s.pos.toFixed(1)}`).join(' ')})`, body.length === H.stops.length);
        H.stops.forEach(([a, p], i) => {
          const s = body[i];
          c.check(`${tag} stop ${i + 1} is ${a}@${p}%`, Boolean(s) && Math.abs(s.alpha - a) <= H.alphaTolerance && Math.abs(s.pos - p) <= H.positionTolerancePct, s ? `${s.alpha}@${s.pos.toFixed(2)}` : 'missing');
        });
        c.check(`${tag} sage rgb(${H.sage}) on every non-zero stop`, body.every((s) => s.alpha === 0 || s.rgb.every((v, k) => v === H.sage[k])));
      }
      await context.close();
    }
  } finally { await browser.close(); }
});
