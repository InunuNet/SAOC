// Served-width gate for the hub photo band (H-a, NOS Design approval). Usage: node gate-hub-served-width.mjs.
// At 768@2, 820@2 and 1023@2 the file the browser serves (img.currentSrc, decoded through a bare new Image(), naturalWidth)
// must be at least max(boxW, boxH x srcW/srcH) x DPR (NOS Design ruling for every served-width gate), with the source file's aspect read
// from a bare new Image() of the source. The tablet band is 2/1 on a 3:2 source, so it is width-driven: 1536, 1640 and 2046 device px.
// Viewports: 390@2, 390@3, 768@2, 820@2, 900@2, 1023@2, 1024@2, 1024T@2 (1024x1366), 1280@2, 2056@2.
// HB-3: the 390 phone band is 390x300 on the same source, so it is height-driven (300 x 1.5 = 450 css px): 900 at 2x and 1350 at 3x.
import { VALUES, launchChromium, newContext, withServer } from './_lib.mjs';
import { coverRequired } from './hub-verdict.mjs';

await withServer(3, 'hub served width', async (server, c) => {
  const browser = await launchChromium();
  try {
    for (const vp of VALUES.hub.band.servedWidth.viewports) {
      const context = await newContext(browser, vp);
      const page = await context.newPage();
      await page.goto(`${server.nos}${VALUES.hub.route}`, { waitUntil: 'load' });
      const sel = 'section[data-nos-hero="hub"] [data-nos-hero-media] img';
      await page.waitForFunction((s) => { const i = document.querySelector(s); return i && i.complete && i.naturalWidth > 0; }, sel, { timeout: 30000 });
      const r = await page.evaluate(async ({ s, sourcePath }) => {
        const img = document.querySelector(s);
        const probe = new Image();
        probe.src = img.currentSrc;
        await probe.decode();
        const source = new Image();
        source.src = sourcePath;
        await source.decode();
        const rect = img.getBoundingClientRect();
        return { boxW: rect.width, boxH: rect.height, aspect: source.naturalWidth / source.naturalHeight, dpr: devicePixelRatio, src: img.currentSrc, natural: probe.naturalWidth };
      }, { s: sel, sourcePath: VALUES.hub.band.servedWidth.sourcePath });
      const need = coverRequired(r.boxW, r.boxH, r.aspect, r.dpr);
      const expected = VALUES.hub.band.servedWidth.required[vp.name];
      c.check(`[${vp.name}] required ${need} matches the hand-derived ${expected} (the box is the one the CSS says)`, need === expected, `${r.boxW} x ${r.boxH}`);
      c.note(`note: [${vp.name}] served ${r.natural}px; need max(${r.boxW.toFixed(3)}, ${r.boxH.toFixed(3)} x ${r.aspect.toFixed(4)}) x ${r.dpr} = ${need} ${r.src}`);
      c.check(`[${vp.name}] served width ${r.natural} >= ${need} device px`, r.natural >= need, r.src);
      await context.close();
    }
  } finally { await browser.close(); }
});
