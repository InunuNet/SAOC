// F1e: the 750w AVIF candidate of the /about hero exists and its served bytes are <= BOUND; the byte count is printed as the record. Bound derivation is in goldens/lcp-queue.md.
import { readFileSync } from 'node:fs';
import { withSite, openPage, check, finish } from './lib.mjs';
const BOUND = Number(JSON.parse(readFileSync('.agent/memory/project/specs/backlog-wave-1028/saoc-design-consistency/goldens/lcp-bounds.json', 'utf8')).hero750AvifMaxBytes);
await withSite(async ({ base, browser, ctxOpts }) => {
  const { page, ctx } = await openPage(browser, ctxOpts, base, '/about', 390);
  const set = await page.evaluate(() => { const i = document.querySelector('[data-page-hero-media] img'); const p = i && i.closest('picture'); return p?.querySelector('source[type="image/avif"]')?.getAttribute('srcset') ?? ''; });
  check(!!set, '/about hero has no AVIF srcset'); const c = set.split(',').map((s) => s.trim().split(/\s+/)).find((x) => x[1] === '750w'); check(!!c, 'no 750w candidate in the AVIF srcset');
  if (c) { const res = await ctx.request.get(new URL(c[0], base).href); const n = (await res.body()).length; console.log(`hero 750w AVIF = ${n} bytes`); check(res.status() === 200 && n <= BOUND, `750w AVIF is ${n} bytes, want <=${BOUND}`); }
  await ctx.close();
});
finish('hero-750-avif');
