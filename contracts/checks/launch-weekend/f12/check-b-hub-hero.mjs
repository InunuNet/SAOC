#!/usr/bin/env node
// F12-A3 - R68 hub hero, measured on a production build at 1280, 1920 and 390 (plus 1024 and 1023 for the facts grid and the stack).
import { main, openPage, withBrowser, VP, V, HUB, near, norm, px, trackCount } from './_lib.mjs';

const H = V.hubHero;

function measure() {
  const chFn = (el, n) => {
    const c = getComputedStyle(el);
    const d = document.createElement('div');
    d.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;width:${n}ch;font-family:${c.fontFamily};font-size:${c.fontSize};font-weight:${c.fontWeight};font-style:${c.fontStyle};letter-spacing:${c.letterSpacing};`;
    el.parentElement.appendChild(d);
    const w = d.getBoundingClientRect().width;
    d.remove();
    return w;
  };
  const q = (s, r = document) => r.querySelector(s);
  const cs = (e) => getComputedStyle(e);
  const top = (e) => e.getBoundingClientRect().top + scrollY;
  const bottom = (e) => e.getBoundingClientRect().bottom + scrollY;
  const hero = q('[data-nos-hero="hub"]');
  if (!hero) return { error: 'no hub hero' };
  const copy = q('.nos-hero-copy', hero), title = q('.nos-hero-title', hero), body = q('.nos-hero-body', hero), lede = q('.nos-hero-lede', hero);
  const facts = q('.nos-hero-facts', hero), actions = q('.nos-hero-actions', hero), cd = q('[data-nos-hero-text="countdown-opens-in"]', hero);
  const price = q('[data-nos-hero-text="price"]', hero);
  if (!(copy && title && body && facts && actions && cd)) return { error: 'hero parts missing (copy/title/body/facts/actions/countdown)' };
  // wrapper = lowest common ancestor of the actions and the countdown label
  let wrap = actions;
  while (wrap && !wrap.contains(cd)) wrap = wrap.parentElement;
  const itemOf = (el) => { let e = el; while (e && e.parentElement !== wrap) e = e.parentElement; return e; };
  const i1 = itemOf(actions), i2 = itemOf(cd);
  const r = (e) => { const b = e.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top + scrollY, bottom: b.bottom + scrollY, width: b.width, height: b.height }; };
  const ccs = cs(copy), tcs = cs(title), bcs = cs(body), fcs = cs(facts), wcs = cs(wrap);
  const range = document.createRange();
  range.selectNodeContents(title);
  const tops = new Set([...range.getClientRects()].map((x) => Math.round(x.top)));
  const buttons = [...hero.querySelectorAll('[data-nos-hero-button]')].map((a) => ({ text: (a.textContent ?? '').replace(/\s+/g, ' ').trim(), bottom: bottom(a) }));
  const copyBox = r(copy);
  const copyPadL = parseFloat(ccs.paddingLeft), copyPadR = parseFloat(ccs.paddingRight);
  return {
    vw: innerWidth,
    h1: (title.textContent ?? '').replace(/\s+/g, ' ').trim(),
    h1Lines: tops.size,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    copy: { justify: ccs.justifyContent, padT: parseFloat(ccs.paddingTop), padB: parseFloat(ccs.paddingBottom), gap: ccs.rowGap },
    title: { maxWidth: tcs.maxWidth, size: parseFloat(tcs.fontSize), lh: tcs.lineHeight, ls: parseFloat(tcs.letterSpacing), wrap: tcs.textWrapStyle || tcs.textWrap },
    body: { maxWidth: bcs.maxWidth, rowGap: bcs.rowGap },
    lede: lede ? { maxWidth: parseFloat(cs(lede).maxWidth), ch46: chFn(lede, 46) } : null,
    facts: { cols: fcs.gridTemplateColumns, colGap: fcs.columnGap, rowGap: fcs.rowGap, rect: r(facts), tops: [...facts.children].map((c) => Math.round(top(c))) },
    copyContentRight: copyBox.right - copyPadR, copyContentLeft: copyBox.left + copyPadL,
    row: { display: wcs.display, align: wcs.alignItems, justify: wcs.justifyContent, gap: wcs.columnGap, rowGap: wcs.rowGap, wrap: wcs.flexWrap, kids: wrap.children.length, parentIsBody: wrap.parentElement === body, isBody: wrap === body, i1: r(i1), i2: r(i2), box: r(wrap) },
    tops: { actions: top(actions), price: price ? top(price) : null, cd: top(cd), facts: top(facts) },
    buttons,
  };
}

await main('F12-A3 hub hero', async (r) => {
  await withBrowser(async (browser) => {
    const cases = [['desktop', VP.desktop], ['wide', VP.wide], ['phone', VP.phone], ['1024', { width: 1024, height: 768 }], ['1023', { width: 1023, height: 768 }]];
    const { ctx, page, status } = await openPage(browser, VP.desktop, HUB);
    if (status !== 200) { r.fail(`${HUB}: HTTP ${status}`); await ctx.close(); return; }
    for (const [name, vp] of cases) {
      await page.setViewportSize(vp);
      await page.waitForTimeout(250);
      const m = await page.evaluate(measure);
      const tag = `@${vp.width}`;
      if (m.error) { r.fail(`${tag}: ${m.error}`); continue; }
      const desk = vp.width >= H.minWidthForGeometry;
      if (m.h1 !== H.h1) r.fail(`${tag}: h1 is "${m.h1}", want exactly "${H.h1}"`);
      if (m.overflowX > 1) r.fail(`${tag}: horizontal overflow ${m.overflowX}px`);
      if (m.row.isBody || !m.row.kids || m.row.kids !== 2) r.fail(`${tag}: actions and countdown are not wrapped in one two-child row (wrapper is body: ${m.row.isBody}, children: ${m.row.kids})`);
      if (m.row.display !== 'flex' || m.row.align !== 'flex-end' || m.row.justify !== 'space-between' || px(m.row.gap) !== H.actionsRow.gap || m.row.wrap !== 'wrap') {
        r.fail(`${tag}: row is ${m.row.display}/${m.row.align}/${m.row.justify}/gap ${m.row.gap}/${m.row.wrap}, want flex/flex-end/space-between/48px/wrap`);
      }
      if (desk) {
        const c = m.copy, t = m.title;
        if (c.justify !== 'center') r.fail(`${tag}: .nos-hero-copy justify-content ${c.justify}, want center`);
        if (!near(c.padT, H.copy.paddingTop, 0.5) || !near(c.padB, H.copy.paddingBottom, 0.5)) r.fail(`${tag}: copy padding ${c.padT}/${c.padB}, want ${H.copy.paddingTop}/${H.copy.paddingBottom}`);
        if (px(c.gap) !== H.copy.gap) r.fail(`${tag}: copy gap ${c.gap}, want ${H.copy.gap}px`);
        if (t.maxWidth !== 'none') r.fail(`${tag}: title max-width ${t.maxWidth}, want none`);
        const wantSize = Math.min(H.title.fontSizeMaxPx, Math.max(H.title.fontSizeMinPx, (H.title.fontSizeVw / 100) * vp.width));
        if (!near(t.size, wantSize, 0.6)) r.fail(`${tag}: title font-size ${t.size}px, want clamp(52px,4.9vw,96px) = ${wantSize.toFixed(2)}px`);
        if (!(near(px(t.lh), t.size, 0.5) || t.lh === '1')) r.fail(`${tag}: title line-height ${t.lh}, want 1`);
        if (!near(t.ls, H.title.letterSpacingEm * t.size, 0.15)) r.fail(`${tag}: title letter-spacing ${t.ls}px, want -0.01em = ${(H.title.letterSpacingEm * t.size).toFixed(2)}px`);
        if (t.wrap !== 'balance') r.fail(`${tag}: title text-wrap ${t.wrap}, want balance`);
        if (vp.width >= H.title.oneLineFromWidth && m.h1Lines !== 1) r.fail(`${tag}: h1 wraps to ${m.h1Lines} lines, want one at >=${H.title.oneLineFromWidth}`);
        if (px(m.body.maxWidth) !== H.body.maxWidth || px(m.body.rowGap) !== H.body.rowGap) r.fail(`${tag}: body max-width/row-gap ${m.body.maxWidth}/${m.body.rowGap}, want 760px/32px`);
        if (!m.lede || !near(m.lede.maxWidth, m.lede.ch46, 1.5)) r.fail(`${tag}: lede max-width ${m.lede?.maxWidth}px, want 46ch = ${m.lede?.ch46.toFixed(1)}px`);
        if (trackCount(m.facts.cols) !== H.facts.desktopColumns) r.fail(`${tag}: facts grid has ${trackCount(m.facts.cols)} columns (${m.facts.cols}), want 4`);
        if (px(m.facts.colGap) !== H.facts.desktopColumnGap || px(m.facts.rowGap) !== H.facts.desktopRowGap) r.fail(`${tag}: facts gaps row ${m.facts.rowGap} col ${m.facts.colGap}, want 0 / 40px`);
        if (new Set(m.facts.tops).size !== 1) r.fail(`${tag}: facts are not on one row (tops ${m.facts.tops.join(',')})`);
        if (m.facts.rect.right > m.copyContentRight + 1) r.fail(`${tag}: facts overflow the hero copy box (${m.facts.rect.right.toFixed(0)} > ${m.copyContentRight.toFixed(0)})`);
        if (m.row.parentIsBody === false) r.fail(`${tag}: the actions row is not a direct child of .nos-hero-body`);
        // one row, side by side, bottoms aligned, countdown pushed to the right edge (space-between)
        if (!(m.row.i2.left >= m.row.i1.right - 0.5)) r.fail(`${tag}: countdown is not beside the actions (i2.left ${m.row.i2.left.toFixed(0)} < i1.right ${m.row.i1.right.toFixed(0)})`);
        if (!near(m.row.i1.bottom, m.row.i2.bottom, 1.5)) r.fail(`${tag}: row items are not bottom-aligned (${m.row.i1.bottom.toFixed(0)} vs ${m.row.i2.bottom.toFixed(0)})`);
        if (!near(m.row.i2.right, m.row.box.right, 1.5)) r.fail(`${tag}: countdown is not at the row's right edge (space-between)`);
        if (m.facts.rect.top < m.row.box.bottom - 0.5) r.fail(`${tag}: facts sit above the actions row`);
      } else {
        if (trackCount(m.facts.cols) !== H.facts.belowDesktopColumns) r.fail(`${tag}: facts grid has ${trackCount(m.facts.cols)} columns below 1024, want 2`);
      }
      if (vp.width < H.actionsRow.stackBelow) {
        if (!(m.row.i2.top >= m.row.i1.bottom - 1)) r.fail(`${tag}: under 640 the countdown must stack below the actions`);
        const order = [m.tops.actions, m.tops.price, m.tops.cd, m.tops.facts].filter((x) => x !== null);
        if (order.some((v, i) => i && v < order[i - 1])) r.fail(`${tag}: stack order is not actions, price, countdown, facts (${order.map((x) => x.toFixed(0)).join(' < ')})`);
        const px700 = Math.min(3.4 * 16, Math.max(2.8 * 16, 0.12 * vp.width));
        if (!near(m.title.size, px700, 1)) r.fail(`${tag}: phone h1 ${m.title.size}px, want F3's clamp(2.8rem,12vw,3.4rem) = ${px700.toFixed(1)}px (unchanged)`);
      }
      const labels = m.buttons.map((b) => b.text.toLowerCase());
      if (labels[0] !== 'tickets' || labels[1] !== 'plan your visit' || labels.length !== 2) r.fail(`${tag}: hero buttons are [${labels.join(', ')}], want [tickets, plan your visit] (R67)`);
      if (name === 'desktop' && m.buttons.some((b) => b.bottom > vp.height)) r.fail(`${tag}: a hero CTA sits below the fold (${vp.width}x${vp.height})`);
    }
    await ctx.close();
  });
});
