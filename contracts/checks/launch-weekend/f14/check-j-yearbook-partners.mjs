#!/usr/bin/env node
// A-J: YearbookStrip, PartnersSection and the eyebrow pills.
//  Yearbook (1280/1920 two columns, 390 stacked): photo 4/5; copy column spans the photo top to bottom (eyebrow top and
//   last CTA bottom on the photo edges); eyebrow pill edge on the heading axis; 3 equal fact columns; CTA rest, hover (150ms,
//   lift 1px), focus-visible outline; reduced motion removes the lift.
//  Partners: parchment section; a ruled typographic list of 3 rows (no boxed cards, no images or backgrounds standing in for
//   logos); name 36px/26px serif, 16px muted prose; row is the single link; hover = accent .08 row wash, primary-800 name with a
//   brass underline, arrow +4px in brass; reduced motion removes the arrow shift; contrast incl. hover.
//  Eyebrows (all four sections): the pill is visible against its section and its edge sits on the text axis.
//  All sections: no overflow at 390/1280/1920, targets >=44px.
// Usage: BASE_URL=http://localhost:3614 node contracts/checks/launch-weekend/f14/check-j-yearbook-partners.mjs
import { VIEWPORTS, COLOR_SRC, FX_SRC, fxMatches, fxStr, fxNeutral, SETTLE_MS, launch, newPage, openHome, loadGolden, missingHooks, durationsMs, report } from './_lib.mjs';

const T = loadGolden('tokens.json');
const P = T.partners;
const problems = [];
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const S = {
  yb: '[data-home-section="yearbook"]', ybImage: '[data-yearbook-image]', ybContent: '[data-yearbook-content]', ybMeta: '[data-yearbook-meta]',
  ybCta: (t) => `[data-yearbook-cta="${t}"]`, pt: '[data-home-section="partners"]', row: '[data-partner-row]', pName: '[data-partner-name]', pArrow: '[data-partner-arrow]',
};
const browser = await launch();

