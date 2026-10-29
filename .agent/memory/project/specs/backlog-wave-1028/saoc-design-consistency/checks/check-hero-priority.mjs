// F1d (SA-9): on / and /about, at 390 and 1440, exactly ONE <img> carries fetchpriority=high: the hero photograph, never
// lazy; the document head has exactly one image preload and its imagesrcset/imagesizes match that hero (the AVIF set); no
// other above-the-fold image is eager-prioritised or preloaded; the hero is an AVIF-first <picture> with a WebP fallback img.
import { withSite, openPage, check, finish } from './lib.mjs';
const PROBE = `() => { const hero = document.querySelector('[data-home-hero-media] img, [data-page-hero-media] img'); const vh = innerHeight;
  const imgs = [...document.images].map((i) => ({ hero: i === hero, fp: i.getAttribute('fetchpriority'), loading: i.getAttribute('loading'), top: i.getBoundingClientRect().top, h: i.getBoundingClientRect().height, w: i.getBoundingClientRect().width }));
  const pre = [...document.head.querySelectorAll('link[rel=preload][as=image]')].map((l) => ({ srcset: l.getAttribute('imagesrcset') || '', sizes: l.getAttribute('imagesizes') || '', type: l.getAttribute('type') || '' }));
  const pic = hero && hero.closest('picture'); const srcs = pic ? [...pic.querySelectorAll('source')].map((s) => ({ type: s.type, srcset: s.getAttribute('srcset') || '', sizes: s.getAttribute('sizes') || '' })) : [];
  return { found: !!hero, imgs, pre, srcs, heroSrcset: hero ? hero.getAttribute('srcset') || '' : '', heroSizes: hero ? hero.getAttribute('sizes') || '' : '', vh }; }`;
// Home (/) needs live Sanity events, so it is probed only on a deployed origin.
await withSite(async ({ base, browser, ctxOpts, deployed }) => {
  for (const path of deployed ? ['/', '/about'] : ['/about']) for (const width of [390, 1440]) {
    const { page, ctx, status } = await openPage(browser, ctxOpts, base, path, width, 900);
    const w = `${path}@${width}`; check(status === 200, `${w} status ${status}`);
    const r = await page.evaluate(`(${PROBE})()`);
    check(r.found, `${w}: hero image not found`);
    const high = r.imgs.filter((i) => i.fp === 'high');
    check(high.length === 1 && high[0].hero, `${w}: ${high.length} img(s) with fetchpriority=high, want exactly the hero`);
    const hero = r.imgs.find((i) => i.hero); check(!hero || hero.loading !== 'lazy', `${w}: hero is loading=lazy`);
    check(r.pre.length === 1, `${w}: ${r.pre.length} image preloads in <head>, want exactly 1 (the hero)`);
    const avif = r.srcs.find((s) => s.type === 'image/avif'); const webp = r.srcs.find((s) => s.type === 'image/webp');
    check(!!avif, `${w}: hero has no <source type="image/avif">`);
    check(r.srcs[0]?.type === 'image/avif', `${w}: AVIF is not the first <source>`);
    check(!!(webp || r.heroSrcset), `${w}: no WebP fallback`);
    if (avif && r.pre[0]) { check(r.pre[0].srcset === avif.srcset, `${w}: preload imagesrcset differs from the AVIF source srcset`); check(r.pre[0].sizes === avif.sizes, `${w}: preload imagesizes differs from the AVIF source sizes`); check(r.pre[0].type === 'image/avif', `${w}: preload lacks type="image/avif"`); }
    const eager = r.imgs.filter((i) => !i.hero && i.top < r.vh && i.h > 0 && i.loading !== 'lazy' && i.fp === 'high');
    check(eager.length === 0, `${w}: ${eager.length} other above-the-fold img(s) are eager-prioritised`);
    await ctx.close();
  }
});
finish('hero-priority');
