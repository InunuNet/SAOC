// LG-RF carry-over (NOS Design 2026-10-25/26): when the legal pages go typographic the LG-RF gate must still hold on BOTH hosts for
// /privacy, /terms and /refunds: no eyebrow, document index entries equal the h2 count, and the legal h2 gap measures 56 (NOS Design #108:
// "every legal h2 gap measures 56 at 1440 and 390"). OPEN QUESTION for NOS Design: the exact measurement point of "gap 56" is not written
// down; this gate measures, for every h2 after the first, the distance from the previous element sibling's bottom edge to the h2's top
// edge, and also logs the first h2's distance from the hero's bottom edge. The index selector is `aside a[href^="#"]` (DocumentLayout's
// aside); 0 entries on a page that has h2s is a failure, never a silent pass (/refunds has no index in Privacy/Terms terms: NOS Design 10-26
// reports 9/9 on it, so it has one).
import { GOLDEN, launchChromium, newContext, withServer } from './_lib.mjs';

const L = GOLDEN.lgrf;
const VPS = L.viewports.map((w) => ({ name: String(w), width: w, height: w > 800 ? 900 : 844, dsf: 1 }));
const EYEBROW = '[data-page-hero-eyebrow], [data-nos-hero-eyebrow], section[data-page-hero] span.font-mono, [data-nos-hero] span.font-mono';

await withServer(6, 'LG-RF (both hosts)', async (server, c) => {
  const browser = await launchChromium();
  try {
    for (const vp of VPS) {
      const context = await newContext(browser, vp);
      const page = await context.newPage();
      for (const host of L.hosts) {
        const base = server.saoc.replace('saoc.localhost', host);
        for (const route of GOLDEN.legalRoutes) {
          const tag = `[${host} ${vp.name} ${route}]`;
          const res = await page.goto(`${base}${route}`, { waitUntil: 'load' });
          c.check(`${tag} renders (status 200)`, res?.status() === 200, `${res?.status()}`);
          await page.evaluate(() => document.fonts.ready);
          const m = await page.evaluate((eyebrowSel) => {
            const h2s = [...document.querySelectorAll('main h2.doc-h2, main h2')];
            const index = document.querySelectorAll('aside a[href^="#"]').length;
            const eyebrow = document.querySelectorAll(eyebrowSel).length;
            const gaps = h2s.slice(1).map((h) => { const prev = h.previousElementSibling; return prev ? h.getBoundingClientRect().top - prev.getBoundingClientRect().bottom : null; });
            return { h2: h2s.length, index, eyebrow, gaps };
          }, EYEBROW);
          c.check(`${tag} no eyebrow in the hero (found ${m.eyebrow})`, m.eyebrow === 0);
          c.check(`${tag} index entries ${m.index} = h2 count ${m.h2}`, m.h2 > 0 && m.index === m.h2);
          const bad = m.gaps.filter((g) => g === null || Math.abs(g - L.h2Gap) > 1);
          c.check(`${tag} every h2 gap is ${L.h2Gap} (+-1): ${bad.length} of ${m.gaps.length} off`, m.gaps.length > 0 && bad.length === 0, bad.slice(0, 3).map((g) => (g === null ? 'no sibling' : g.toFixed(1))).join(', '));
        }
      }
      await context.close();
    }
  } finally { await browser.close(); }
});
