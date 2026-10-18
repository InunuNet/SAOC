// nos-critique-r15 F2b rendered (PUBLIC production build, next start 3010-3019 minus 3013). QA input, hash-locked.
// Scopes from goldens/f2b-edits.json: the open MegaMenu panel at 1280, the open MobileMenu drawer at 390 with every accordion expanded, and
// the /contact and /members forms at 1280 and 390. Menus are opened with element.click() (the pointer never moves, so no hover state
// changes a background), then one key press puts the page in keyboard modality and each element carrying a focus-visible ring class is
// focused, scrolled into view (nearest) and measured while focused:
//   R1  it matches :focus-visible and its box-shadow carries a ring >= 2px wide outside a ring-offset layer.
//   R2  computed: the ring colour, composited over the element's actual background (every ancestor background composited from the root),
//       reaches minRatio (3:1, WCAG 1.4.11) against that background AND against its own ring-offset colour.
//   R3  painted: in a 16x3 capture (Playwright's clip is viewport-relative for a viewport screenshot) at the element's left edge, vertical middle, the ring's inner column reaches minRatio
//       against the background pixel 5px further out AND against the offset pixel 2px further in.
//   R4  coverage: each scope reaches its minStops at each width, and every IN line with a rendered scope (f2b-edits.json), except its
//       `dormant` lines (no nav column has a headingHref), is matched by at least one measured element (the line's class literal, ring colour normalised, is a substring of the element's class).
//   R5  lockup guard (OUT, byte-unchanged): the footer SaocLockup link (f2b-edits.json lockupGuard, matched by its line's class literal) at
//       1280 and 390, focused the same way, keeps a ring-offset band >= minOffsetPx wide whose colour reaches minRatio against the footer
//       background, computed (offset layer over the composited ancestors) and painted (offset pixel vs the background pixel 7px out).
// DownloadTicketButton (needs a confirmed order) has no rendered scope; f2b-static.mjs covers it.
import { finish, goldenJson, readRepoFile, ringLiteral } from './_f2b.mjs';

const { require, serve } = await import('./_server.mjs');
const { IN_PAGE_PIXELS, IN_PAGE_RESOLVE, ratio, round2 } = await import('./_color.mjs');
const { chromium } = require('playwright');
const NAME = 'f2b-rendered.mjs';
const G = goldenJson('f2b-edits.json');
const failures = [];
let stops = 0;

// R4 coverage targets: the class literal of every IN line that has a rendered scope.
const targets = [];
for (const e of G.in) {
  if (!e.rendered) continue;
  const lines = (readRepoFile(e.file) ?? '').split('\n');
  for (const n of e.lines) {
    if ((e.dormant ?? []).includes(n)) continue;
    const lit = ringLiteral(lines[n - 1] ?? '', G.from, G.to);
    if (!lit) failures.push(`${e.file}:${n}: no quoted ring class literal on this line (R4)`);
    else targets.push({ key: `${e.file}:${n}`, scope: e.rendered, lit, hit: 0 });
  }
}

