// council-design-1 C5 gate (COUNCIL-1 C5, SAOC host): on EVERY /societies/<slug> page (21 on the fixture build) each external link in the
// "About this society" row has a leading monochrome icon: exactly 1 svg, aria-hidden, 20x20, currentColor (no brand colour), label text
// verbatim, no trailing arrow (0 U+2192 in the row), 8px gap icon->label, 24px between links, hit area >= 44, underline on the label only
// (the svg is not underlined), the link name is the label; globe = outline stroke 1.75; Facebook and Instagram paths equal the Simple Icons golden byte for byte.
import { readFileSync } from 'node:fs';
import { withSite, openPage, check, finish, allSocietySlugs } from './council-lib.mjs';

const G = JSON.parse(readFileSync('.agent/memory/project/specs/council-1028/council-design-1/goldens/c5-society-icons.json', 'utf8'));
const PROBE = `() => {
  const sec = [...document.querySelectorAll('section')].find((s) => s.querySelector('h2')?.textContent.trim() === 'About this society'); if (!sec) return { sec: false, links: [] };
  const ext = [...sec.querySelectorAll('a[target=_blank]')];
  const links = ext.map((a) => { const svgs = [...a.querySelectorAll('svg')]; const s = svgs[0]; const lr = a.getBoundingClientRect();
    const label = [...a.childNodes].filter((n) => n.nodeType === 3 || (n.nodeType === 1 && n.tagName !== 'svg' && !n.matches('svg *'))).map((n) => n.textContent).join('').replace(/\\s+/g, ' ').trim();
    const walker = document.createTreeWalker(a, NodeFilter.SHOW_TEXT); const tn = walker.nextNode(); const rg = document.createRange(); if (tn) rg.selectNodeContents(tn); const tr = tn ? rg.getBoundingClientRect() : null;
    const sr = s ? s.getBoundingClientRect() : null; const ac = getComputedStyle(a); const sc = s ? getComputedStyle(s) : null;
    const shapes = s ? [...s.querySelectorAll('path,circle,line,rect,ellipse,polyline,polygon')].map((p) => ({ t: p.tagName.toLowerCase(), d: p.getAttribute('d'), sw: p.getAttribute('stroke-width'), fill: p.getAttribute('fill') })) : [];
    return { href: a.getAttribute('href'), label, svgCount: svgs.length, hidden: s?.getAttribute('aria-hidden'), w: sr?.width, h: sr?.height, gap: tr && sr ? tr.left - sr.right : null, leading: tr && sr ? sr.left <= tr.left : null,
      arrow: a.textContent.includes('\\u2192'), hasArrowSvg: Boolean(a.querySelector('svg[data-glyph],svg[data-arrow]')), color: sc?.color, fill: sc?.fill, stroke: sc?.stroke, strokeWidth: sc?.strokeWidth || s?.getAttribute('stroke-width'),
      svgDecoration: sc?.textDecorationLine, hit: lr.height, left: lr.left, right: lr.right, top: lr.top, aColor: ac.color, titleInSvg: Boolean(s?.querySelector('title')), shapes, viewBox: s?.getAttribute('viewBox'), outer: s ? s.outerHTML.length : 0, aria: a.getAttribute('aria-label') }; });
  const rowArrow = sec.textContent.includes('\\u2192'); return { sec: true, links, rowArrow }; }`;
const normD = (d) => (d ?? '').replace(/\s+/g, ' ').trim();
const ICON = { 'Visit society website': 'globe', 'Facebook page': 'facebook', 'Instagram page': 'instagram' };
const tally = { globe: 0, facebook: 0, instagram: 0 };
await withSite(async ({ base, browser, ctxOpts }) => {
  const slugs = await allSocietySlugs(base);
  check(slugs.length === 21, `found ${slugs.length} society pages, want 21`);
  for (const width of [1440, 390]) for (const slug of slugs) {
    const { page, ctx, status } = await openPage(browser, ctxOpts, base, slug, width, 900); const w = `${slug}@${width}`;
    if (status !== 200) { check(false, `${w}: status ${status}`); await ctx.close(); continue; }
    const r = await page.evaluate(`(${PROBE})()`);
    if (!r.sec) { await ctx.close(); continue; } // a society with neither description nor links drops the section (SocietyAbout)
    check(!r.rowArrow, `${w}: "→" still in the About this society section`);
    for (const l of r.links) {
      const kind = ICON[l.label]; const tag = `${w} "${l.label}"`;
      if (!kind) { check(false, `${tag}: unexpected external link label`); continue; } tally[kind] += 1;
      check(l.svgCount === 1, `${tag}: ${l.svgCount} svg, want exactly 1`);
      check(l.hidden === 'true', `${tag}: svg aria-hidden is "${l.hidden}"`);
      check(Math.abs(l.w - 20) <= 0.5 && Math.abs(l.h - 20) <= 0.5, `${tag}: icon box ${l.w}x${l.h}, want 20x20`);
      check(l.leading === true, `${tag}: icon does not lead the label`);
      check(l.gap !== null && Math.abs(l.gap - 8) <= 0.75, `${tag}: icon-to-label gap ${l.gap}, want 8`);
      check(l.arrow === false && l.hasArrowSvg === false, `${tag}: trailing arrow still present`);
      check(l.hit >= 44 - 0.5, `${tag}: hit area ${l.hit} < 44`);
      check(l.titleInSvg === false && !l.aria, `${tag}: the link name must be the label alone (svg <title>/aria-label found)`);
      check(!/underline/.test(l.svgDecoration ?? ''), `${tag}: the icon is underlined (underline is on the label only)`);
      const mono = kind === 'globe' ? (l.stroke === l.color || /currentcolor/i.test(l.stroke ?? '') || l.stroke === l.aColor) : (l.fill === l.color || l.fill === l.aColor);
      check(mono, `${tag}: icon ink is not currentColor (stroke ${l.stroke} / fill ${l.fill} vs text ${l.color})`);
      if (kind === 'globe') {
        check(Math.abs(parseFloat(l.strokeWidth) - 1.75) <= 0.01, `${tag}: globe stroke-width ${l.strokeWidth}, want 1.75`);
        check(l.shapes.some((s) => s.t === 'circle') && !l.shapes.some((s) => s.fill && s.fill !== 'none'), `${tag}: globe is not an outline (circle + no filled shape)`);
      } else {
        const want = normD(G.brandGlyphs.pathData[kind]); check(l.shapes.length === 1 && normD(l.shapes[0].d) === want, `${tag}: ${kind} path data differs from the Simple Icons golden`);
        check(l.viewBox === G.brandGlyphs.viewBox, `${tag}: viewBox ${l.viewBox}, want ${G.brandGlyphs.viewBox}`);
      }
    }
    if (width === 1440) for (let i = 1; i < r.links.length; i += 1) { const gap = r.links[i].left - r.links[i - 1].right; if (Math.abs(r.links[i].top - r.links[i - 1].top) < 4) check(Math.abs(gap - 24) <= 0.75, `${w}: gap between links ${gap}, want 24`); }
    await ctx.close();
  }
});
for (const [k, n] of Object.entries(tally)) check(n > 0, `no "${k}" link found on any of the 21 pages (vacuous pass; the fixture must carry one)`);
finish('c5-societies');
