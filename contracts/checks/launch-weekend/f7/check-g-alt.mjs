#!/usr/bin/env node
// F7a-A7 - image alternatives on SAOC routes: every <img> carries an alt attribute, no alt is a file name, and the
// shared hero/band components never default a missing alt to an empty string for a meaningful image.
import { BASE, read, withBrowser, open, report } from './_lib.mjs';

const problems = [];
const band = read('components/ui/PhotoBand.tsx');
if (/alt\s*=\s*['"]{2}\s*[,}]/.test(band) || /alt\?\s*:/.test(band)) problems.push('PhotoBand.tsx: alt is optional or defaults to "" (a meaningful photo must require real alt text)');
const ROUTES = ['/', '/about', '/societies', '/judging', '/events', '/sponsors', '/contact', '/media-kit'];
const FILEISH = /\.(jpe?g|png|webp|avif|gif)\b|^(image|img|photo|hero)[\s_-]*\d*$|^orchid-[a-z]+$/i;
await withBrowser(async (ctx) => {
  const page = await ctx.newPage();
  for (const r of ROUTES) {
    await open(page, r);
    const imgs = await page.evaluate(() => [...document.images].map((i) => ({ src: i.currentSrc || i.src, alt: i.getAttribute('alt'), hidden: !!i.closest('[aria-hidden="true"]'), role: i.getAttribute('role') })));
    for (const i of imgs) {
      if (i.alt === null && i.role !== 'presentation') problems.push(`${r}: <img> with no alt attribute (${i.src.slice(-60)})`);
      if (i.alt && FILEISH.test(i.alt.trim())) problems.push(`${r}: alt "${i.alt}" is a file name, not a description`);
    }
  }
});
report(problems, `image alternatives are present and descriptive on ${ROUTES.length} routes at ${BASE}`);
