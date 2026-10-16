#!/usr/bin/env node
// A2: audience index (R31 #1b). Four anchors directly under the hero, labels and order from tokens.json (each label's words appear in
// components/chrome/nav-config.ts), hrefs resolve to unique group ids that each contain the existing heading, one landmark named by the
// h1 text. Geometry: 2x2 at 390 with equal cells, every chip >=44px tall and fully above the fold (bottom <= 844); one row from 1024.
// Behaviour: a real click lands the group heading below the sticky header; the index precedes every row action in tab order.
// Usage: node --import tsx/esm contracts/checks/launch-weekend/f16/check-b-index.mjs
import { readFileSync } from 'node:fs';
import { VIEWPORTS, HUB, SEL, launch, newPage, openPath, loadGolden, report } from './_lib.mjs';

const T = loadGolden('tokens.json').index;
const navSrc = readFileSync('components/chrome/nav-config.ts', 'utf8');
const problems = [];
for (const w of T.tokensThatMustAppearInNavConfig) if (!navSrc.includes(w)) problems.push(`label word "${w}" is not in nav-config.ts`);

const browser = await launch();
for (const vp of VIEWPORTS) {
  const { ctx, page } = await newPage(browser, vp);
  await openPath(page, HUB);
  const tag = `@${vp.name}`;
  const m = await page.evaluate(({ SEL }) => {
    const nav = document.querySelector(SEL.index);
    if (!nav) return null;
    const hero = document.querySelector('[data-nos-hero]').getBoundingClientRect();
    const nr = nav.getBoundingClientRect();
    const links = [...nav.querySelectorAll('a')].map((a) => { const r = a.getBoundingClientRect(); const id = (a.getAttribute('href') || '').slice(1); const t = document.getElementById(id); return { text: a.textContent.trim(), href: a.getAttribute('href'), x: r.x, y: r.y, w: r.width, h: r.height, bottom: r.bottom, targetOk: !!t, targetHeading: t ? !!t.querySelector('h2, h3') || /^H[23]$/.test(t.tagName) : false, idCount: id ? document.querySelectorAll('#' + CSS.escape(id)).length : 0 }; });
    const actions = [...document.querySelectorAll(SEL.action)];
    const firstAction = actions[0];
    return { aria: nav.getAttribute('aria-label'), tag: nav.tagName, gap: nr.top - hero.bottom, links, inWrap: !!nav.querySelector('[data-nos-wrap]'), h1: document.querySelector('h1').textContent.trim(), indexBeforeActions: !firstAction || !!(nav.compareDocumentPosition(firstAction) & Node.DOCUMENT_POSITION_FOLLOWING) };
  }, { SEL });
  if (!m) { problems.push(`${tag}: no ${SEL.index} landmark`); await ctx.close(); continue; }
  if (m.tag !== 'NAV' || m.aria !== T.ariaLabel || m.aria !== m.h1) problems.push(`${tag}: landmark must be <nav aria-label="${T.ariaLabel}"> (the h1 text), got <${m.tag}> "${m.aria}"`);
  if (m.gap < -1 || m.gap > T.heroGapMax) problems.push(`${tag}: index sits ${m.gap.toFixed(1)}px under the hero, want 0-${T.heroGapMax}`);
  if (!m.inWrap) problems.push(`${tag}: index is not inside [data-nos-wrap]`);
  if (!m.indexBeforeActions) problems.push(`${tag}: index is after the first row action in document order`);
  if (m.links.length !== 4) problems.push(`${tag}: ${m.links.length} anchors, want 4`);
  m.links.forEach((l, i) => {
    const want = T.links[i];
    if (!want) return;
    if (l.text !== want.label || l.href !== want.href) problems.push(`${tag}: anchor ${i + 1} is "${l.text}" -> ${l.href}, want "${want.label}" -> ${want.href}`);
    if (!l.targetOk || l.idCount !== 1) problems.push(`${tag}: ${l.href} resolves to ${l.idCount} elements, want exactly 1`);
    else if (!l.targetHeading) problems.push(`${tag}: ${l.href} target holds no existing group heading`);
    if (l.h < T.chipMinHeight - 0.5) problems.push(`${tag}: "${l.text}" chip is ${l.h.toFixed(1)}px tall, want >=${T.chipMinHeight}`);
  });
  if (vp.width <= T.mobileMaxWidth) {
    const ys = [...new Set(m.links.map((l) => Math.round(l.y)))];
    const xs = [...new Set(m.links.map((l) => Math.round(l.x)))];
    if (ys.length !== 2 || xs.length !== 2) problems.push(`${tag}: chips form ${xs.length} columns x ${ys.length} rows, want 2x2`);
    const ws = m.links.map((l) => l.w);
    if (Math.max(...ws) - Math.min(...ws) > 1.5) problems.push(`${tag}: 2x2 cells are not equal width (${ws.map((w) => w.toFixed(0)).join('/')})`);
    const bottom = Math.max(...m.links.map((l) => l.bottom));
    if (bottom > T.foldHeightAt390) problems.push(`${tag}: index ends at y=${bottom.toFixed(0)}, the first actionable choice must sit above the ${T.foldHeightAt390}px fold`);
  } else if (vp.width >= T.sameRowFromWidth) {
    if (new Set(m.links.map((l) => Math.round(l.y))).size !== 1) problems.push(`${tag}: chips wrap onto more than one row`);
  }
  if (vp.name === '1280') {
    const hdr = await page.evaluate(() => { const h = document.querySelector('header'); return h && getComputedStyle(h).position === 'sticky' ? h.getBoundingClientRect().height : 0; });
    for (const l of T.links) {
      await page.locator(`${SEL.index} a[href="${l.href}"]`).click();
      await page.waitForTimeout(700);
      const top = await page.evaluate((id) => { const t = document.getElementById(id); const hd = t.querySelector('h2, h3') || t; return hd.getBoundingClientRect().top; }, l.href.slice(1));
      if (top < hdr - 1) problems.push(`@1280: after clicking "${l.label}" the group heading is at y=${top.toFixed(0)}, hidden under the ${hdr.toFixed(0)}px sticky header`);
    }
  }
  await ctx.close();
}
await browser.close();
report(problems, 'four traced anchors under the hero, 2x2 above the fold at 390, one row from 1024, targets resolve clear of the header');
