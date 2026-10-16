// F3 R67 (Brad, direct): the NOS hub hero holds exactly two links, in this order: "Tickets" -> /national-show/tickets
// then "Plan your visit" -> /national-show/plan-your-visit, and no link to /societies. The other hub occurrences of
// "Find your society" (exhibitor band) and every SAOC page are out of scope for this assertion.
import { HUB_ROUTE, main, openPage, withBrowser, VP_DESKTOP, VP_PHONE } from './_f3lib.mjs';

const WANT = [
  { text: 'tickets', href: '/national-show/tickets' },
  { text: 'plan your visit', href: '/national-show/plan-your-visit' },
];

function heroLinks() {
  const hero = document.querySelector('[data-nos-hero]');
  if (!hero) return null;
  return [...hero.querySelectorAll('a')].map((a) => ({
    text: (a.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase(),
    href: new URL(a.getAttribute('href') ?? '', location.origin).pathname,
  }));
}

await main('F3 hub hero CTAs (R67)', async (r) => {
  await withBrowser(async (browser) => {
    for (const [name, vp] of [['1280', VP_DESKTOP], ['390', VP_PHONE]]) {
      const { ctx, page, status } = await openPage(browser, vp, HUB_ROUTE);
      const tag = `${HUB_ROUTE} @${name}`;
      if (status !== 200) { r.fail(`${tag}: HTTP ${status}`); await ctx.close(); continue; }
      const links = await page.evaluate(heroLinks);
      if (!links) r.fail(`${tag}: no [data-nos-hero]`);
      else {
        const got = links.map((l) => `${l.text} -> ${l.href}`).join(' | ');
        if (links.length !== WANT.length || WANT.some((w, i) => links[i].text !== w.text || links[i].href !== w.href)) {
          r.fail(`${tag}: hero links are [${got}], want exactly [tickets -> /national-show/tickets | plan your visit -> /national-show/plan-your-visit]`);
        }
        if (links.some((l) => l.href === '/societies')) r.fail(`${tag}: hero links to /societies`);
      }
      await ctx.close();
    }
  });
});
