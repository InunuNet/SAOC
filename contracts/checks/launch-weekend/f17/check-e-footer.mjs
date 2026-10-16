#!/usr/bin/env node
// F17-A5 (R74-5): the footer WOSA link never leaves its arrow alone on a line. Both footers (SAOC footer on /, NOS footer on /national-show).
//  STATIC   components/chrome/footer-data.ts: FOOTER_WOSA.linkLabel keeps its words ("Visit Wild Orchids of Southern Africa") and the arrow is glued to the last word by a
//           no-break space (U+00A0) (or the label holds a nowrap span, which the runtime sweep also proves); href and heading unchanged.
//  RUNTIME  at 320, 360, 390, 430, 600, 768, 1024, 1280, 1440, 1920: the arrow's line box also holds at least one letter of "Africa" (never its own line), for both footers;
//           the link text, whitespace-collapsed, still reads "Visit Wild Orchids of Southern Africa →"; the link is still target=_blank rel=noopener noreferrer.
// Usage: NOS_REUSE_SERVER=1 NOS_BASE=http://localhost:3662 node --import tsx/esm contracts/checks/launch-weekend/f17/check-e-footer.mjs
import { readFileSync } from 'node:fs';
import { main, openPage, withBrowser, T, norm } from './_lib.mjs';
import { FOOTER_WOSA } from '../../../../components/chrome/footer-data.ts';

const WIDTHS = [320, 360, 390, 430, 600, 768, 1024, 1280, 1440, 1920];
const WORDS = 'Visit Wild Orchids of Southern Africa';

function lineOfArrow([href, arrow]) {
  const a = [...document.querySelectorAll('footer a, #nf a')].find((x) => x.getAttribute('href') === href);
  if (!a) return { error: `no footer link to ${href}` };
  const tw = document.createTreeWalker(a, NodeFilter.SHOW_TEXT);
  let node = null, at = -1;
  for (let n = tw.nextNode(); n; n = tw.nextNode()) { const i = n.textContent.indexOf(arrow); if (i !== -1) { node = n; at = i; } }
  if (!node) return { error: 'no arrow text node in the link' };
  const rect = (s, e) => { const r = document.createRange(); r.setStart(node, s); r.setEnd(node, e); return [...r.getClientRects()].map((x) => Math.round(x.top)); };
  const arrowTops = rect(at, at + arrow.length);
  const africaEnd = node.textContent.lastIndexOf('Africa', at) + 'Africa'.length;
  const africaTops = africaEnd >= 'Africa'.length ? rect(africaEnd - 1, africaEnd) : [];
  const cs = getComputedStyle(a);
  return { text: a.textContent, norm: (a.textContent ?? '').replace(/\s+/g, ' ').trim(), arrowTops, africaTops, target: a.getAttribute('target'), rel: a.getAttribute('rel'), width: a.getBoundingClientRect().width, ws: cs.whiteSpace };
}

await main('F17-A5 footer arrow', async (r) => {
  const src = readFileSync('components/chrome/footer-data.ts', 'utf8');
  if (FOOTER_WOSA.href !== T.footer.wosaHref) r.fail(`FOOTER_WOSA.href is ${FOOTER_WOSA.href}`);
  if (FOOTER_WOSA.heading !== 'Looking for wild orchids?') r.fail(`FOOTER_WOSA.heading is "${FOOTER_WOSA.heading}"`);
  if (norm(FOOTER_WOSA.linkLabel) !== `${WORDS} ${T.footer.arrow}`) r.fail(`FOOTER_WOSA.linkLabel reads "${FOOTER_WOSA.linkLabel}": the words must stay "${WORDS} ${T.footer.arrow}"`);
  const glued = FOOTER_WOSA.linkLabel.endsWith(`Africa${T.footer.nbsp}${T.footer.arrow}`);
  if (!glued && !/nowrap/.test(src)) r.fail('the arrow is not glued to "Africa" by a no-break space and footer-data holds no nowrap alternative');
  await withBrowser(async (browser) => {
    for (const route of ['/', '/national-show']) {
      const { ctx, page, status } = await openPage(browser, { width: 1280, height: 800 }, route);
      if (status !== 200) { r.fail(`${route}: HTTP ${status}`); await ctx.close(); continue; }
      for (const w of WIDTHS) {
        await page.setViewportSize({ width: w, height: 900 });
        await page.waitForTimeout(120);
        const m = await page.evaluate(lineOfArrow, [T.footer.wosaHref, T.footer.arrow]);
        const tag = `${route} @${w}`;
        if (m.error) { r.fail(`${tag}: ${m.error}`); continue; }
        if (m.norm !== `${WORDS} ${T.footer.arrow}`) r.fail(`${tag}: link text "${m.norm}"`);
        if (m.target !== '_blank' || !/noopener/.test(m.rel ?? '') || !/noreferrer/.test(m.rel ?? '')) r.fail(`${tag}: link lost target=_blank rel=noopener noreferrer`);
        const arrowTop = m.arrowTops[0];
        if (!m.africaTops.length || arrowTop === undefined) { r.fail(`${tag}: could not measure the arrow line`); continue; }
        if (!m.africaTops.some((t) => Math.abs(t - arrowTop) <= 3)) r.fail(`${tag}: the arrow sits on its own line (arrow top ${arrowTop}, "Africa" tops ${m.africaTops.join(',')}), link ${m.width.toFixed(0)}px wide`);
      }
      await ctx.close();
    }
  });
});