for (const vp of VIEWPORTS) {
  const { ctx, page } = await newPage(browser, vp, { reducedMotion: 'no-preference' });
  await openHome(page);
  const miss = await missingHooks(page, { yb: S.yb, ybImage: S.ybImage, ybContent: S.ybContent, ybMeta: S.ybMeta, primary: S.ybCta('primary'), secondary: S.ybCta('secondary'), pt: S.pt, row: S.row, name: S.pName, arrow: S.pArrow, nav: '[data-home-section="nav-cards"]', band: '[data-home-section="show-band"]' }, vp.name);
  if (miss.length) { problems.push(...miss); await ctx.close(); continue; }

  const m = await page.evaluate(`(() => { ${COLOR_SRC}
    const q = (s, r) => (r || document).querySelector(s), qa = (s, r) => [...(r || document).querySelectorAll(s)];
    const box = (e) => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top + scrollY, w: b.width, h: b.height, r: b.right, b: b.bottom + scrollY }; };
    const cs = (e) => getComputedStyle(e);
    const yb = q(${JSON.stringify(S.yb)}), pt = q(${JSON.stringify(S.pt)});
    const overflow = []; for (const sec of [yb, pt]) for (const e of qa('*', sec)) { const b = e.getBoundingClientRect(); if (b.width === 0 && b.height === 0) continue; if (b.right > innerWidth + 0.5 || b.left < -0.5) overflow.push(e.tagName.toLowerCase()); }
    const content = q(${JSON.stringify(S.ybContent)}), img = q(${JSON.stringify(S.ybImage)});
    const eyebrow = q('.eyebrow', yb), h2 = q('h2', yb);
    const facts = qa('dl > div', q(${JSON.stringify(S.ybMeta)})).map(box);
    const ctas = ['primary', 'secondary'].map((t) => box(q('[data-yearbook-cta="' + t + '"]', yb)));
    const dts = qa('dt', yb).map((e) => parseFloat(cs(e).fontSize)), dds = qa('dd', yb).map((e) => parseFloat(cs(e).fontSize));
    const tag = qa('span', img).find((e) => e.textContent.includes('1968'));
    const rows = qa(${JSON.stringify(S.row)}, pt);
    const pr = rows.map((r) => ({ box: box(r), tag: r.tagName, bl: cs(r).borderLeftWidth, br: cs(r).borderRightWidth, bb: cs(r).borderBottomWidth, bbc: cs(r).borderBottomColor,
      name: parseFloat(cs(q(${JSON.stringify(S.pName)}, r)).fontSize), nameFamily: cs(q(${JSON.stringify(S.pName)}, r)).fontFamily, arrowHidden: q(${JSON.stringify(S.pArrow)}, r).getAttribute('aria-hidden'),
      desc: (() => { const p = [...r.querySelectorAll('span,p,div')].find((e) => !e.hasAttribute('data-partner-name') && e.children.length === 0 && e.textContent.trim().length > 40); return p ? { fs: parseFloat(cs(p).fontSize), lh: parseFloat(cs(p).lineHeight) } : null; })() }));
    const listBox = rows.length ? box(rows[0].parentElement) : null;
    const logos = qa('img, svg, picture, canvas', pt).length + qa('*', pt).filter((e) => cs(e).backgroundImage !== 'none').length;
    const eyebrows = ['nav-cards', 'show-band', 'yearbook', 'partners'].map((k) => { const s = q('[data-home-section="' + k + '"]'); const e = q('.eyebrow', s); if (!e) return { k, missing: true };
      const axisEl = q('h2', s) && k !== 'partners' ? q('h2', s) : q(${JSON.stringify(S.pName)}, s); const sb = effectiveBg(s); const eb = over(norm(cs(e).backgroundColor), sb);
      const r1 = ratio(eb, sb); return { k, edge: e.getBoundingClientRect().left, axis: axisEl.getBoundingClientRect().left, ratio: Math.round(r1 * 100) / 100, bgIsSameAsSection: r1 < 1.001 }; });
    return { docW: document.documentElement.scrollWidth, innerW: innerWidth, overflow, content: box(content), img: box(img), eyebrow: box(eyebrow), h2: box(h2), facts, ctas, dts, dds, tagFs: tag ? parseFloat(cs(tag).fontSize) : 0,
      ptBg: cs(pt).backgroundColor, ptEyebrowEdge: 0, ptBox: box(pt), ybBox: box(yb), pr, listBox, logos, eyebrows,
      listTopRule: (() => { const first = rows[0]; const prev = first.previousElementSibling; const par = first.parentElement; return [cs(par).borderTopWidth, cs(first).borderTopWidth, prev ? cs(prev).borderBottomWidth : '0px']; })() };
  })()`);

  if (m.docW > m.innerW) problems.push(`${vp.name}: page overflows horizontally`);
  if (m.overflow.length) problems.push(`${vp.name}: yearbook/partners elements outside the viewport`);
  for (const e of m.eyebrows) {
    if (e.missing) { problems.push(`${vp.name}: no .eyebrow in ${e.k}`); continue; }
    if (!near(e.edge, e.axis, 1.5)) problems.push(`${vp.name} ${e.k}: eyebrow pill edge ${Math.round(e.edge)} is off the text axis ${Math.round(e.axis)}`);
    if (e.ratio < T.eyebrow.minLumRatio) problems.push(`${vp.name} ${e.k}: eyebrow pill is invisible against its section (contrast ${e.ratio}:1, need ${T.eyebrow.minLumRatio})`);
  }
  // Yearbook geometry
  const asp = m.img.w / m.img.h;
  if (vp.width >= T.yearbook.stackBelowPx) {
    if (asp < T.yearbook.photoAspect[0] || asp > T.yearbook.photoAspect[1]) problems.push(`${vp.name}: yearbook photo aspect ${asp.toFixed(2)} not 4/5`);
    if (!near(m.eyebrow.y, m.img.y, T.yearbook.alignTolPx)) problems.push(`${vp.name}: copy column top (${Math.round(m.eyebrow.y)}) is not on the photo top (${Math.round(m.img.y)})`);
    const lastBottom = Math.max(...m.ctas.map((c) => c.b));
    if (!near(lastBottom, m.img.b, T.yearbook.alignTolPx)) problems.push(`${vp.name}: CTA bottom (${Math.round(lastBottom)}) is not on the photo bottom (${Math.round(m.img.b)})`);
    if (m.img.y - m.ybBox.y !== m.ybBox.b - m.img.b && !near(m.img.y - m.ybBox.y, m.ybBox.b - m.img.b, 2)) problems.push(`${vp.name}: yearbook section padding is asymmetric around the photo`);
    if (!(m.img.x > m.content.r)) problems.push(`${vp.name}: photo must sit right of the copy`);
  } else {
    if (m.img.y < m.content.b - 1 && m.img.y > m.content.y) problems.push(`${vp.name}: stacked photo overlaps the copy`);
  }
  if (m.facts.length !== 3 || !m.facts.every((f) => near(f.w, m.facts[0].w, 1.5))) problems.push(`${vp.name}: yearbook facts need 3 equal columns, got ${m.facts.map((f) => Math.round(f.w))}`);
  if (m.dts.some((v) => v !== T.yearbook.factLabelPx)) problems.push(`${vp.name}: yearbook fact labels ${m.dts}, want ${T.yearbook.factLabelPx}px`);
  if (m.dds.some((v) => v !== T.yearbook.factValuePx)) problems.push(`${vp.name}: yearbook fact values ${m.dds}, want ${T.yearbook.factValuePx}px`);
  if (m.tagFs !== T.yearbook.tagPx) problems.push(`${vp.name}: EST. 1968 tag ${m.tagFs}px, want ${T.yearbook.tagPx}px`);
  m.ctas.forEach((c, i) => { if (c.h < 44 || c.w < 44) problems.push(`${vp.name}: yearbook CTA ${i + 1} ${Math.round(c.w)}x${Math.round(c.h)} < 44`); });
  // Partners
  if (m.pr.length !== P.rows) problems.push(`${vp.name}: partners has ${m.pr.length} rows, want ${P.rows}`);
  if (m.logos) problems.push(`${vp.name}: partners section contains ${m.logos} image/svg/background element(s); there are NO partner logos and none may be drawn or faked`);
  const same = await page.evaluate(`(() => { ${COLOR_SRC} return same(${JSON.stringify(m.ptBg)}, ${JSON.stringify(P.sectionBg)}); })()`);
  if (!same) problems.push(`${vp.name}: partners section bg ${m.ptBg} must be parchment (alternating rhythm after the bone yearbook)`);
  m.pr.forEach((r, i) => {
    const tag = `${vp.name} partner row ${i + 1}`;
    if (r.bl !== '0px' || r.br !== '0px') problems.push(`${tag}: boxed (side borders ${r.bl}/${r.br}); the partners are a ruled list, not cards`);
    if (r.bb !== '1px') problems.push(`${tag}: needs a 1px bottom rule (${r.bb})`);
    if (r.box.h < P.minRowPx) problems.push(`${tag}: ${Math.round(r.box.h)}px tall < 44`);
    if (!/Crimson|serif|Georgia/i.test(r.nameFamily)) problems.push(`${tag}: name is not set in the serif (${r.nameFamily})`);
    const wantName = vp.width >= 1100 ? P.namePxWide : (vp.width < 560 ? P.namePxNarrow : null);
    if (wantName && r.name !== wantName) problems.push(`${tag}: name ${r.name}px, want ${wantName}px`);
    if (r.arrowHidden !== 'true') problems.push(`${tag}: arrow must be aria-hidden`);
    if (!r.desc || r.desc.fs !== P.descPx) problems.push(`${tag}: prose ${r.desc && r.desc.fs}px, want ${P.descPx}px`);
  });
  if (m.listBox) m.pr.forEach((r, i) => { if (!near(r.box.x, m.listBox.x, 1) || !near(r.box.w, m.listBox.w, 1)) problems.push(`${vp.name} partner row ${i + 1}: its rule (${Math.round(r.box.x)}..${Math.round(r.box.r)}) does not share edges with the list's top rule (${Math.round(m.listBox.x)}..${Math.round(m.listBox.r)})`); });
  if (vp.width >= 1100 && !m.pr.every((r) => near(r.box.w, m.pr[0].box.w, 1))) problems.push(`${vp.name}: partner rows differ in width`);
  await ctx.close();
}

