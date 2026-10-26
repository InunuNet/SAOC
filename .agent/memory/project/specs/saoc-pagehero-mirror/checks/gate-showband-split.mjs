// ShowBand 42/58 split on the event page (NOS Design via the #92 sign-off). Above 1024 the National Show event page
// (/events/[slug]) gives the photo column 42% of the band and the copy column at least 420px; at 1440 the h2 and the dates take at
// most 2 lines each. The home ShowBand and /events keep the 1fr/1.1fr split (47.6% photo): the ruling names the event page only.
import { GOLDEN, launchChromium, newContext, discoverPath, withServer } from './_lib.mjs';

const SPLIT = GOLDEN.showBandEventSplit;
const BAND = '[data-home-section="show-band"]';

async function metrics(page) {
  return page.evaluate((sel) => {
    const band = document.querySelector(sel);
    if (!band) return null;
    const lines = (el) => { const cs = getComputedStyle(el); const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2; return Math.round(el.getBoundingClientRect().height / lh); };
    const photo = band.querySelector('[data-show-band-image]').getBoundingClientRect();
    const content = band.querySelector('[data-show-band-content]').getBoundingClientRect();
    const img = band.querySelector('[data-show-band-image] img');
    const dates = [...band.querySelectorAll('[data-show-band-facts] dt')].find((dt) => /date/i.test(dt.textContent ?? ''))?.nextElementSibling;
    return { img: img ? { box: img.getBoundingClientRect().width, boxH: img.getBoundingClientRect().height, src: img.currentSrc } : null, bandW: band.getBoundingClientRect().width, photoW: photo.width, photoH: photo.height, contentW: content.width, h2Lines: lines(band.querySelector('h2')), datesLines: dates ? lines(dates) : null };
  }, BAND);
}

await withServer(5, 'showband-split (saoc)', async (server, c) => {
  const browser = await launchChromium();
  try {
    for (const vp of SPLIT.viewports) {
      const context = await newContext(browser, vp);
      const page = await context.newPage();
      const tag = `[saoc ${vp.name} /events/[slug] ShowBand]`;
      const path = await discoverPath(page, server.saoc, SPLIT.discover.from, SPLIT.discover.hrefPrefix);
      if (!path) { c.check(`${tag} a link under ${SPLIT.discover.hrefPrefix} exists to probe`, false); await context.close(); continue; }
      await page.goto(`${server.saoc}${path}`, { waitUntil: 'load' });
      const m = await metrics(page);
      if (!m) { c.note(`NOT PROBED (stated reason): ${tag} ${path} has no ShowBand: ${SPLIT.conditional}`); await context.close(); continue; }
      c.check(`${tag} photo column is ${SPLIT.photoShare * 100}% of the band (${(m.photoW / m.bandW * 100).toFixed(1)}%)`, Math.abs(m.photoW / m.bandW - SPLIT.photoShare) <= 0.005);
      c.check(`${tag} copy column ${Math.round(m.contentW)}px >= ${SPLIT.minCopyCss}px`, m.contentW >= SPLIT.minCopyCss);
      if (m.img) {
        const probe = await page.evaluate(async (src) => { const i = new Image(); i.src = src; await i.decode(); return { w: i.naturalWidth, h: i.naturalHeight }; }, m.img.src);
        const need = Math.ceil(Math.max(m.img.box, (m.img.boxH * probe.w) / probe.h) * vp.dsf - 0.5);
        c.check(`${tag} served width ${probe.w} >= ${need} device px (cover formula, box ${Math.round(m.img.box)}x${Math.round(m.img.boxH)} css, file ${probe.w}x${probe.h})`, probe.w >= need, `${m.img.src}${probe.w < need ? ` - RULING NEEDED (viewport ${vp.name}, box ${Math.round(m.img.box)}x${Math.round(m.img.boxH)}, required ${need}), not a clamp` : ""}`);
      }
      if (vp.width === SPLIT.linesAt) {
        c.check(`${tag} h2 takes ${m.h2Lines} lines (<= ${SPLIT.maxLines})`, m.h2Lines <= SPLIT.maxLines);
        c.check(`${tag} dates take ${m.datesLines} lines (<= ${SPLIT.maxLines})`, m.datesLines !== null && m.datesLines <= SPLIT.maxLines);
      }
      await context.close();
    }
    const context = await newContext(browser, SPLIT.viewports.find((v) => v.width === SPLIT.linesAt));
    const page = await context.newPage();
    for (const p of ['/', '/events']) {
      await page.goto(`${server.saoc}${p}`, { waitUntil: 'load' });
      const m = await metrics(page);
      if (!m) { c.check(`[saoc ${SPLIT.linesAt} ${p}] ShowBand present to confirm it keeps its split`, false); continue; }
      c.check(`[saoc ${SPLIT.linesAt} ${p}] ShowBand keeps the 1fr/1.1fr split, photo ${(m.photoW / m.bandW * 100).toFixed(1)}% (not 42%)`, Math.abs(m.photoW / m.bandW - 1 / 2.1) <= 0.005);
    }
    await context.close();
  } finally { await browser.close(); }
});
