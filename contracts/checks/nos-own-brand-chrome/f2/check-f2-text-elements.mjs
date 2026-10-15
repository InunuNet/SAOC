// F2-K2 (NOS Design R25, item 3): no body text sits in a bare <div>. Serif (Fraunces) text must live in a semantic element: card
// names are h3, FAQ question text is in button/summary/span, the date range is <p class="meta">. Exempt: [data-nos-hero-text] hooks and
// tabular numerals (countdown). Also /what-to-expect: the date range text is in a <p> carrying class "meta".
import { NOS_ROUTES, VP_DESKTOP, main, openPage, withBrowser, snapshotText, describe, isFraunces } from './_f2lib.mjs';

// Any D-D Month YYYY range, not the confirmed days: this check is about the element; content dates are Lee-Ann's (no-invention.md).
const DATE_RE = /\d{1,2}\s*[–—-]\s*\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+20\d\d/i;

await main('F2-K2 text-elements', async (r) => {
  await withBrowser(async (browser) => {
    for (const route of NOS_ROUTES) {
      const { ctx, page } = await openPage(browser, VP_DESKTOP, route);
      const texts = await page.evaluate(snapshotText);
      for (const t of texts) {
        if (t.chrome || t.heroText || t.hero) continue;
        if (t.tag === 'div' && isFraunces(t) && !/tabular-nums/.test(t.fvn)) r.fail(`${route}: serif text in a bare <div>: ${describe(t)}; use h3 (card name), p, span, button or summary`);
      }
      if (route.endsWith('/what-to-expect')) {
        const d = await page.evaluate((src) => {
          const re = new RegExp(src, 'i');
          const leaf = [...document.querySelectorAll('main *')].filter((e) => re.test(e.textContent ?? '') && ![...e.children].some((c) => re.test(c.textContent ?? '')) && e.getClientRects().length);
          return leaf.map((e) => ({ tag: e.tagName.toLowerCase(), cls: String(e.className ?? ''), text: (e.textContent ?? '').trim().slice(0, 40) }));
        }, DATE_RE.source);
        if (!d.length) r.fail(`${route}: no element carries the date range (a D-D Month YYYY range)`);
        for (const e of d) if (!(e.tag === 'p' && /(^|\s)meta(\s|$)/.test(e.cls))) r.fail(`${route}: date range "${e.text}" is <${e.tag} class="${e.cls.slice(0, 40)}">, want <p class="meta">`);
      }
      await ctx.close();
    }
  });
});
