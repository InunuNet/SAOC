#!/usr/bin/env node
// A-E: layout, overflow and type targets at 390, 1280 and 1920. No horizontal overflow anywhere in the two sections;
// NavCards grid (1 col at 390, 4 equal cols at 1280/1920); card type scale (title 24/600 over 16px prose at 1.55, meta
// >=11px, badge 10.5px); ShowBand geometry (photo flush to the left viewport edge, ~1fr/1.1fr split, content block
// vertically centred with bounded right gutter, facts/countdown/CTA row all spanning the content width, four equal
// countdown cells that fill their box, tabular figures; stacked 3:2 photo and full-width primary CTA below 1100/560).
// Usage: BASE_URL=http://localhost:3614 node contracts/checks/launch-weekend/f14/check-e-geometry.mjs
import { VIEWPORTS, SEL, launch, newPage, openHome, loadGolden, missingHooks, report } from './_lib.mjs';

const T = loadGolden('tokens.json');
const problems = [];
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const browser = await launch();
for (const vp of VIEWPORTS) {
  const { ctx, page } = await newPage(browser, vp);
  await openHome(page);
  const hooks = { navSection: SEL.navSection, navCard: SEL.navCard, band: SEL.band, bandImage: SEL.bandImage, bandContent: SEL.bandContent, bandFacts: SEL.bandFacts, bandCountdown: SEL.bandCountdown, primary: SEL.cta('primary'), secondary: SEL.cta('secondary'), tertiary: SEL.cta('tertiary'), cell: '[data-countdown-cell]', value: '[data-countdown-value]', meta: '[data-nav-card-meta]', badge: '[data-nav-card-badge]' };
  const miss = await missingHooks(page, hooks, vp.name);
  if (miss.length) { problems.push(...miss); await ctx.close(); continue; }
  const m = await page.evaluate(`(() => {
    const q = (s, r) => (r || document).querySelector(s), qa = (s, r) => [...(r || document).querySelectorAll(s)];
    const box = (e) => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top + scrollY, w: b.width, h: b.height, r: b.right, b: b.bottom + scrollY }; };
    const cs = (e) => getComputedStyle(e);
    const nav = q(${JSON.stringify(SEL.navSection)}), band = q(${JSON.stringify(SEL.band)});
    const overflow = [];
    for (const sec of [nav, band]) for (const e of qa('*', sec)) { const b = e.getBoundingClientRect(); if (b.width === 0 && b.height === 0) continue; if (b.right > innerWidth + 0.5 || b.left < -0.5) overflow.push(e.tagName.toLowerCase() + ' ' + Math.round(b.left) + '..' + Math.round(b.right)); }
    const cards = qa(${JSON.stringify(SEL.navCard)}, nav);
    const c0 = cards[0];
    const card = { boxes: cards.map(box), title: cs(q('h3', c0)), prose: cs(q('p', c0)), meta: cs(q(${JSON.stringify('[data-nav-card-meta]')}, c0)), badge: cs(q(${JSON.stringify('[data-nav-card-badge]')}, c0)) };
    const t = { fs: card.title.fontSize, fw: card.title.fontWeight, lh: parseFloat(card.title.lineHeight), pfs: card.prose.fontSize, plh: parseFloat(card.prose.lineHeight), mfs: parseFloat(card.meta.fontSize), bfs: parseFloat(card.badge.fontSize) };
    const img = box(q(${JSON.stringify(SEL.bandImage)})), content = box(q(${JSON.stringify(SEL.bandContent)})), bb = box(band);
    const facts = box(q(${JSON.stringify(SEL.bandFacts)})), cd = box(q(${JSON.stringify(SEL.bandCountdown)}));
    const cells = qa('[data-countdown-cell]', band).map(box);
    const cellOverflow = qa('[data-countdown-cell] *', band).filter((e) => e.scrollWidth > e.clientWidth + 1).length;
    const val = cs(q('[data-countdown-value]', band));
    const lab = q('[data-countdown-cell] :not([data-countdown-value])', band);
    const dts = qa('dt', q(${JSON.stringify(SEL.bandFacts)})).map((e) => parseFloat(cs(e).fontSize));
    const dds = qa('dd', q(${JSON.stringify(SEL.bandFacts)})).map((e) => parseFloat(cs(e).fontSize));
    const ctas = ['primary', 'secondary', 'tertiary'].map((tier) => box(q('[data-show-band-cta="' + tier + '"]', band)));
    return { docW: document.documentElement.scrollWidth, innerW: innerWidth, overflow: overflow.slice(0, 6), card, t, img, content, bb, facts, cd, cells, cellOverflow,
      val: { fs: parseFloat(val.fontSize), tnum: val.fontVariantNumeric }, labFs: lab ? parseFloat(cs(lab).fontSize) : 0, dts, dds, ctas };
  })()`);

  if (m.docW > m.innerW) problems.push(`${vp.name}: page scrollWidth ${m.docW} > viewport ${m.innerW}`);
  if (m.overflow.length) problems.push(`${vp.name}: elements outside the viewport: ${m.overflow.join('; ')}`);
  if (m.cellOverflow) problems.push(`${vp.name}: ${m.cellOverflow} countdown element(s) overflow their cell`);

  // NavCards grid
  const bx = m.card.boxes;
  if (vp.width < 560) {
    if (!bx.every((b) => near(b.x, bx[0].x, 1) && b.w >= 300)) problems.push(`${vp.name}: expected a single column of cards >=300px wide, got ${bx.map((b) => Math.round(b.w) + '@' + Math.round(b.x))}`);
  } else if (vp.width >= 1024) {
    if (!bx.every((b) => near(b.y, bx[0].y, 1) && near(b.w, bx[0].w, 1.5))) problems.push(`${vp.name}: expected 4 equal cards in one row, got ${bx.map((b) => Math.round(b.w) + '@' + Math.round(b.y))}`);
    if (bx[3].r > 1280 + 0.5 + (m.innerW - 1280) / 2) problems.push(`${vp.name}: cards exceed the 1280 container`);
  }
  // card type scale
  if (m.t.fs !== T.type.cardTitle.fontSize || m.t.fw !== T.type.cardTitle.fontWeight || !near(m.t.lh, T.type.cardTitle.lineHeightPx, 0.4)) problems.push(`${vp.name}: card title is ${m.t.fs}/${m.t.fw}/${m.t.lh}px, want ${T.type.cardTitle.fontSize}/${T.type.cardTitle.fontWeight}/${T.type.cardTitle.lineHeightPx}px`);
  if (m.t.pfs !== T.type.cardProse.fontSize || !near(m.t.plh, T.type.cardProse.lineHeightPx, 0.4)) problems.push(`${vp.name}: card prose is ${m.t.pfs}/${m.t.plh}px, want ${T.type.cardProse.fontSize}/${T.type.cardProse.lineHeightPx}px (R65)`);
  if (m.t.mfs < T.type.cardMetaMinPx) problems.push(`${vp.name}: card meta ${m.t.mfs}px < ${T.type.cardMetaMinPx}px`);
  if (m.t.bfs !== T.type.cardBadgePx) problems.push(`${vp.name}: card badge ${m.t.bfs}px, want ${T.type.cardBadgePx}px`);

  // ShowBand type
  if (m.dts.some((v) => v !== T.type.bandFactLabelPx)) problems.push(`${vp.name}: fact labels ${m.dts} want ${T.type.bandFactLabelPx}px`);
  if (m.dds.some((v) => v !== T.type.bandFactValuePx)) problems.push(`${vp.name}: fact values ${m.dds} want ${T.type.bandFactValuePx}px`);
  const wantNum = vp.width >= 640 ? T.type.countdownNumberPx : 34;
  if (m.val.fs !== wantNum) problems.push(`${vp.name}: countdown number ${m.val.fs}px, want ${wantNum}px`);
  if (m.labFs !== T.type.countdownLabelPx) problems.push(`${vp.name}: countdown label ${m.labFs}px, want ${T.type.countdownLabelPx}px`);
  if (!String(m.val.tnum).includes('tabular-nums')) problems.push(`${vp.name}: countdown numerals are not tabular (${m.val.tnum})`);

  // ShowBand geometry
  const cw = m.content.w;
  if (!near(m.facts.w, cw, 1.5)) problems.push(`${vp.name}: facts ${Math.round(m.facts.w)}px do not span the content block ${Math.round(cw)}px`);
  if (!near(m.cd.w, cw, 1.5)) problems.push(`${vp.name}: countdown ${Math.round(m.cd.w)}px does not span the content block ${Math.round(cw)}px`);
  if (m.cells.length !== 4 || !m.cells.every((c) => near(c.w, m.cells[0].w, 1.5))) problems.push(`${vp.name}: countdown needs 4 equal cells, got ${m.cells.map((c) => Math.round(c.w))}`);
  else { const filled = m.cells.reduce((a, c) => a + c.w, 0); if (filled < m.cd.w - 12) problems.push(`${vp.name}: countdown cells fill only ${Math.round(filled)} of ${Math.round(m.cd.w)}px (half-empty box)`); }
  if (m.ctas.some((c) => c.r > m.content.r + 1)) problems.push(`${vp.name}: a CTA extends past the content block`);
  if (!near(m.ctas[0].h, m.ctas[1].h, 1.5)) problems.push(`${vp.name}: primary (${Math.round(m.ctas[0].h)}) and secondary (${Math.round(m.ctas[1].h)}) CTA heights differ`);
  if (vp.width >= T.band.stackBelowPx) {
    if (!near(m.img.x, 0, 1)) problems.push(`${vp.name}: photo starts at x=${Math.round(m.img.x)}, must be flush to the viewport edge`);
    const ratio = m.img.w / m.bb.w;
    if (ratio < T.band.imageWidthRatio[0] || ratio > T.band.imageWidthRatio[1]) problems.push(`${vp.name}: photo is ${ratio.toFixed(3)} of the band, want ${T.band.imageWidthRatio.join('..')}`);
    if (m.bb.h < T.band.minHeightWide || m.bb.h > T.band.maxHeightWide) problems.push(`${vp.name}: band height ${Math.round(m.bb.h)}px outside ${T.band.minHeightWide}..${T.band.maxHeightWide}`);
    const rightGutter = m.innerW - m.content.r;
    if (rightGutter < T.band.contentRightGutterPx[0] || rightGutter > T.band.contentRightGutterPx[1]) problems.push(`${vp.name}: right gutter ${Math.round(rightGutter)}px outside ${T.band.contentRightGutterPx.join('..')}`);
    if (m.content.x - m.img.r < 64) problems.push(`${vp.name}: photo-to-content gap ${Math.round(m.content.x - m.img.r)}px < 64`);
    const top = m.content.y - m.bb.y, bottom = m.bb.b - m.content.b;
    if (Math.abs(top - bottom) > 8) problems.push(`${vp.name}: content not vertically centred (top gap ${Math.round(top)}, bottom gap ${Math.round(bottom)})`);
  } else {
    if (m.img.b > m.content.y + 1) problems.push(`${vp.name}: photo must sit above the content when stacked`);
    if (!near(m.img.x, 0, 1) || !near(m.img.w, m.innerW, 1.5)) problems.push(`${vp.name}: stacked photo must span the viewport (${Math.round(m.img.x)}..${Math.round(m.img.r)})`);
    const asp = m.img.w / m.img.h;
    if (asp < T.band.stackedImageAspect[0] || asp > T.band.stackedImageAspect[1]) problems.push(`${vp.name}: stacked photo aspect ${asp.toFixed(2)} outside ${T.band.stackedImageAspect.join('..')}`);
  }
  if (vp.width < 560 && !near(m.ctas[0].w, cw, 1.5)) problems.push(`${vp.name}: primary CTA ${Math.round(m.ctas[0].w)}px must be full width (${Math.round(cw)}px) on mobile`);
  await ctx.close();
}
await browser.close();
report(problems, 'no overflow, ruled grid, type scale and ShowBand geometry at 390/1280/1920');
