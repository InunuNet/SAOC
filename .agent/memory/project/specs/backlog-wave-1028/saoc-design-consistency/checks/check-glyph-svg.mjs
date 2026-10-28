// F1e lever 2 (NOS Design ruling): U+2192 (arrow) and U+203B (status mark) never render from a system face. Where the shipped faces have the glyph it is set as text in that face
// (the font-fallback-walk proves it); where they lack it, the site's inline SVG renders instead. Markup contract for the SVG: `svg[data-glyph="arrow"]` or `svg[data-glyph="status-mark"]`,
// aria-hidden="true", fill or stroke resolving to the surrounding text colour (currentColor). The ARROW (NOS Design ruling) is NOT 1em: its box is 1.25em wide (+-0.5px) of the label font; the gap from the end of the
// label text (advance, trailing letter-spacing excluded) to the svg box is 0.5em plus the label's letter-spacing (+-0.5px), with no literal space before it; the shaft (`[data-part="shaft"]`) centre sits at
// baseline - T ascent / 2 (+-0.5px). CORNER variant (svg inside an element marked data-variant="corner": the 21 society cards and the Home WOSA link): 1em wide (+-0.5px), no margin and no label-gap assertion; head, stroke and
// cap-midline rules are the same, em is the arrow's own font size; the cap midline is measured against the first line of the title (the marked element's [data-corner-title] if present, else its first h1-h6, else its first text); the label-following rules apply only to arrows without it; the head (`[data-part="head"]`) is an open 45 degree chevron with 0.4em arms (path length 0.8em +-0.04em, bbox height = 2 x width +-10%); stroke 0.08-0.12em, round caps and joins, currentColor, fill none.
// The STATUS MARK is NOT 1em: its extent is the label's measured T cap height plus 4% overshoot (NOS Design ruling), gated by check-status-mark-geometry.mjs (A27).
// Status badges ([data-exhibitor-marker], [data-confirmation-badge]) render on the SAOC host too (PlaceholderMarker, Home NavCards and ShowBand "To be confirmed"): Home at 390 and 1440 must show
// at least one, and each must lead with the status-mark SVG (a text U+203B only if a shipped face has it), never nothing and never a system glyph.
import { withSite, check, finish, tenRoutes } from './lib.mjs';
import { readFileSync } from 'node:fs';
import { woff2Cmap } from './lib-woff2.mjs';
const STATUS_MARKER = 'components/show/_shared/StatusMarker.tsx';
const PROBE = `() => {
  const svgs = [...document.querySelectorAll('svg[data-glyph]')].map((s) => { const cs = getComputedStyle(s); const r = s.getBoundingClientRect(); const fs = parseFloat(cs.fontSize);
    const p = document.createElement('span'); p.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline'; s.parentNode.insertBefore(p, s); const base = p.getBoundingClientRect().bottom; p.remove();
    const paint = [cs.fill, cs.stroke].filter((v) => v && v !== 'none');
    let arrow = null; if (s.getAttribute('data-glyph') === 'arrow') { const box = s.closest('[data-variant="corner"]'); let par = s.parentElement; if (box) par = box.querySelector('[data-corner-title], h1,h2,h3,h4,h5,h6') || box;
      // The label's text node: the first one in the title for the corner variant, else the last one in the arrow's parent. Baseline and font come from it, never from an inserted probe (a probe becomes a flex item in inline-flex links).
      let tn = null; { const x = document.createTreeWalker(par, NodeFilter.SHOW_TEXT); for (let n = x.nextNode(); n; n = x.nextNode()) { if (n.parentElement.closest('svg') || !n.textContent.trim()) continue; if (box) { tn = n; break; } tn = n; } }
      const pc = getComputedStyle(tn ? tn.parentElement : par); const pf = parseFloat(pc.fontSize); const ls = pc.letterSpacing === 'normal' ? 0 : parseFloat(pc.letterSpacing);
      const k = document.createElement('canvas').getContext('2d'); k.font = pc.fontStyle + ' ' + pc.fontWeight + ' ' + pc.fontSize + ' ' + pc.fontFamily; const asc = k.measureText('T').actualBoundingBoxAscent;
      let prev = s.previousSibling; while (prev && prev.nodeType === 3 && !prev.textContent.length) prev = prev.previousSibling; let endX = null; let spaced = false;
      if (prev && prev.nodeType === 3) { spaced = /\\s$/.test(prev.textContent); const g = document.createRange(); g.setStart(prev, prev.textContent.length - 1); g.setEnd(prev, prev.textContent.length); endX = g.getBoundingClientRect().right - ls; }
      let baseY = null; if (tn) { const g = document.createRange(); g.selectNodeContents(tn); const rs = [...g.getClientRects()].filter((q) => q.width > 0); const rr = box ? rs[0] : rs[rs.length - 1]; if (rr) baseY = rr.top + k.measureText('H').fontBoundingBoxAscent; }
      const shaft = s.querySelector('[data-part="shaft"]'); const head = s.querySelector('[data-part="head"]'); const sr = shaft && shaft.getBoundingClientRect(); let hd = null;
      if (head) { const hb = head.getBBox(); const hs = getComputedStyle(head); const len = head.getTotalLength ? head.getTotalLength() : 0; const sc = head.getScreenCTM().a; hd = { w: hb.width, h: hb.height, len: len * sc, sw: parseFloat(hs.strokeWidth) * sc, cap: hs.strokeLinecap, join: hs.strokeLinejoin, fill: hs.fill, stroke: hs.stroke }; }
      let shs = null; if (shaft) { const q = getComputedStyle(shaft); shs = { sw: parseFloat(q.strokeWidth) * shaft.getScreenCTM().a, cap: q.strokeLinecap, stroke: q.stroke }; }
      arrow = { corner: !!box, em: box ? parseFloat(cs.fontSize) : pf, pf, ls, asc, gap: endX === null ? null : r.left - endX, spaced, shaftY: sr ? sr.top + sr.height / 2 : null, baseY, head: hd, shaft: shs }; }
    return { arrow, kind: s.getAttribute('data-glyph'), hidden: s.getAttribute('aria-hidden'), w: r.width, h: r.height, fs, color: cs.color, paint, dBase: r.bottom - base, shown: r.width > 0 }; });
  const sites = [...document.querySelectorAll('[data-exhibitor-marker], [data-confirmation-badge]')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => { const lead = e.firstElementChild; return { text: lead ? lead.textContent.trim() : '', hasSvg: !!(lead && lead.querySelector('svg[data-glyph="status-mark"]')) }; });
  return { svgs, sites };
}`;
await withSite(async (site) => {
  const { base, browser, ctxOpts } = site; const served = new Set();
  const ctx0 = await browser.newContext(ctxOpts({ width: 1440, height: 900 })); const p0 = await ctx0.newPage(); const urls = new Set(); p0.on('request', (r) => { if (r.resourceType() === 'font') urls.add(r.url()); });
  await p0.goto(base + '/about', { waitUntil: 'networkidle', timeout: 120000 }); for (const u of urls) { const res = await ctx0.request.get(u); for (const cp of woff2Cmap(await res.body())) served.add(cp); } await ctx0.close();
  const faceHasMark = served.has(0x203b);
  // Source rule as well as the DOM: when no shipped face has U+203B the mark must be the inline SVG, never the text glyph.
  const src = readFileSync(STATUS_MARKER, 'utf8');
  if (!faceHasMark) {
    check(!/>\s*\u203B\s*</.test(src), `${STATUS_MARKER} still renders U+203B as text, but no shipped face has it (system-font fallback)`);
    check(/<svg[^>]*data-glyph=["']status-mark["']/.test(src), `${STATUS_MARKER} has no <svg data-glyph="status-mark"> replacing the mark`);
    const tag = (src.match(/<svg[^>]*data-glyph=["']status-mark["'][^>]*>/) || [''])[0];
    check(/aria-hidden/.test(tag), `${STATUS_MARKER}: status-mark svg must be aria-hidden`);
    check(/currentColor/.test(src), `${STATUS_MARKER}: status-mark svg must paint with currentColor`);
  }
  for (const width of [390, 1440]) for (const path of tenRoutes(site)) {
    const ctx = await browser.newContext(ctxOpts({ width, height: 900 })); const page = await ctx.newPage(); await page.goto(base + path, { waitUntil: 'networkidle', timeout: 120000 }); await page.waitForTimeout(400);
    const w = `${path}@${width}`; const { svgs, sites } = await page.evaluate(`(${PROBE})()`);
    if (['/societies', '/judging', '/'].includes(path)) check(svgs.filter((v) => v.shown && v.kind === 'arrow').length > 0, `${w}: no svg[data-glyph=arrow] on a route whose links carry arrows (still the text glyph?)`);
    for (const s of svgs.filter((v) => v.shown)) {
      check(s.hidden === 'true', `${w}: svg[data-glyph=${s.kind}] lacks aria-hidden="true"`);
      if (s.kind === 'arrow') { const A = s.arrow; const t = `${w}: svg[data-glyph=arrow]`; const em = (v) => (v / A.em).toFixed(2) + 'em';
        const wantW = (A.corner ? 1 : 1.25) * A.em; check(Math.abs(s.w - wantW) <= 0.5, `${t}${A.corner ? ' (corner)' : ''} is ${s.w.toFixed(2)}px wide, want ${A.corner ? '1' : '1.25'}em (${wantW.toFixed(2)}px) +-0.5`);
        if (!A.corner) check(A.gap !== null && !A.spaced && Math.abs(A.gap - (0.5 * A.pf + A.ls)) <= 0.5, `${t} gap from the label text is ${A.gap === null ? 'n/a (no text node before it)' : A.gap.toFixed(2) + 'px'}${A.spaced ? ' with a literal space before it' : ''}, want 0.5em + letter-spacing = ${(0.5 * A.pf + A.ls).toFixed(2)}px +-0.5`);
        check(A.shaftY !== null && A.baseY !== null && Math.abs(A.shaftY - (A.baseY - A.asc / 2)) <= 0.5, `${t} shaft y ${A.shaftY && A.shaftY.toFixed(2)} vs cap-height midline ${(A.baseY - A.asc / 2).toFixed(2)}, want +-0.5 (needs [data-part="shaft"])`);
        const H = A.head; check(!!H, `${t} has no [data-part="head"]`);
        if (H) { check(Math.abs(H.len - 0.8 * A.em) <= 0.04 * A.em, `${t} head path length ${em(H.len)}, want 0.8em (two 0.4em arms)`); check(H.w > 0 && Math.abs(H.h / H.w - 2) <= 0.2, `${t} head is not a 45 degree chevron (bbox ${H.w.toFixed(2)}x${H.h.toFixed(2)})`);
          check(H.sw >= 0.08 * A.em && H.sw <= 0.12 * A.em, `${t} head stroke ${em(H.sw)}, want ~0.1em`); check(H.cap === 'round' && H.join === 'round', `${t} head caps/joins are ${H.cap}/${H.join}, want round/round`); check(H.fill === 'none', `${t} head fill is ${H.fill}, want none (open chevron)`); }
        if (A.shaft) { check(A.shaft.sw >= 0.08 * A.em && A.shaft.sw <= 0.12 * A.em, `${t} shaft stroke ${em(A.shaft.sw)}, want ~0.1em`); check(A.shaft.cap === 'round', `${t} shaft cap is ${A.shaft.cap}, want round`); } }
    }
    if (path === '/') check(sites.length > 0, `${w}: no status badge on Home (the DOM half of the mark rule needs one)`);
    for (const t of sites) check(t.hasSvg || (faceHasMark && t.text === '※'), `${w}: status marker leads with "${t.text}"${faceHasMark ? '' : ' (no shipped face has U+203B)'}, want the status-mark SVG${faceHasMark ? ' or a text mark set in a shipped face' : ''}`);
    await ctx.close();
  }
});
finish('glyph-svg');
