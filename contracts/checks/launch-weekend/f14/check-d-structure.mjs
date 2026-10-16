#!/usr/bin/env node
// A-D: structure and targets at 390, 1280, 1920. Four cards, each the ONE link (the card is the anchor; it contains no
// nested interactive element; the section has exactly 4 anchors); no card carries an aria-label that overrides its
// visible name; every F14 interactive target is >=44x44 CSS px; the three
// ShowBand CTAs are in the ruled order with the ruled hrefs and names.
// Usage: BASE_URL=http://localhost:3614 node contracts/checks/launch-weekend/f14/check-d-structure.mjs
import { VIEWPORTS, SEL, launch, newPage, openHome, loadGolden, missingHooks, report } from './_lib.mjs';

const T = loadGolden('tokens.json');
const problems = [];
const browser = await launch();
for (const vp of VIEWPORTS) {
  const { ctx, page } = await newPage(browser, vp);
  await openHome(page);
  const miss = await missingHooks(page, { navSection: SEL.navSection, navCard: SEL.navCard, band: SEL.band, primary: SEL.cta('primary'), secondary: SEL.cta('secondary'), tertiary: SEL.cta('tertiary') }, `${vp.name}`);
  if (miss.length) { problems.push(...miss); await ctx.close(); continue; }
  const r = await page.evaluate(`(() => {
    const sec = document.querySelector(${JSON.stringify(SEL.navSection)});
    const cards = [...sec.querySelectorAll(${JSON.stringify(SEL.navCard)})];
    const out = { anchors: sec.querySelectorAll('a').length, buttons: sec.querySelectorAll('button').length, cards: cards.map((c) => ({
      tag: c.tagName, nested: c.querySelectorAll('a,button,input,select,textarea,[tabindex],[role=link],[role=button]').length,
      ariaLabel: c.getAttribute('aria-label'), name: c.textContent.replace(/\\s+/g, ' ').trim(), href: c.getAttribute('href'),
      h3: c.querySelector('h3') ? c.querySelector('h3').textContent.trim() : '', box: (() => { const b = c.getBoundingClientRect(); return [b.width, b.height]; })() })) };
    const band = document.querySelector(${JSON.stringify(SEL.band)});
    out.ctas = ['primary', 'secondary', 'tertiary'].map((t) => { const e = band.querySelector('[data-show-band-cta="' + t + '"]'); const b = e.getBoundingClientRect(); return { t, tag: e.tagName, href: e.getAttribute('href'), name: e.textContent.replace(/\\s+/g, ' ').trim(), w: b.width, h: b.height, top: b.top + scrollY, left: b.left }; });
    out.bandAnchors = [...band.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    return out;
  })()`);
  if (r.anchors !== 4) problems.push(`${vp.name}: NavCards section has ${r.anchors} anchors, want exactly 4 (one per card)`);
  if (r.buttons) problems.push(`${vp.name}: NavCards section contains ${r.buttons} <button>`);
  r.cards.forEach((c, i) => {
    if (c.tag !== 'A') problems.push(`${vp.name} card ${i + 1}: root is <${c.tag}>, must be the anchor`);
    if (c.nested) problems.push(`${vp.name} card ${i + 1}: ${c.nested} nested interactive element(s)`);
    if (c.ariaLabel) problems.push(`${vp.name} card ${i + 1}: aria-label "${c.ariaLabel}" overrides the visible name`);
    if (!c.h3) problems.push(`${vp.name} card ${i + 1}: title is not an h3`);
    if (c.box[0] < 44 || c.box[1] < 44) problems.push(`${vp.name} card ${i + 1}: target ${c.box.map(Math.round)} < 44x44`);
  });
  r.ctas.forEach((c, i) => {
    const want = T.band.ctaOrder[i];
    if (c.tag !== 'A') problems.push(`${vp.name} cta ${c.t}: <${c.tag}>, must be an anchor`);
    if (c.href !== want.href) problems.push(`${vp.name} cta ${c.t}: href ${c.href}, want ${want.href}`);
    if (c.name !== want.name) problems.push(`${vp.name} cta ${c.t}: name "${c.name}", want "${want.name}"`);
    if (c.h < T.band.ctaMinPx || c.w < T.band.ctaMinPx) problems.push(`${vp.name} cta ${c.t}: target ${Math.round(c.w)}x${Math.round(c.h)} < 44x44`);
  });
  const hrefs = r.bandAnchors.join(',');
  if (hrefs !== T.band.ctaOrder.map((o) => o.href).join(',')) problems.push(`${vp.name}: ShowBand anchors in DOM order are [${hrefs}], want the ruled order`);
  await ctx.close();
}
await browser.close();
report(problems, 'one link per card, no nesting, ruled CTA order/hrefs/names, every target >=44px at 390/1280/1920');
