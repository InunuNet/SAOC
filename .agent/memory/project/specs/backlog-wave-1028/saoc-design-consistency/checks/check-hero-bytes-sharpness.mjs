// F1d (SA-9): (1) the hero's AVIF and WebP candidates nearest 1200w are each <=180 KB as SERVED; (2) AVIF and WebP offer the
// SAME width set; (3) sharpness: the chosen candidate is >= box x DPR (390@3 and 2056@2), capped at the largest candidate.
import { withSite, openPage, check, finish } from './lib.mjs';
import { readFileSync } from 'node:fs';
const NATIVE = JSON.parse(readFileSync('lib/hero-source-widths.json', 'utf8'));
const MAX_BYTES = 180 * 1024;
const widths = (set) => set.split(',').map((s) => Number(s.trim().split(/\s+/)[1]?.replace('w', ''))).filter(Boolean);
const urlAt = (set, w) => { const c = set.split(',').map((s) => s.trim().split(/\s+/)); return (c.find((x) => Number(x[1].replace('w', '')) >= w) ?? c[c.length - 1])[0]; };
await withSite(async ({ base, browser, ctxOpts, deployed }) => {
  const paths = deployed ? ['/', '/about'] : ['/about'];
  for (const path of paths) {
    const { page, ctx } = await openPage(browser, ctxOpts, base, path, 1440, 900);
    const sets = await page.evaluate(() => { const i = document.querySelector('[data-home-hero-media] img, [data-page-hero-media] img'); const p = i && i.closest('picture');
      return { avif: p?.querySelector('source[type="image/avif"]')?.getAttribute('srcset') ?? '', webp: p?.querySelector('source[type="image/webp"]')?.getAttribute('srcset') || i?.getAttribute('srcset') || '' }; });
    check(!!sets.avif, `${path}: no AVIF srcset to measure`);
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
  for (const [width, dpr] of [[390, 3], [2056, 2]]) for (const path of paths) {
    const { page, ctx } = await openPage(browser, ctxOpts, base, path, width, 900, dpr);
    await page.waitForTimeout(1200);
    const r = await page.evaluate(async () => { const i = document.querySelector('[data-home-hero-media] img, [data-page-hero-media] img'); const b = i.getBoundingClientRect();
      const bm = await createImageBitmap(await (await fetch(i.currentSrc)).blob()); // decoded width: naturalWidth is density-corrected for w-descriptor srcsets
      return { got: bm.width, need: Math.max(b.width, b.height * (bm.width / bm.height)) * devicePixelRatio, src: (i.currentSrc || '').split('/').pop() }; });
    const stem = r.src.replace(/-\d+(-q\d+)?\.(webp|avif)$/, ''); const cap = NATIVE['/images/' + stem] ?? 2048;
    check(r.got >= Math.min(r.need, cap) - 2, `${path}@${width}x${dpr}: served ${r.got}px (${r.src}) < needed ${Math.round(r.need)}px (source cap ${cap}px)`);
    await ctx.close();
  }
});
finish('hero-bytes-sharpness');