// States at 1280: yearbook CTAs and partner rows, rest/hover/focus, then reduced motion.
for (const reduced of ['no-preference', 'reduce']) {
  const { ctx, page } = await newPage(browser, VIEWPORTS[1], { reducedMotion: reduced });
  await openHome(page);
  const tag0 = `1280 ${reduced}`;
  const readCta = (t) => page.evaluate(`(() => { ${COLOR_SRC} ${FX_SRC} const el = document.querySelector(${JSON.stringify(S.ybCta('x'))}.replace('x', ${JSON.stringify(t)})); const c = getComputedStyle(el);
    const bg = effectiveBg(el); const fg = over(norm(c.color), bg);
    return { fx: fx(c), bg: c.backgroundColor, color: c.color, border: c.borderTopColor, tDur: c.transitionDuration, outW: c.outlineWidth, outS: c.outlineStyle, outC: c.outlineColor, outO: c.outlineOffset, cr: ratio(fg, bg) }; })()`);
  const colorIs = (got, want) => page.evaluate(`(() => { ${COLOR_SRC} return same(${JSON.stringify(got)}, ${JSON.stringify(want)}); })()`);
  for (const t of ['primary', 'secondary']) {
    const spec = T.yearbook[t]; const tag = `${tag0} yearbook ${t}`; const loc = page.locator(S.ybCta(t));
    await loc.scrollIntoViewIfNeeded(); await page.mouse.move(2, 2); await page.waitForTimeout(SETTLE_MS);
    const rest = await readCta(t);
    if (reduced === 'no-preference') {
      if (!(await colorIs(rest.bg, spec.bg))) problems.push(`${tag} rest bg ${rest.bg}`);
      if (!(await colorIs(rest.color, spec.color))) problems.push(`${tag} rest text ${rest.color}`);
      if (t === 'secondary' && !(await colorIs(rest.border, spec.border))) problems.push(`${tag} rest border ${rest.border}`);
      if (durationsMs(rest.tDur).some((x) => Math.abs(x - 150) > 0.5)) problems.push(`${tag} transition-duration ${rest.tDur} must be 150ms`);
    }
    await loc.hover(); await page.waitForTimeout(SETTLE_MS);
    const h = await readCta(t);
    if (reduced === 'no-preference') {
      if (!fxMatches(h.fx, spec.hoverFx)) problems.push(`${tag} hover transform ${fxStr(h.fx)}, want ${JSON.stringify(spec.hoverFx)}`);
      if (!(await colorIs(h.bg, spec.hoverBg))) problems.push(`${tag} hover bg ${h.bg}`);
      if (spec.hoverColor && !(await colorIs(h.color, spec.hoverColor))) problems.push(`${tag} hover text ${h.color}`);
    } else {
      if (!fxNeutral(h.fx)) problems.push(`${tag} hover (reduce) must not transform: ${fxStr(h.fx)}`);
      if (h.bg === rest.bg && h.color === rest.color) problems.push(`${tag} hover (reduce): no colour change survived`);
    }
    if (h.cr < 4.5) problems.push(`${tag} hover text contrast ${h.cr.toFixed(2)}:1 < 4.5`);
    await page.mouse.move(2, 2);
    await page.evaluate(() => document.activeElement && document.activeElement.blur()); await page.evaluate(() => window.scrollTo(0, 0));
    let focused = false;
    for (let n = 0; n < 200 && !focused; n++) { await page.keyboard.press('Tab'); focused = await page.evaluate(`document.activeElement === document.querySelector(${JSON.stringify(S.ybCta(t))})`); }
    if (!focused) { problems.push(`${tag}: not reachable by Tab`); continue; }
    await page.waitForTimeout(SETTLE_MS);
    const f = await readCta(t);
    if (f.outS !== 'solid' || f.outW !== T.yearbook.focusOutlineWidth || f.outO !== T.yearbook.focusOutlineOffset || !(await colorIs(f.outC, T.yearbook.focusOutlineColor))) problems.push(`${tag} focus-visible outline wrong (${f.outS} ${f.outW} ${f.outO} ${f.outC})`);
    if (reduced === 'reduce' && !fxNeutral(f.fx)) problems.push(`${tag} focus (reduce) must not transform`);
  }
  // partner rows
  const nrows = await page.locator(S.row).count();
  for (let i = 0; i < nrows; i++) {
    const tag = `${tag0} partner row ${i + 1}`; const row = page.locator(S.row).nth(i);
    const read = () => page.evaluate(`(() => { ${COLOR_SRC} ${FX_SRC} const r = document.querySelectorAll(${JSON.stringify(S.row)})[${i}]; const n = r.querySelector(${JSON.stringify(S.pName)}), a = r.querySelector(${JSON.stringify(S.pArrow)});
      const bg = effectiveBg(r); const nc = over(norm(getComputedStyle(n).color), bg);
      const desc = [...r.querySelectorAll('*')].find((e) => !e.hasAttribute('data-partner-name') && e.children.length === 0 && e.textContent.trim().length > 40); const dc = over(norm(getComputedStyle(desc).color), bg);
      return { bg: getComputedStyle(r).backgroundColor, nameColor: getComputedStyle(n).color, line: getComputedStyle(n).textDecorationLine, lineColor: getComputedStyle(n).textDecorationColor, arrowFx: fx(getComputedStyle(a)), arrowColor: getComputedStyle(a).color,
        nameDur: getComputedStyle(n).transitionDuration, rowDur: getComputedStyle(r).transitionDuration, arrowDur: getComputedStyle(a).transitionDuration, nameCr: ratio(nc, bg), descCr: ratio(dc, bg), outW: getComputedStyle(r).outlineWidth, outS: getComputedStyle(r).outlineStyle }; })()`);
    await row.scrollIntoViewIfNeeded(); await page.mouse.move(2, 2); await page.waitForTimeout(SETTLE_MS);
    const rest = await read();
    await row.hover(); await page.waitForTimeout(SETTLE_MS);
    const h = await read();
    if (!(await colorIs(h.nameColor, P.nameHoverColor))) problems.push(`${tag} hover name colour ${h.nameColor}`);
    if (!h.line.includes('underline') || !(await colorIs(h.lineColor, P.nameUnderlineHover))) problems.push(`${tag} hover: brass underline missing (${h.line} ${h.lineColor})`);
    if (!(await colorIs(h.bg, P.rowHoverBg, 3))) problems.push(`${tag} hover row wash ${h.bg}`);
    if (!(await colorIs(h.arrowColor, P.arrowHoverColor))) problems.push(`${tag} hover arrow colour ${h.arrowColor}`);
    if (reduced === 'no-preference') {
      if (!fxMatches(h.arrowFx, P.arrowHoverFx)) problems.push(`${tag} hover arrow ${fxStr(h.arrowFx)}, want ${JSON.stringify(P.arrowHoverFx)}`);
      for (const [k, v] of [['row', h.rowDur], ['name', h.nameDur], ['arrow', h.arrowDur]]) if (durationsMs(v).some((x) => Math.abs(x - 150) > 0.5)) problems.push(`${tag} ${k} transition-duration ${v} must be 150ms`);
      if (!fxMatches(rest.arrowFx, {})) problems.push(`${tag} rest arrow not neutral`);
      if (!(await colorIs(rest.nameColor, P.nameRestColor))) problems.push(`${tag} rest name colour ${rest.nameColor}`);
    } else if (!fxNeutral(h.arrowFx)) problems.push(`${tag} hover (reduce): arrow still shifts ${fxStr(h.arrowFx)}`);
    if (h.nameCr < 4.5 || h.descCr < 4.5) problems.push(`${tag} hover contrast name ${h.nameCr.toFixed(2)} prose ${h.descCr.toFixed(2)} < 4.5`);
    await page.mouse.move(2, 2);
    await page.evaluate(() => document.activeElement && document.activeElement.blur()); await page.evaluate(() => window.scrollTo(0, 0));
    let focused = false;
    for (let n = 0; n < 220 && !focused; n++) { await page.keyboard.press('Tab'); focused = await page.evaluate(`document.activeElement === document.querySelectorAll(${JSON.stringify(S.row)})[${i}]`); }
    if (!focused) { problems.push(`${tag}: not reachable by Tab`); continue; }
    await page.waitForTimeout(SETTLE_MS);
    const f = await read();
    if (f.outS !== 'solid' || f.outW !== '2px') problems.push(`${tag} focus-visible outline missing (${f.outS} ${f.outW})`);
    if (!f.line.includes('underline')) problems.push(`${tag} focus-visible must equal hover (underline missing)`);
  }
  await ctx.close();
}
await browser.close();
report(problems, 'yearbook aligned to its photo with states, partners as a ruled typographic list with states and no logos, eyebrow pills visible and on axis, no overflow at 390/1280/1920');
