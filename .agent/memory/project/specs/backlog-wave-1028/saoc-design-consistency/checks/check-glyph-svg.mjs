// F1e lever 2 (NOS Design ruling): U+2192 (arrow) and U+203B (status mark) never render from a system face. Where the shipped faces have the glyph it is set as text in that face
// (the font-fallback-walk proves it); where they lack it, the site's inline SVG renders instead. Markup contract for the SVG: `svg[data-glyph="arrow"]` or `svg[data-glyph="status-mark"]`,
// aria-hidden="true", fill or stroke resolving to the surrounding text colour (currentColor). The ARROW is 1em x 1em (+-1px) on the text baseline (bottom within 0.2em of it).
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
    const paint = [cs.fill, cs.stroke].filter((v) => v && v !== 'none'); return { kind: s.getAttribute('data-glyph'), hidden: s.getAttribute('aria-hidden'), w: r.width, h: r.height, fs, color: cs.color, paint, dBase: r.bottom - base, shown: r.width > 0 }; });
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
    for (const s of svgs.filter((v) => v.shown)) {
      check(s.hidden === 'true', `${w}: svg[data-glyph=${s.kind}] lacks aria-hidden="true"`);
      if (s.kind === 'arrow') check(Math.abs(s.w - s.fs) <= 1 && Math.abs(s.h - s.fs) <= 1, `${w}: svg[data-glyph=${s.kind}] is ${s.w.toFixed(1)}x${s.h.toFixed(1)}px at font-size ${s.fs}px, want 1em x 1em`);
      check(s.paint.length > 0 && s.paint.every((v) => v === s.color), `${w}: svg[data-glyph=${s.kind}] paint [${s.paint.join(' | ')}] is not currentColor (${s.color})`);
      if (s.kind === 'arrow') check(Math.abs(s.dBase) <= 0.2 * s.fs, `${w}: svg[data-glyph=${s.kind}] bottom is ${s.dBase.toFixed(1)}px off the text baseline, want within 0.2em`);
    }
    if (path === '/') check(sites.length > 0, `${w}: no status badge on Home (the DOM half of the mark rule needs one)`);
    for (const t of sites) check(t.hasSvg || (faceHasMark && t.text === '※'), `${w}: status marker leads with "${t.text}"${faceHasMark ? '' : ' (no shipped face has U+203B)'}, want the status-mark SVG${faceHasMark ? ' or a text mark set in a shipped face' : ''}`);
    await ctx.close();
  }
});
finish('glyph-svg');
