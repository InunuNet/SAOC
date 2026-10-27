// F1a: one focus ring across hero CTA, Menu, Join and a footer link. Geometry equal to the existing hero CTA ring
// (outline 2px solid, offset 3px) and the ring colour reaches 3:1 against the ground it sits on.
import { withSite, openPage, check, finish, RGBA_FN, blend, ratio } from './lib.mjs';
// Settled values only: transition-colors animates outline-color, so a read right after focus() sees the START colour. Wait for animations, then a 300ms floor.
const PROBE = `async (sel) => { const el = document.querySelector(sel); if (!el) return null; el.focus();
  await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))); await new Promise((r) => setTimeout(r, 300)); const c = getComputedStyle(el);
  const rgba = ${RGBA_FN}; let ground = [255,255,255]; const chain = []; for (let n = el.parentElement; n; n = n.parentElement) chain.push(n); // PARENT chain only: the ring is offset and paints outside the element, so its own fill is not its ground
  for (const n of chain.reverse()) { const b = rgba(getComputedStyle(n).backgroundColor); if (b[3] > 0) ground = b[3] === 1 ? b.slice(0,3) : [b[0]*b[3]+ground[0]*(1-b[3]), b[1]*b[3]+ground[1]*(1-b[3]), b[2]*b[3]+ground[2]*(1-b[3])]; }
  return { w: c.outlineWidth, s: c.outlineStyle, o: c.outlineOffset, ring: rgba(c.outlineColor), ground }; }`;
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
    const cr = ratio(blend(r.ring, r.ground), r.ground);
    check(r.ring[3] > 0 && cr >= 3, `${t.name}: ring contrast ${cr.toFixed(2)}:1 on its ground, want >=3:1`);
    await ctx.close();
  }
  check(seen.length >= targets.filter((t) => !t.optional).length, 'not every required target was probed');
});
finish('focus-ring');
