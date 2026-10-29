// F1d (SA-9): (1) the hero's AVIF and WebP candidates nearest 1200w are each <=180 KB as SERVED; (2) AVIF and WebP offer the
// SAME width set; (3) sharpness: the chosen candidate is >= box x DPR (390@3 and 2056@2), capped at the largest candidate.
// Selection honesty: in this AVIF-capable browser the SELECTED candidate (img.currentSrc) must be one of the AVIF <source>'s candidates at EVERY viewport (390, 768, 1024, 1440, 2056), and NO <source> may carry a media query at all
// (no golden declares one; a media-gated source is picked at some widths and not others).
// The source-width caps are NOT read from the product: GOLDEN_NATIVE below is the golden copy of lib/hero-source-widths.json (the originals' pixel sizes) and the product file must still match it for every hero it lists, so lowering
// a cap cannot make a tiny hero pass. Absolute floors (HM-3, served >= box x DPR): 1170px at 390@3 and 2056px at 2056@2, each capped at the golden native width.
// Format honesty: the WebP is a real <source type="image/webp"> (the <img> srcset is not accepted in its place) and separate from the AVIF <source>; EVERY candidate of each source and of the <img> fallback
// is served with the matching content-type AND decodes (sharp metadata: format and the declared width), so a 200 that carries the wrong format or garbage bytes fails.
import { withSite, openPage, check, finish } from './lib.mjs';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
const GOLDEN_NATIVE = { '/images/orchid-dark.jpg': 5184, '/images/orchid-pink.jpg': 3456, '/images/orchid-violet.jpg': 7327, '/images/orchid-purple.jpg': 5308, '/images/orchid-yellow.jpg': 3100, '/images/nos-hero-S3a.jpg': 2800, '/images/nos-hero-S3b.jpg': 3000, '/images/nos-hero-S2a.jpg': 4400, '/images/nos-hero-S2c.jpg': 2600, '/images/nos-hero-S1b.jpg': 2600, '/images/nos-hero-H4a.jpg': 2700, '/images/nos-hero-H4b.jpg': 2200, '/images/nos-hero-D1.jpg': 2600, '/images/nos-hero-PK1.jpg': 2600, '/images/nos-hero-PK3.jpg': 2600, '/images/nos-hero-Y1.jpg': 2600, '/images/orchid-purple-flip.jpg': 5308, '/images/orchid-dark-flip.jpg': 5184, '/images/orchid-purple-home.jpg': 4900, '/images/orchid-violet-contact.jpg': 4112, '/images/orchid-violet-about.jpg': 5027, '/images/orchid-violet-society.jpg': 4112, '/images/orchid-purple-band.jpg': 4608, '/images/orchid-dark-showband.jpg': 2400 };
const ABS_MIN = { 390: 1170, 2056: 2056 };
const PRODUCT_NATIVE = JSON.parse(readFileSync('lib/hero-source-widths.json', 'utf8'));
for (const [k, v] of Object.entries(GOLDEN_NATIVE)) if (PRODUCT_NATIVE[k] !== v) check(false, `lib/hero-source-widths.json lists ${k} at ${PRODUCT_NATIVE[k]}, the golden says ${v}`);
const MAX_BYTES = 180 * 1024;
const widths = (set) => set.split(',').map((s) => Number(s.trim().split(/\s+/)[1]?.replace('w', ''))).filter(Boolean);
const urlAt = (set, w) => { const c = set.split(',').map((s) => s.trim().split(/\s+/)); return (c.find((x) => Number(x[1].replace('w', '')) >= w) ?? c[c.length - 1])[0]; };
await withSite(async ({ base, browser, ctxOpts, deployed }) => {
  const paths = deployed ? ['/', '/about'] : ['/about'];
  for (const path of paths) {
    const { page, ctx } = await openPage(browser, ctxOpts, base, path, 1440, 900);
    const sets = await page.evaluate(() => { const i = document.querySelector('[data-home-hero-media] img, [data-page-hero-media] img'); const p = i && i.closest('picture');
      return { avif: p?.querySelector('source[type="image/avif"]')?.getAttribute('srcset') ?? '', webp: p?.querySelector('source[type="image/webp"]')?.getAttribute('srcset') ?? '', img: i?.getAttribute('srcset') ?? '', imgSrc: i?.getAttribute('src') ?? '', current: i?.currentSrc ?? '', media: [...(p?.querySelectorAll('source[media]') ?? [])].map((x) => x.getAttribute('media')) }; });
    check(!!sets.avif, `${path}: no AVIF srcset to measure`);
    check(!!sets.webp, `${path}: no <source type="image/webp"> (the <img> srcset is not accepted as the WebP source)`);
    check(!!sets.avif && sets.avif !== sets.webp, `${path}: the AVIF and WebP <source> srcsets are the same string, want separate sources`);
    check(sets.media.length === 0, `${path}: <source> carries a media query (${sets.media.join(', ')}); none is declared by the golden, and a media-gated source is not picked at every viewport`);
    const cands = (set) => set.split(',').map((x) => x.trim().split(/\s+/)).filter((x) => x[0]).map((x) => ({ url: x[0], w: Number((x[1] ?? '').replace('w', '')) || null }));
    if (sets.avif) check(cands(sets.avif).some((c) => new URL(c.url, base).href === sets.current), `${path}: the selected candidate (img.currentSrc ${sets.current.split('/').pop() || 'empty'}) is not from the AVIF <source>, so AVIF is not what this browser is served`);
    for (const [name, mime, fmt, list] of [['avif', 'image/avif', 'heif', cands(sets.avif)], ['webp', 'image/webp', 'webp', cands(sets.webp)], ['img fallback', 'image/webp', 'webp', [...cands(sets.img), ...(sets.imgSrc ? [{ url: sets.imgSrc, w: null }] : [])]]]) {
      check(list.length > 0, `${path}: ${name} has no candidates`);
      for (const c of list) {
        const u = new URL(c.url, base).href; const res = await ctx.request.get(u); const ct = (res.headers()['content-type'] ?? '').split(';')[0].trim(); const w = `${path}: ${name} candidate ${c.url.split('/').pop()}`;
        check(res.status() === 200, `${w} -> ${res.status()}`); check(ct === mime, `${w} content-type is "${ct}", want ${mime}`);
        let meta = null; try { meta = await sharp(await res.body()).metadata(); } catch { meta = null; }
        check(meta !== null && meta.format === fmt, `${w} does not decode as ${fmt} (${meta ? meta.format : 'sharp could not read it'})`);
        if (meta && c.w) check(meta.width === c.w, `${w} decodes ${meta.width}px wide, srcset says ${c.w}w`);
      }
    }
    if (sets.avif && sets.webp) {
      check(JSON.stringify(widths(sets.avif)) === JSON.stringify(widths(sets.webp)), `${path}: AVIF and WebP width sets differ`);
      for (const [name, set] of [['avif', sets.avif], ['webp', sets.webp]]) {
        const u = new URL(urlAt(set, 1200), base).href; const res = await ctx.request.get(u); const len = (await res.body()).length;
        check(res.status() === 200, `${path}: ${name} 1200w candidate ${u} -> ${res.status()}`);
        check(len <= MAX_BYTES, `${path}: ${name} at ~1200w is ${(len / 1024).toFixed(0)} KB, want <=180 KB`);
      }
    }
    await ctx.close();
  }
  for (const [width, dpr] of [[390, 3], [768, 1], [1024, 1], [1440, 1], [2056, 2]]) for (const path of paths) {
    const { page, ctx } = await openPage(browser, ctxOpts, base, path, width, 900, dpr);
    await page.waitForTimeout(1200);
    const r = await page.evaluate(async () => { const i = document.querySelector('[data-home-hero-media] img, [data-page-hero-media] img'); const b = i.getBoundingClientRect(); const p = i.closest('picture');
      const bm = await createImageBitmap(await (await fetch(i.currentSrc)).blob()); // decoded width: naturalWidth is density-corrected for w-descriptor srcsets
      return { got: bm.width, need: Math.max(b.width, b.height * (bm.width / bm.height)) * devicePixelRatio, src: (i.currentSrc || '').split('/').pop(), current: i.currentSrc, avif: p?.querySelector('source[type="image/avif"]')?.getAttribute('srcset') ?? '' }; });
    const w = `${path}@${width}x${dpr}`;
    check(r.avif.split(',').map((x) => x.trim().split(/\s+/)[0]).some((u) => new URL(u, base).href === r.current), `${w}: the selected candidate (${r.src}) is not from the AVIF <source>, so AVIF is not what this viewport is served`);
    const stem = r.src.replace(/-\d+(-q\d+)?\.(webp|avif)$/, ''); const cap = GOLDEN_NATIVE['/images/' + stem];
    check(cap !== undefined, `${w}: hero source ${stem} is not in the golden native-width table (GOLDEN_NATIVE)`);
    if (cap === undefined) { await ctx.close(); continue; }
    check(r.got >= Math.min(r.need, cap) - 2, `${w}: served ${r.got}px (${r.src}) < needed ${Math.round(r.need)}px (golden source width ${cap}px)`);
    if (ABS_MIN[width]) check(r.got >= Math.min(ABS_MIN[width], cap) - 2, `${w}: served ${r.got}px (${r.src}) is below the absolute floor ${ABS_MIN[width]}px (golden source width ${cap}px)`);
    await ctx.close();
  }
});
finish('hero-bytes-sharpness');
