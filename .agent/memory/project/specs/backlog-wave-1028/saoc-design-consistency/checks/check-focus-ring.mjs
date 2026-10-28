// F1a: one focus ring across hero CTA, Menu, Join and a footer link. Geometry equal to the existing hero CTA ring
// (outline 2px solid, offset 3px) and the settled ring colour reaches 3:1 against the PIXELS painted just outside it (photograph, scrim and
// panels included): a band 2-6px outside the element box (the 2px ring at a 3px offset paints 3-5px out) is screenshotted with the outline hidden and the WORST-case contrast is used.
import { withSite, openPage, check, finish, RGBA_FN, blend, ratio } from './lib.mjs';
// Settled values only: transition-colors animates outline-color, so a read right after focus() sees the START colour. Wait for animations, then a 300ms floor.
const PROBE = `async (sel) => { const el = document.querySelector(sel); if (!el) return null; el.focus();
  await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))); await new Promise((r) => setTimeout(r, 300)); const c = getComputedStyle(el);
  const rgba = ${RGBA_FN}; let ground = [255,255,255]; const chain = []; for (let n = el.parentElement; n; n = n.parentElement) chain.push(n); // PARENT chain only: the ring is offset and paints outside the element, so its own fill is not its ground
  for (const n of chain.reverse()) { const b = rgba(getComputedStyle(n).backgroundColor); if (b[3] > 0) ground = b[3] === 1 ? b.slice(0,3) : [b[0]*b[3]+ground[0]*(1-b[3]), b[1]*b[3]+ground[1]*(1-b[3]), b[2]*b[3]+ground[2]*(1-b[3])]; }
  const bb = el.getBoundingClientRect(); return { w: c.outlineWidth, s: c.outlineStyle, o: c.outlineOffset, ring: rgba(c.outlineColor), ground, box: { x: bb.left, y: bb.top, w: bb.width, h: bb.height } }; }`;
// Worst-case contrast of the ring against a band of real pixels 2-6px outside the element box (ring footprint is 3-5px: offset 3 + width 2), outline hidden. Runs in the page (canvas decode).
const BAND_NEAR = 2; const BAND_FAR = 6; const CLIP_MARGIN = 8; const RING_REACH = 5; // offset 3 + width 2
const SAMPLE = `async ({ b64, ox, oy, w, h, ring }) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
  const k = document.createElement('canvas'); k.width = img.width; k.height = img.height; const x = k.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, k.width, k.height).data; const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const L = (r, g, b) => 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); let worst = Infinity, n = 0;
  for (let py = 0; py < k.height; py++) for (let px = 0; px < k.width; px++) {
    const dx = Math.max(ox - px, 0, px - (ox + w)), dy = Math.max(oy - py, 0, py - (oy + h)); const dist = Math.hypot(dx, dy);
    if (dist < ${BAND_NEAR} || dist > ${BAND_FAR}) continue; const i = (py * k.width + px) * 4; const a = ring[3];
    const rr = ring[0] * a + d[i] * (1 - a), rg = ring[1] * a + d[i + 1] * (1 - a), rb = ring[2] * a + d[i + 2] * (1 - a);
    const l1 = L(rr, rg, rb), l2 = L(d[i], d[i + 1], d[i + 2]); const c = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); if (c < worst) worst = c; n++; }
  return { worst, n }; }`;
const TARGETS = [
  { name: 'hero CTA', path: '/', width: 1440, sel: '.home-hero a' },
  { name: 'Menu', path: '/about', width: 1100, sel: '[data-hd=menu]' },
  { name: 'Join', path: '/about', width: 1440, sel: '[data-hd=cta]' },
  // Footer: the lockup, an Explore text link, a legal-bar link, and (when the session shows it) the media-kit link, each by a stable selector.
  { name: 'footer lockup', path: '/about', width: 1440, sel: 'footer a[href="/"]' },
  { name: 'footer explore link', path: '/about', width: 1440, sel: 'footer a[href="/about"]' },
  { name: 'footer legal link', path: '/about', width: 1440, sel: 'footer [data-footer-bar] a[href="/privacy"]' },
  // The media-kit footer link renders only for a signed-in admin (MediaKitFooterLink), so an anonymous run skips it rather than failing.
  { name: 'footer media-kit link', path: '/about', width: 1440, sel: 'footer a[href="/media-kit"]', optional: true },
];
// The Home hero CTA needs live Sanity events, so it is probed only on a deployed origin.
await withSite(async ({ base, browser, ctxOpts, deployed }) => {
  const seen = []; const targets = deployed ? TARGETS : TARGETS.filter((t) => t.path !== '/');
  for (const t of targets) {
    const { page, ctx } = await openPage(browser, ctxOpts, base, t.path, t.width);
    await page.keyboard.press('Shift'); // keyboard modality, so :focus-visible applies
    const r = await page.evaluate(`(${PROBE})(${JSON.stringify(t.sel)})`);
    if (!r) { if (!t.optional) check(false, `${t.name}: selector ${t.sel} not found`); await ctx.close(); continue; }
    seen.push({ ...t, ...r });
    check(r.w === '2px' && r.s === 'solid' && r.o === '3px', `${t.name}: focus outline is ${r.w} ${r.s} offset ${r.o}, want 2px solid offset 3px`);
    // Pixel ground: hide the outline, screenshot a band around the box (animations frozen), take the lowest contrast in the 6-9px ring.
    await page.evaluate((sel) => document.querySelector(sel).style.setProperty('outline', 'none', 'important'), t.sel);
    const vp = page.viewportSize(); const x0 = Math.max(0, Math.floor(r.box.x - CLIP_MARGIN)), y0 = Math.max(0, Math.floor(r.box.y - CLIP_MARGIN));
    const x1 = Math.min(vp.width, Math.ceil(r.box.x + r.box.w + CLIP_MARGIN)), y1 = Math.min(vp.height, Math.ceil(r.box.y + r.box.h + CLIP_MARGIN));
    // The ring box (element +-5px) must be unclipped on EVERY side, horizontally as well as vertically.
    const clipped = r.box.x - RING_REACH < 0 || r.box.y - RING_REACH < 0 || r.box.x + r.box.w + RING_REACH > vp.width || r.box.y + r.box.h + RING_REACH > vp.height;
    if (clipped) { check(false, `${t.name}: ring box (element +-${RING_REACH}px) is clipped by the viewport (box ${JSON.stringify(r.box)}, viewport ${vp.width}x${vp.height}), cannot sample its ground`); await ctx.close(); continue; }
    const png = await page.screenshot({ clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }, animations: 'disabled' });
    const px = await page.evaluate(`(${SAMPLE})(${JSON.stringify({ b64: png.toString('base64'), ox: r.box.x - x0, oy: r.box.y - y0, w: r.box.w, h: r.box.h, ring: r.ring })})`);
    check(r.ring[3] > 0 && px.n > 0 && px.worst >= 3, `${t.name}: worst ring contrast ${px.worst.toFixed(2)}:1 against ${px.n} sampled ground pixels, want >=3:1`);
    await ctx.close();
  }
  check(seen.length >= targets.filter((t) => !t.optional).length, 'not every required target was probed');
});
finish('focus-ring');
