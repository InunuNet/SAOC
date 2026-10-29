// F1e (NOS Design ruling, ※ ReferenceMark): the status mark is the inline svg[data-glyph="status-mark"] inside a StatusMarker badge ([data-exhibitor-marker] / [data-confirmation-badge]).
// Geometry, in the badge LABEL's computed font, at 1440 and 390 on any StatusMarker present (the Home "To be confirmed" badge on a production build):
//   T ascent = canvas measureText('T').actualBoundingBoxAscent; overshoot = 4% of it;
//   mark top = T top - overshoot and mark bottom = baseline + overshoot, each +-0.5 px (mark box = painted shapes' screen bounds, stroke included);
//   strokes ~0.1em (0.08-0.12em) with stroke-linecap round; dots are <circle>, diameter 1.5x the stroke (+-15%).
// Markup contract: dots are <circle>, strokes are <line>/<path> with a stroke. Needs a production build (DC_PROD=1) so Home renders.
import { withSite, check, finish } from './lib.mjs';
const PROBE = `() => {
  const badges = [...document.querySelectorAll('[data-exhibitor-marker], [data-confirmation-badge]')].filter((b) => b.getBoundingClientRect().width > 0); const out = [];
  for (const b of badges) {
    const svg = b.querySelector('svg[data-glyph="status-mark"]'); const label = [...b.children].filter((c) => !c.querySelector('svg') && c.getBoundingClientRect().width > 0).pop(); if (!label) { out.push({ err: 'no label span' }); continue; }
    if (!svg) { out.push({ err: 'no svg[data-glyph="status-mark"]' }); continue; }
    const cs = getComputedStyle(label); const font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily; const k = document.createElement('canvas').getContext('2d'); k.font = font; const asc = k.measureText('T').actualBoundingBoxAscent;
    const p = document.createElement('span'); p.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline'; label.insertBefore(p, label.firstChild); const base = p.getBoundingClientRect().bottom; p.remove();
    let top = Infinity, bottom = -Infinity; const strokes = []; const dots = []; const fs = parseFloat(cs.fontSize);
    for (const e of svg.querySelectorAll('path, line, circle, rect, polyline, polygon, ellipse')) {
      const m = e.getScreenCTM(); const bb = e.getBBox(); const sc = Math.sqrt(m.a * m.a + m.b * m.b); const sc2 = getComputedStyle(e); const stroked = sc2.stroke && sc2.stroke !== 'none'; const sw = stroked ? parseFloat(sc2.strokeWidth) * sc : 0;
      const ys = [bb.y, bb.y + bb.height].flatMap((y) => [bb.x, bb.x + bb.width].map((x) => m.b * x + m.d * y + m.f)); top = Math.min(top, Math.min(...ys) - sw / 2); bottom = Math.max(bottom, Math.max(...ys) + sw / 2);
      if (e.tagName === 'circle') dots.push(2 * parseFloat(e.getAttribute('r')) * sc); else if (stroked) strokes.push({ sw, cap: sc2.strokeLinecap });
    }
    out.push({ asc, base, top, bottom, strokes, dots, fs });
  }
  return out; }`;
await withSite(async ({ base, browser, ctxOpts, prod, deployed }) => {
  if (!prod && !deployed) { console.error('INCONCLUSIVE: Home (with a status badge) needs a production build (DC_PROD=1) or a deployed DC_BASE_URL'); process.exit(2); }
  let seen = 0;
  for (const width of [1440, 390]) {
    const ctx = await browser.newContext(ctxOpts({ width, height: 900 })); const page = await ctx.newPage(); await page.goto(base + '/', { waitUntil: 'networkidle', timeout: 120000 }); await page.waitForTimeout(500);
    const rows = await page.evaluate(`(${PROBE})()`);
    for (const r of rows) {
      seen++; const w = `/@${width}`; if (r.err) { check(false, `${w}: status badge ${r.err}`); continue; }
      const over = 0.04 * r.asc; const wantTop = r.base - r.asc - over; const wantBottom = r.base + over;
      check(Math.abs(r.top - wantTop) <= 0.5, `${w}: mark top ${r.top.toFixed(2)} vs T top - overshoot ${wantTop.toFixed(2)} (T ascent ${r.asc.toFixed(2)}), want +-0.5px`);
      check(Math.abs(r.bottom - wantBottom) <= 0.5, `${w}: mark bottom ${r.bottom.toFixed(2)} vs baseline + overshoot ${wantBottom.toFixed(2)}, want +-0.5px`);
      check(r.strokes.length > 0 && r.strokes.every((s) => s.sw >= 0.08 * r.fs && s.sw <= 0.12 * r.fs), `${w}: stroke widths [${r.strokes.map((s) => s.sw.toFixed(2)).join(', ')}]px at ${r.fs}px, want ~0.1em (0.08-0.12)`);
      check(r.strokes.every((s) => s.cap === 'round'), `${w}: stroke-linecap must be round`);
      const sw = r.strokes[0] ? r.strokes[0].sw : 0; check(r.dots.length > 0 && r.dots.every((d) => sw > 0 && Math.abs(d / sw - 1.5) <= 0.225), `${w}: dot diameters [${r.dots.map((d) => d.toFixed(2)).join(', ')}]px vs stroke ${sw.toFixed(2)}px, want 1.5x (+-15%) and dots as <circle>`);
    }
    await ctx.close();
  }
  check(seen > 0, 'no StatusMarker badge on Home at 1440 or 390 (cannot measure the mark)');
});
finish('status-mark-geometry');