const srv = await serve('public');
if (srv.failures) finish(NAME, srv.failures);
const browser = await chromium.launch();
try {
  for (const [scopeName, sc] of Object.entries(G.scopes)) {
    for (const width of sc.widths) {
      const where = `${sc.route} @${width} ${scopeName}`;
      const ctx = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(`${srv.origin}${sc.route}`, { waitUntil: 'networkidle' });
      if (sc.open) {
        const opened = await page.evaluate((sel) => { const b = document.querySelector(sel); if (!b) return false; b.click(); return true; }, sc.open);
        if (!opened) { failures.push(`${where}: opener ${sc.open} not found (R4)`); await ctx.close(); continue; }
        await page.waitForTimeout(400);
      }
      if (sc.expand) {
        for (let k = 0; k < 20; k++) {
          const more = await page.evaluate((sel) => { const b = document.querySelector(sel); if (!b) return false; b.click(); return true; }, sc.expand);
          if (!more) break;
          await page.waitForTimeout(150);
        }
      }
      await page.keyboard.press('Shift'); // keyboard modality: a scripted focus() now matches :focus-visible
      const n = await page.evaluate((rootSel) => {
        const root = document.querySelector(rootSel);
        const els = root ? [...root.querySelectorAll('[class*="focus-visible:ring-"]')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; }) : [];
        window.__f2b = els;
        return els.length;
      }, sc.root);
      if (n < sc.minStops) failures.push(`${where}: ${n} focusable ring element(s) in ${sc.root}, want >= ${sc.minStops} (R4)`);
      for (let i = 0; i < n; i++) {
        stops += 1;
        const s = await page.evaluate(async (idx) => {
          const e = window.__f2b[idx];
          e.focus({ preventScroll: true });
          e.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
          await new Promise((r) => setTimeout(r, 120));
          const chain = []; for (let p = e.parentElement; p; p = p.parentElement) chain.push(getComputedStyle(p).backgroundColor);
          const r = e.getBoundingClientRect();
          return {
            id: `${e.tagName.toLowerCase()} "${(e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30)}"`,
            cls: typeof e.className === 'string' ? e.className : '', active: document.activeElement === e, fv: e.matches(':focus-visible'),
            shadow: getComputedStyle(e).boxShadow, chain: chain.reverse(), box: { x: r.left, y: r.top, w: r.width, h: r.height },
          };
        }, i);
        const key = `${where} ${s.id}`;
        const norm = s.cls.replace(G.from, 'RING').replace(G.to, 'RING');
        for (const t of targets) if (t.scope === scopeName && norm.includes(t.lit)) t.hit += 1;
        if (!s.active || !s.fv) { failures.push(`${key}: not focused / not :focus-visible (R1)`); continue; }
        // box-shadow list: "<color> 0px 0px 0px <spread>, ..." -> [{ color, spread }]
        const layers = [...s.shadow.matchAll(/((?:rgba?|color|oklab|oklch|lab|lch|hsla?)\([^)]*\)|#[0-9a-f]{3,8})\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px/gi)].map((m) => ({ color: m[1], spread: Number(m[5]) }));
        const ring = layers.filter((l) => l.spread >= 2).sort((a, b) => b.spread - a.spread)[0];
        const offset = layers.filter((l) => ring && l.spread > 0 && l.spread < ring.spread).sort((a, b) => b.spread - a.spread)[0];
        if (!ring || !offset || ring.spread - offset.spread < 2) { failures.push(`${key}: no >=2px ring outside an offset in box-shadow "${s.shadow}" (R1)`); continue; }
        let bg = [255, 255, 255];
        for (const c of s.chain) bg = await page.evaluate(`(${IN_PAGE_RESOLVE})(${JSON.stringify(c)}, ${JSON.stringify(bg)})`);
        const ringRgb = await page.evaluate(`(${IN_PAGE_RESOLVE})(${JSON.stringify(ring.color)}, ${JSON.stringify(bg)})`);
        const offRgb = await page.evaluate(`(${IN_PAGE_RESOLVE})(${JSON.stringify(offset.color)}, ${JSON.stringify(bg)})`);
        const rBg = ratio(ringRgb, bg);
        const rOff = ratio(ringRgb, offRgb);
        if (rBg < G.minRatio) failures.push(`${key}: ring rgb(${ringRgb}) vs background rgb(${bg}) = ${round2(rBg)}:1, want >= ${G.minRatio} (R2)`);
        if (rOff < G.minRatio) failures.push(`${key}: ring rgb(${ringRgb}) vs its offset rgb(${offRgb}) = ${round2(rOff)}:1, want >= ${G.minRatio} (R2)`);
        // R3: the ring band is [floor(x) - spread, floor(x) - offset.spread); its inner full column is floor(x) - spread + 1 (index w+8 of
        // the capture), the background 5px further out (w+3), the offset's outer full column 2px further in (w+10).
        const y = Math.round(s.box.y + s.box.h / 2);
        const x0 = Math.floor(s.box.x) - ring.spread + 1 - 8;
        if (x0 < 0) { failures.push(`${key}: element too close to the page edge to sample the painted ring (R3)`); continue; }
        const png = await page.screenshot({ clip: { x: x0, y: y - 1, width: 16, height: 3 } });
        const { w, px } = await page.evaluate(`(${IN_PAGE_PIXELS})(${JSON.stringify(png.toString('base64'))})`);
        const pRing = px[w + 8]; const pOut = px[w + 3]; const pOff = px[w + 10];
        if (ratio(pRing, pOut) < G.minRatio) failures.push(`${key}: painted ring rgb(${pRing}) vs background rgb(${pOut}) = ${round2(ratio(pRing, pOut))}:1, want >= ${G.minRatio} (R3)`);
        if (ratio(pRing, pOff) < G.minRatio) failures.push(`${key}: painted ring rgb(${pRing}) vs offset rgb(${pOff}) = ${round2(ratio(pRing, pOff))}:1, want >= ${G.minRatio} (R3)`);
      }
      await ctx.close();
    }
  }
  // R5: the footer lockup's white offset band.
  const L = G.lockupGuard;
  const lockLit = ringLiteral((readRepoFile(L.file) ?? '').split('\n')[L.line - 1] ?? '', G.from, G.to);
  if (!lockLit) failures.push(`${L.file}:${L.line}: no quoted ring class literal on this line (R5)`);
  for (const width of lockLit ? L.widths : []) {
    const where = `${L.route} @${width} footer SaocLockup`;
    stops += 1;
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${srv.origin}${L.route}`, { waitUntil: 'networkidle' });
    await page.keyboard.press('Shift');
    const s = await page.evaluate(async ({ rootSel, lit, from, to }) => {
      const root = document.querySelector(rootSel);
      const e = root && [...root.querySelectorAll('a, button')].find((x) => typeof x.className === 'string' && x.className.replace(from, 'RING').replace(to, 'RING').includes(lit));
      if (!e) return null;
      e.focus({ preventScroll: true });
      e.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
      await new Promise((r) => setTimeout(r, 120));
      const chain = []; for (let p = e.parentElement; p; p = p.parentElement) chain.push(getComputedStyle(p).backgroundColor);
      const r = e.getBoundingClientRect();
      return { fv: e.matches(':focus-visible'), shadow: getComputedStyle(e).boxShadow, chain: chain.reverse(), box: { x: r.left, y: r.top, w: r.width, h: r.height } };
    }, { rootSel: L.root, lit: lockLit, from: G.from, to: G.to });
    if (!s) { failures.push(`${where}: no element in ${L.root} carries the SaocLockup class literal (R5)`); await ctx.close(); continue; }
    if (!s.fv) { failures.push(`${where}: not :focus-visible (R5)`); await ctx.close(); continue; }
    const layers = [...s.shadow.matchAll(/((?:rgba?|color|oklab|oklch|lab|lch|hsla?)\([^)]*\)|#[0-9a-f]{3,8})\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px/gi)].map((m) => ({ color: m[1], spread: Number(m[5]) }));
    const ring = layers.filter((l) => l.spread > 0).sort((a, b) => b.spread - a.spread)[0];
    const offset = layers.filter((l) => ring && l.spread > 0 && l.spread < ring.spread).sort((a, b) => b.spread - a.spread)[0];
    if (!offset || offset.spread < L.minOffsetPx) { failures.push(`${where}: no ring-offset band >= ${L.minOffsetPx}px in box-shadow "${s.shadow}" (R5)`); await ctx.close(); continue; }
    let bg = [255, 255, 255];
    for (const c of s.chain) bg = await page.evaluate(`(${IN_PAGE_RESOLVE})(${JSON.stringify(c)}, ${JSON.stringify(bg)})`);
    const offRgb = await page.evaluate(`(${IN_PAGE_RESOLVE})(${JSON.stringify(offset.color)}, ${JSON.stringify(bg)})`);
    if (ratio(offRgb, bg) < G.minRatio) failures.push(`${where}: offset band rgb(${offRgb}) vs footer rgb(${bg}) = ${round2(ratio(offRgb, bg))}:1, want >= ${G.minRatio} (R5)`);
    // Painted: the offset band is [floor(x) - offset.spread, floor(x)); its outer full column is floor(x) - offset.spread (index w+8), the
    // footer 7px further out (w+1), clear of the ring band.
    const y = Math.round(s.box.y + s.box.h / 2);
    const x0 = Math.floor(s.box.x) - offset.spread - 8;
    if (x0 < 0) { failures.push(`${where}: element too close to the page edge to sample the painted offset (R5)`); await ctx.close(); continue; }
    const png = await page.screenshot({ clip: { x: x0, y: y - 1, width: 16, height: 3 } });
    const { w, px } = await page.evaluate(`(${IN_PAGE_PIXELS})(${JSON.stringify(png.toString('base64'))})`);
    const pOff = px[w + 8]; const pOut = px[w + 1];
    if (ratio(pOff, pOut) < G.minRatio) failures.push(`${where}: painted offset rgb(${pOff}) vs footer rgb(${pOut}) = ${round2(ratio(pOff, pOut))}:1, want >= ${G.minRatio} (R5)`);
    await ctx.close();
  }
} catch (e) {
  failures.push(`render error: ${e && e.message ? e.message : e}`);
} finally {
  await browser.close();
  await srv.stop();
}
for (const t of targets) if (t.hit === 0) failures.push(`${t.key}: no rendered element in the ${t.scope} scope carries this line's ring class (R4)`);
finish(NAME, failures, `${stops} focus stops (MegaMenu 1280, MobileMenu 390, /contact and /members 1280/390) (plus the footer SaocLockup offset guard at 1280/390) show a ring >= ${G.minRatio}:1 against their background and offset, and the lockup's offset band >= ${G.minRatio}:1 against the footer, computed and painted; ${targets.length} IN lines covered.`);
