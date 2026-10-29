// F1c A14 (NOS Design ruling (a), final): the "/about tablet band" exception at 769-1023. Two rows of facts are accepted there.
// At 769, 880, 960 and 1023: /about facts take <=2 rows, no word breaks mid-word, nothing overflows the copy column; the /about hero is <=520px; the other 7 inner routes are 480 +-4.
// The 480 +-4 lock at 768/1024/1280/1440/2056 stays with A2/A8 (not repeated here).
import { withSite, openPage, check, finish, INNER_ROUTES } from './lib.mjs';
const WIDTHS = [769, 880, 960, 1023]; const ABOUT_MAX = 520; const LOCK = 480; const TOL = 4; const MAX_ROWS = 2;
const FACTS = `() => { const hero = document.querySelector('[data-page-hero]'); const dl = hero && hero.querySelector('.hero-facts'); if (!dl) return null; const copy = hero.querySelector('[data-page-hero-copy]') || dl.parentElement; const cb = copy.getBoundingClientRect();
  const tops = []; for (const c of dl.children) { const t = Math.round(c.getBoundingClientRect().top); if (!tops.some((x) => Math.abs(x - t) <= 1)) tops.push(t); }
  const broken = []; for (const el of dl.querySelectorAll('dt, dd')) { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); for (let t; (t = w.nextNode());) { const re = /\\S+/g; for (let m; (m = re.exec(t.data));) { const r = document.createRange(); r.setStart(t, m.index); r.setEnd(t, m.index + m[0].length); if (r.getClientRects().length > 1) broken.push(m[0]); } } }
  const right = Math.max(...[...dl.querySelectorAll('dt, dd')].map((e) => e.getBoundingClientRect().right));
  return { rows: tops.length, broken, over: copy.scrollWidth - copy.clientWidth, right, copyRight: cb.right, h: Math.round(hero.getBoundingClientRect().height) }; }`;
await withSite(async ({ base, browser, ctxOpts }) => {
  for (const width of WIDTHS) {
    const rows = [];
    for (const path of INNER_ROUTES) {
      const { page, ctx, status } = await openPage(browser, ctxOpts, base, path, width); const w = `${path}@${width}`; check(status === 200, `${w} status ${status}`);
      const h = await page.evaluate(() => { const e = document.querySelector('[data-page-hero]'); return e ? Math.round(e.getBoundingClientRect().height) : null; });
      if (h === null) { check(false, `${w}: no [data-page-hero]`); await ctx.close(); continue; }
      rows.push(`${path}=${h}`);
      if (path === '/about') {
        check(h <= ABOUT_MAX, `${w}: hero is ${h}px, want <=${ABOUT_MAX} (tablet band)`);
        const r = await page.evaluate(`(${FACTS})()`);
        if (!r) check(false, `${w}: no .hero-facts`);
        else {
          check(r.rows <= MAX_ROWS, `${w}: facts take ${r.rows} rows, want <=${MAX_ROWS}`);
          check(r.broken.length === 0, `${w}: a fact breaks mid-word: ${r.broken.join(', ')}`);
          check(r.over <= 0 && r.right <= r.copyRight + 0.5, `${w}: facts overflow the copy column (scroll overflow ${r.over}, right ${r.right.toFixed(0)} vs ${r.copyRight.toFixed(0)})`);
        }
      } else check(Math.abs(h - LOCK) <= TOL, `${w}: hero is ${h}px, want ${LOCK} +-${TOL}`);
      await ctx.close();
    }
    console.log(`REPORT @${width}: ${rows.join(' ')}`);
  }
});
finish('about-tablet-band');
