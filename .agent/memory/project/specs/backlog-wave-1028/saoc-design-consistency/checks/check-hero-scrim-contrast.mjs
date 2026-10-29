// F1c A15 (NOS Design HM-5 ruling, final): the eased scrim must still carry the copy. With the copy hidden, every text box of the photographic heroes (/about, /judging, /sponsors) is sampled from a screenshot of the
// bare hero (photograph + scrim) and the WORST pixel's contrast against the text colour (blended by its alpha) must be >= 4.5:1, or >= 3:1 for large text (a text box >= 30px tall). Widths 768/1024/1280/1440/2056
// (the copy scrim does not exist below 768, where the copy sits on solid sage). Text inside an element with its own fill (alpha > .5: a button, the eyebrow pill) is measured against that fill, not the photograph, so it is skipped here.
import { withSite, openPage, check, finish, RGBA_FN } from './lib.mjs';
import { PHOTO_ROUTES } from './lib-hero-bands.mjs';
const NORMAL = 4.5; const LARGE = 3; const LARGE_PX = 30;
const BOXES = `() => { const rgba = ${RGBA_FN}; const hero = document.querySelector('[data-page-hero]'); const copy = hero.querySelector('[data-page-hero-copy]'); const out = [];
  const w = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
  for (let t; (t = w.nextNode());) { if (!t.data.trim()) continue; let own = false; for (let e = t.parentElement; e && e !== copy.parentElement; e = e.parentElement) if (rgba(getComputedStyle(e).backgroundColor)[3] > 0.5) own = true; if (own) continue; const r = document.createRange(); r.selectNodeContents(t); const c = rgba(getComputedStyle(t.parentElement).color);
    for (const b of r.getClientRects()) if (b.width > 1 && b.height > 1) out.push({ x: b.left, y: b.top + scrollY, w: b.width, h: b.height, c, t: t.data.trim().slice(0, 24) }); }
  copy.style.visibility = 'hidden'; const hb = hero.getBoundingClientRect(); return { boxes: out, hero: { x: hb.left, y: hb.top + scrollY, w: hb.width, h: hb.height } }; }`;
const SAMPLE = `async ({ b64, boxes, ox, oy }) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const k = document.createElement('canvas'); k.width = img.width; k.height = img.height;
  const x = k.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0); const d = x.getImageData(0, 0, k.width, k.height).data;
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; const L = (r, g, b) => 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  return boxes.map((b) => { let worst = Infinity; const x0 = Math.max(0, Math.floor(b.x - ox)), x1 = Math.min(k.width, Math.ceil(b.x + b.w - ox)), y0 = Math.max(0, Math.floor(b.y - oy)), y1 = Math.min(k.height, Math.ceil(b.y + b.h - oy));
    for (let py = y0; py < y1; py++) for (let px = x0; px < x1; px++) { const i = (py * k.width + px) * 4; const a = b.c[3]; const fr = b.c[0] * a + d[i] * (1 - a), fg = b.c[1] * a + d[i + 1] * (1 - a), fb = b.c[2] * a + d[i + 2] * (1 - a);
      const l1 = L(fr, fg, fb), l2 = L(d[i], d[i + 1], d[i + 2]); const c = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); if (c < worst) worst = c; }
    return { t: b.t, h: b.h, worst }; }); }`;
await withSite(async ({ base, browser, ctxOpts }) => {
  for (const width of [768, 1024, 1280, 1440, 2056]) for (const path of PHOTO_ROUTES) {
    const { page, ctx } = await openPage(browser, ctxOpts, base, path, width, 1000); const w = `${path}@${width}`;
    const { boxes, hero } = await page.evaluate(`(${BOXES})()`); check(boxes.length > 0, `${w}: no hero text boxes found, nothing proven`);
    await page.evaluate(() => { const i = document.querySelector('[data-page-hero] img'); if (i && !i.complete) return new Promise((r) => i.addEventListener('load', r, { once: true })); }); await page.waitForTimeout(300);
    const png = await page.screenshot({ clip: { x: hero.x, y: hero.y, width: hero.w, height: hero.h }, animations: 'disabled', fullPage: true });
    const res = await page.evaluate(`(${SAMPLE})`.replace(/$/, `(${JSON.stringify({ b64: png.toString('base64'), boxes, ox: hero.x, oy: hero.y })})`));
    for (const r of res) { const want = r.h >= LARGE_PX ? LARGE : NORMAL; check(r.worst >= want, `${w}: "${r.t}" (${r.h.toFixed(0)}px tall) worst-pixel contrast ${r.worst.toFixed(2)}:1, want >=${want}:1`); }
    await ctx.close();
  }
});
finish('hero-scrim-contrast');
