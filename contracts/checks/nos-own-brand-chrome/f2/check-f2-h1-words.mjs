// F2-H4 (ruling 2026-10-15 Q3): at 360 and 375 no h1 word box exceeds the content width ("International" is the worst case),
// no hyphenation / break-all on the h1, and scrollWidth == clientWidth. All 17 routes.
import { NOS_ROUTES, main, openPage, withBrowser } from './_f2lib.mjs';

const GUTTER = 16; // clamp(16px, 4vw, 48px) at <=400px

await main('F2-H4 h1-words', async (r) => {
  await withBrowser(async (browser) => {
    for (const route of NOS_ROUTES) {
      for (const width of [360, 375]) {
        const { ctx, page } = await openPage(browser, { width, height: 800 }, route);
        const m = await page.evaluate(() => {
          const h1 = document.querySelector('main h1');
          if (!h1) return null;
          const cs = getComputedStyle(h1);
          const words = [];
          const w = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT);
          for (let n = w.nextNode(); n; n = w.nextNode()) {
            const re = /\S+/g;
            for (let x = re.exec(n.textContent); x; x = re.exec(n.textContent)) {
              const range = document.createRange();
              range.setStart(n, x.index);
              range.setEnd(n, x.index + x[0].length);
              const rects = [...range.getClientRects()];
              // a word broken across lines yields several rects: that is itself a failure
              words.push({ word: x[0], lines: rects.length, right: Math.max(...rects.map((q) => q.right)), left: Math.min(...rects.map((q) => q.left)) });
            }
          }
          return { hyphens: cs.hyphens, wordBreak: cs.wordBreak, words, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
        });
        const tag = route + ' @' + width;
        if (!m) { r.fail(tag + ': no h1'); await ctx.close(); continue; }
        if (m.hyphens === 'auto') r.fail(tag + ': h1 hyphens:auto (no hyphenation)');
        if (m.wordBreak === 'break-all') r.fail(tag + ': h1 word-break:break-all');
        for (const x of m.words) {
          if (x.lines > 1) r.fail(tag + ': h1 word "' + x.word + '" is broken across ' + x.lines + ' lines');
          if (x.right > width - GUTTER + 0.5 || x.left < GUTTER - 0.5) r.fail(tag + ': h1 word "' + x.word + '" spans ' + x.left.toFixed(0) + '-' + x.right.toFixed(0) + 'px, content width is ' + GUTTER + '-' + (width - GUTTER) + 'px');
        }
        if (m.sw !== m.cw) r.fail(tag + ': scrollWidth ' + m.sw + ' != clientWidth ' + m.cw);
        await ctx.close();
      }
    }
  });
});
