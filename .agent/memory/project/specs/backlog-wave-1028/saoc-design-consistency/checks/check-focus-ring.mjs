// F1a: one focus ring across hero CTA, Menu, Join (header at 1440 and the open drawer's link at 390) a footer link, the header search button, the dark-footer newsletter controls (ivory ring) and the open drawer's close and search controls. Geometry equal to the existing hero CTA ring
// (outline 2px solid, offset 3px) and the settled ring colour reaches 3:1 against the PIXELS painted just outside it (photograph, scrim and
// panels included): a band 2-6px outside the element box (the 2px ring at a 3px offset paints 3-5px out) is screenshotted with the outline hidden and the WORST-case contrast is used.
import { chromium } from 'playwright';
import { withSite, openPage, check, finish, RGBA_FN, blend, ratio } from './lib.mjs';
// Settled values only: transition-colors animates outline-color, so a read right after focus() sees the START colour. Wait for animations, then a 300ms floor.
const PROBE = `async (sel) => { const el = document.querySelector(sel); if (!el) return null; el.focus();
  await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))); await new Promise((r) => setTimeout(r, 300)); const c = getComputedStyle(el);
  const rgba = ${RGBA_FN}; let ground = [255,255,255]; const chain = []; for (let n = el.parentElement; n; n = n.parentElement) chain.push(n); // PARENT chain only: the ring is offset and paints outside the element, so its own fill is not its ground
  for (const n of chain.reverse()) { const b = rgba(getComputedStyle(n).backgroundColor); if (b[3] > 0) ground = b[3] === 1 ? b.slice(0,3) : [b[0]*b[3]+ground[0]*(1-b[3]), b[1]*b[3]+ground[1]*(1-b[3]), b[2]*b[3]+ground[2]*(1-b[3])]; }
  // Ancestor clipping: the full ring box (element rect + outline offset + width) must sit inside the PADDING BOX of every ancestor that clips (overflow-x/-y other than visible, or a clip-path). html and body are skipped (their overflow propagates to the
  // viewport, which the viewport check below covers). A clip-path other than none is not geometrically resolved here: it is reported as unverifiable, so a new one fails until someone looks at it.
  const bb = el.getBoundingClientRect(); const reach = (parseFloat(c.outlineOffset) || 0) + (parseFloat(c.outlineWidth) || 0); const ringBox = { l: bb.left - reach, t: bb.top - reach, r: bb.right + reach, b: bb.bottom + reach }; const clips = []; const TOL = 0.5;
  const nm = (n) => n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (typeof n.className === 'string' && n.className ? '.' + n.className.trim().split(/\s+/).slice(0, 3).join('.') : '');
  for (let n = el.parentElement; n && n !== document.body && n !== document.documentElement; n = n.parentElement) { const a = getComputedStyle(n); const r = n.getBoundingClientRect();
    const pad = { l: r.left + parseFloat(a.borderLeftWidth), t: r.top + parseFloat(a.borderTopWidth), r: r.right - parseFloat(a.borderRightWidth), b: r.bottom - parseFloat(a.borderBottomWidth) }; const sides = [];
    if (a.overflowX !== 'visible') { if (ringBox.l < pad.l - TOL) sides.push('left'); if (ringBox.r > pad.r + TOL) sides.push('right'); }
    if (a.overflowY !== 'visible') { if (ringBox.t < pad.t - TOL) sides.push('top'); if (ringBox.b > pad.b + TOL) sides.push('bottom'); }
    if (sides.length) clips.push({ by: nm(n), overflow: a.overflowX + '/' + a.overflowY, sides });
    if (a.clipPath && a.clipPath !== 'none') clips.push({ by: nm(n), clipPath: a.clipPath, unverifiable: true }); }
  return { w: c.outlineWidth, s: c.outlineStyle, o: c.outlineOffset, ring: rgba(c.outlineColor), ground, clips, box: { x: bb.left, y: bb.top, w: bb.width, h: bb.height } }; }`;
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
  { name: 'header logo', path: '/about', width: 1440, sel: 'header a[aria-label^="South African Orchid Council"]' },
  // Search opened at 1440: the query input and the first result link must take the one ring (a bare outline-none removed it on the input at a39fd7b7). Results come from /api/societies/search (live Sanity), so on a
  // fixture build the result link is a printed KNOWN GAP (not asserted); the deployed run covers it.
  { name: 'search input', path: '/about', width: 1440, sel: '[data-sdc-probe]', pre: 'searchInput' },
  { name: 'search result link', path: '/about', width: 1440, sel: '[data-sdc-probe]', pre: 'searchResult', optional: true },
  { name: 'Join', path: '/about', width: 1440, sel: '[data-hd=cta]' },
  // The drawer's own "Join a society" link (MobileMenu), at 390 with the drawer OPEN: the header Join is not the link a phone keyboard user lands on.
  { name: 'drawer Join', path: '/about', width: 390, sel: '[data-sdc-probe]', pre: 'drawerJoin' },
  // Footer: the lockup, an Explore text link, a legal-bar link, and (when the session shows it) the media-kit link, each by a stable selector.
  { name: 'footer lockup', path: '/about', width: 1440, sel: 'footer a[href="/"]' },
  { name: 'footer explore link', path: '/about', width: 1440, sel: 'footer a[href="/about"]' },
  { name: 'footer legal link', path: '/about', width: 1440, sel: 'footer [data-footer-bar] a[href="/privacy"]' },
  // The media-kit footer link renders only for a signed-in admin (MediaKitFooterLink), so an anonymous run skips it rather than failing.
  { name: 'footer media-kit link', path: '/about', width: 1440, sel: 'footer a[href="/media-kit"]', optional: true },
  // Chrome controls the probe did not reach (Codex A7 finding: the footer newsletter submit had no ring). Footer controls sit on the dark footer, so the ring must be a LIGHT (ivory) colour; checked on /about and /judging
  // because the footer is rendered per route. The submit is disabled until hydration, so the probe waits for it to enable.
  { name: 'header search button', path: '/about', width: 1440, sel: '[data-hd=search]' },
  { name: 'footer newsletter submit', path: '/about', width: 1440, sel: 'footer form button[type=submit]', light: true, waitEnabled: true },
  { name: 'footer newsletter submit (judging)', path: '/judging', width: 1440, sel: 'footer form button[type=submit]', light: true, waitEnabled: true },
  { name: 'footer newsletter email input', path: '/about', width: 1440, sel: 'footer form input[type=email]', light: true },
  { name: 'footer newsletter topic checkbox', path: '/about', width: 1440, sel: 'footer form input[type=checkbox]', light: true },
  { name: 'drawer close', path: '/about', width: 390, sel: 'button[aria-label="Close menu"]', drawer: true },
  { name: 'drawer search', path: '/about', width: 390, sel: '[data-hd=drawer-search]', drawer: true },
  // Unauthenticated /events/submit: the members-only prompt's "Contact us about membership" link (app/(marketing)/events/submit/page.tsx) had no ring and no probe visited the route.
  // /media-kit "On this page" chips (components/show/ShowJumpChips.tsx, a NOS-default control reused on a SAOC route): the golden SAOC ring (3px offset), not the NOS --ring-focus 2px default. Below 700px the chips live in a closed
  // <details>; the probe opens it. Probed at 390, 700 and 1440.
  { name: 'media-kit chip link @390', path: '/media-kit', width: 390, sel: '[data-sdc-probe]', pre: 'mediaKitChip' },
  { name: 'media-kit chip link @700', path: '/media-kit', width: 700, sel: '[data-sdc-probe]', pre: 'mediaKitChip' },
  { name: 'media-kit chip link @1440', path: '/media-kit', width: 1440, sel: '[data-sdc-probe]', pre: 'mediaKitChip' },
  { name: 'media-kit jump summary @390', path: '/media-kit', width: 390, sel: '[data-sdc-probe]', pre: 'mediaKitSummary' },
  { name: 'events/submit membership link', path: '/events/submit', width: 1440, sel: 'main a[href="/contact"]' },
];
// DC_SELFTEST=1: proves the ancestor-clip detector on synthetic markup shaped like the /media-kit disclosure (an overflow-y-auto container around a chip), with no server. Flush chip: MUST be reported clipped on the left, top and bottom (the chip is narrower than its container, so not the right); 8px side padding only: top and bottom but NOT left or right (the dev's px-2 fix); the real container (pt-4 px-2 pb-3): MUST be clean.
// This is the phase 4 proof that the detector works, because the real chips are admin-gated locally (KNOWN GAP) and only A13 measures them on beta.
if (process.env.DC_SELFTEST) {
  const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
  const html = (pad) => `<div style="padding:20px"><div style="max-height:200px;overflow-y:auto;padding:${pad}"><a id="chip" href="#x" style="display:inline-block;outline:2px solid #000;outline-offset:3px">chip</a></div></div>`;
  for (const [pad, want] of [['0', ['left', 'top', 'bottom']], ['0 8px', ['top', 'bottom']], ['16px 8px 12px', []]]) {
    await page.setContent(html(pad)); const r = await page.evaluate(`(${PROBE})('#chip')`); const got = new Set(r.clips.flatMap((k) => k.sides || []));
    check(want.every((x) => got.has(x)) && [...got].every((x) => want.includes(x)), `selftest padding "${pad}": expected clipping on [${want}], detector reported [${[...got]}] (${JSON.stringify(r.clips)})`);
  }
  await browser.close(); finish('focus-ring-selftest'); process.exit(0);
}
// DC_FOCUS_ONLY=<substring of a target name> runs just the matching targets (a quick re-run against one defect).
// The Home hero CTA needs live Sanity events, so it is probed only on a deployed origin.
await withSite(async ({ base, browser, ctxOpts, deployed }) => {
  const seen = []; const targets = (deployed ? TARGETS : TARGETS.filter((t) => t.path !== '/')).filter((t) => !process.env.DC_FOCUS_ONLY || t.name.includes(process.env.DC_FOCUS_ONLY));
  for (const t of targets) {
    const { page, ctx } = await openPage(browser, ctxOpts, base, t.path, t.width);
    if (t.pre === 'drawerJoin') {
      await page.locator('[data-hd=menu]').click(); await page.waitForTimeout(500);
      const found = await page.evaluate(() => { const a = [...document.querySelectorAll('a')].find((x) => /^\s*Join a society\s*$/i.test(x.textContent || '') && x.getAttribute('data-hd') !== 'cta' && x.getClientRects().length > 0); if (a) a.setAttribute('data-sdc-probe', ''); return Boolean(a); });
      if (!found) { check(false, `${t.name}: no visible drawer "Join a society" link after opening the menu at ${t.width}px`); await ctx.close(); continue; }
    }
    if (t.pre === 'mediaKitChip' || t.pre === 'mediaKitSummary') {
      // /media-kit is admin-only (lib/media-kit-gate.ts redirects a visitor to /admin/login). With no admin session the probe cannot reach the chips: a printed KNOWN GAP, guarded statically instead by the SAOC-caller assertion on
      // <ShowJumpChips> in check-focus-classes-static.mjs. A run with a verified admin session (DC_BASE_URL on an authenticated origin or a fixture session) probes the real chips and asserts the ring.
      if (/\/admin\/login/.test(page.url()) && process.env.DC_REQUIRE_ADMIN) { check(false, `${t.name}: DC_REQUIRE_ADMIN is set but /media-kit redirected to /admin/login (DC_ADMIN_SESSION missing, expired or not a verified admin)`); await ctx.close(); continue; }
      if (/\/admin\/login/.test(page.url())) { console.log(`KNOWN GAP ${t.name}: /media-kit is admin-gated and redirected to /admin/login; NOT PROBED here (static SAOC-caller assertion in check-focus-classes-static.mjs guards the ring)`); await ctx.close(); continue; }
      const found = await page.evaluate((pre) => { const vis = (e) => e.getClientRects().length > 0; const sum = [...document.querySelectorAll('details > summary')].find((x) => /On this page/.test(x.textContent || '') && vis(x));
        if (pre === 'mediaKitSummary') { if (sum) sum.setAttribute('data-sdc-probe', ''); return Boolean(sum); }
        if (sum) sum.closest('details').open = true; const a = [...document.querySelectorAll('nav[aria-label="On this page"] a')].find(vis); if (a) a.setAttribute('data-sdc-probe', ''); return Boolean(a); }, t.pre);
      if (!found) { check(false, `${t.name}: no visible "On this page" ${t.pre === 'mediaKitSummary' ? 'summary' : 'chip link'} on /media-kit at ${t.width}px`); await ctx.close(); continue; }
      await page.waitForTimeout(300);
    }
    if (t.pre === 'searchInput' || t.pre === 'searchResult') {
      await page.locator('[data-hd=search]').click(); const input = page.locator('[role=dialog] input').first(); await input.waitFor({ timeout: 10000 }).catch(() => {});
      if (t.pre === 'searchInput') await input.evaluate((e) => e.setAttribute('data-sdc-probe', '')).catch(() => {});
      else { await input.fill('orchid').catch(() => {}); const a = page.locator('[role=dialog] a').first(); const ok = await a.waitFor({ timeout: 5000 }).then(() => true).catch(() => false); if (ok) await a.evaluate((e) => e.setAttribute('data-sdc-probe', '')); else console.log(`KNOWN GAP ${t.name}: no search result renders on this build (live Sanity); NOT GUARDED here`); }
    }
    if (t.drawer) { await page.locator('[data-hd=menu]').click(); await page.waitForTimeout(500); }
    if (t.waitEnabled) await page.waitForFunction((sel) => { const e = document.querySelector(sel); return e && !e.disabled; }, t.sel, { timeout: 15000 }).catch(() => {});
    await page.keyboard.press('Shift'); // keyboard modality, so :focus-visible applies
    const r = await page.evaluate(`(${PROBE})(${JSON.stringify(t.sel)})`);
    if (!r) { if (!t.optional) check(false, `${t.name}: selector ${t.sel} not found`); await ctx.close(); continue; }
    seen.push({ ...t, ...r });
    check(r.w === '2px' && r.s === 'solid' && r.o === '3px', `${t.name}: focus outline is ${r.w} ${r.s} offset ${r.o}, want 2px solid offset 3px`);
    if (t.light) check(r.ring[3] > 0 && Math.min(r.ring[0], r.ring[1], r.ring[2]) >= 220, `${t.name}: focus ring colour rgb(${r.ring.slice(0, 3).map(Math.round)}) is not ivory (on the dark footer it must be light, >=220 per channel)`);
    // Pixel ground: hide the outline, screenshot a band around the box (animations frozen), take the lowest contrast in the 6-9px ring.
    await page.evaluate((sel) => document.querySelector(sel).style.setProperty('outline', 'none', 'important'), t.sel);
    const vp = page.viewportSize(); const x0 = Math.max(0, Math.floor(r.box.x - CLIP_MARGIN)), y0 = Math.max(0, Math.floor(r.box.y - CLIP_MARGIN));
    const x1 = Math.min(vp.width, Math.ceil(r.box.x + r.box.w + CLIP_MARGIN)), y1 = Math.min(vp.height, Math.ceil(r.box.y + r.box.h + CLIP_MARGIN));
    for (const k of r.clips) check(false, k.unverifiable ? `${t.name}: ancestor ${k.by} has clip-path ${k.clipPath}, the ring's clipping cannot be resolved by geometry; verify by eye and handle explicitly` : `${t.name}: ring box (element +${RING_REACH}px) is clipped on the ${k.sides.join('/')} by ancestor ${k.by} (overflow ${k.overflow}); give that container padding at least ${RING_REACH}px on that side`);
    // The ring box (element +-5px) must be unclipped on EVERY side, horizontally as well as vertically.
    const clipped = r.box.x - RING_REACH < 0 || r.box.y - RING_REACH < 0 || r.box.x + r.box.w + RING_REACH > vp.width || r.box.y + r.box.h + RING_REACH > vp.height;
    if (clipped) { check(false, `${t.name}: ring box (element +-${RING_REACH}px) is clipped by the viewport (box ${JSON.stringify(r.box)}, viewport ${vp.width}x${vp.height}), cannot sample its ground`); await ctx.close(); continue; }
    const png = await page.screenshot({ clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }, animations: 'disabled' });
    const px = await page.evaluate(`(${SAMPLE})(${JSON.stringify({ b64: png.toString('base64'), ox: r.box.x - x0, oy: r.box.y - y0, w: r.box.w, h: r.box.h, ring: r.ring })})`);
    check(r.ring[3] > 0 && px.n > 0 && px.worst >= 3, `${t.name}: worst ring contrast ${px.worst.toFixed(2)}:1 against ${px.n} sampled ground pixels, want >=3:1`);
    await ctx.close();
  }
  check(seen.length >= targets.filter((t) => !t.optional && !String(t.pre).startsWith('mediaKit')).length, 'not every required target was probed');
});
finish('focus-ring');
