// F1c (S-2/NR-1 weight band, ruling "SA-6: /about hero at 1024 and 1280"): every SAOC `.hero-facts dd` is serif weight 300 when its computed size is >= 32px
// and 400 when it is 24 to 31.99px; below 24 is a failure. Checked at 390, 768, 1024, 1280, 1440 and 2056 on every inner route that has facts. /about must have
// facts at every width (the check is not vacuous).
import { withSite, openPage, check, finish, INNER_ROUTES } from './lib.mjs';
await withSite(async ({ base, browser, ctxOpts }) => {
  for (const width of [390, 768, 1024, 1280, 1440, 2056]) for (const path of INNER_ROUTES) {
    const { page, ctx } = await openPage(browser, ctxOpts, base, path, width);
    const dds = await page.evaluate(() => [...document.querySelectorAll('[data-page-hero] .hero-facts dd')].map((d) => { const c = getComputedStyle(d); return { size: parseFloat(c.fontSize), wt: Number(c.fontWeight), fam: c.fontFamily.split(',')[0].toLowerCase() }; }));
    if (path === '/about') check(dds.length >= 2, `${path}@${width}: found ${dds.length} hero facts, want >=2`);
    for (const d of dds) {
      const want = d.size >= 32 ? 300 : d.size >= 24 ? 400 : null;
      check(want !== null && d.wt === want && /crimson|serif/.test(d.fam), `${path}@${width}: dd ${d.size.toFixed(1)}px has weight ${d.wt} (${d.fam}), want ${want ?? 'size >= 24'}`);
    }
    await ctx.close();
  }
});
finish('hero-dd-weight');
