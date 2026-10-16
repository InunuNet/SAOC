// F3-D2 (NOS Site beta critique item 3, Acceptance bar D2): on /national-show/exhibitors and every archive page (index and years) every link and
// button in <main> outside running copy (an anchor inside a <p>) is at least 44x44px. This is where the back-links and the breadcrumb sit.
import { main, openPage, withBrowser, VP_DESKTOP, VP_PHONE } from './_f3lib.mjs';

function measure() {
  const vis = (e) => { const r = e.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0)) return false; for (let x = e; x && x !== document.documentElement; x = x.parentElement) { const s = getComputedStyle(x); if (s.display === 'none' || s.visibility === 'hidden' || x.hasAttribute('hidden')) return false; } return true; };
  return [...document.querySelectorAll('main a[href], main button')].filter((e) => vis(e) && !e.closest('p, #nh, #nd, #nf') && !e.classList.contains('sr-only')).map((e) => {
    const r = e.getBoundingClientRect();
    return { what: `${e.tagName.toLowerCase()} "${(e.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 30)}"`, w: r.width, h: r.height };
  }).filter((t) => t.w < 43.9 || t.h < 43.9);
}

await main('F3-D2 targets', async (r) => {
  await withBrowser(async (browser) => {
    const probe = await openPage(browser, VP_DESKTOP, '/national-show/archive');
    const years = await probe.page.evaluate(() => [...new Set([...document.querySelectorAll('a[href^="/national-show/archive/"]')].map((a) => a.getAttribute('href')))]);
    await probe.ctx.close();
    for (const route of ['/national-show/exhibitors', '/national-show/archive', ...years]) {
      for (const [name, vp] of [['1280', VP_DESKTOP], ['390', VP_PHONE]]) {
        const { ctx, page, status } = await openPage(browser, vp, route);
        if (status !== 200) { r.fail(`${route} @${name}: HTTP ${status}`); await ctx.close(); continue; }
        for (const t of await page.evaluate(measure)) r.fail(`${route} @${name}: ${t.what} is ${t.w.toFixed(0)}x${t.h.toFixed(0)}px, want >=44x44`);
        await ctx.close();
      }
    }
  });
});
