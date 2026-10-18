#!/usr/bin/env node
// F24-A4 (live, PUBLIC build, PUBLIC_URL, SITE_PUBLIC_LAUNCH=true): the unsourced '21' is withheld on /societies (hero lede) and /media-kit.
// Checks the rendered text, the meta and og descriptions, and the raw HTML payload (the RSC stream would carry a hidden lede). The
// /societies h1 and the sourced 1968 fact on /media-kit must survive (a withhold that deletes the page does not count).
// Usage: PUBLIC_URL=http://localhost:3624 node contracts/checks/launch-weekend/f24/check-d-withhold-public.mjs
import { PUBLIC_BASE, VIEWPORTS, launch, newPage, report, loadGolden, readMeta } from './_meta.mjs';

const G = loadGolden('withhold.json');
const re = new RegExp(G.unsourcedRe, 'i');
const problems = [];
const browser = await launch();
const { ctx, page } = await newPage(browser, VIEWPORTS[1]);
for (const site of G.sites) {
  const m = await readMeta(page, site.route, PUBLIC_BASE);
  if (m.status !== 200) { problems.push(`${site.route}: HTTP ${m.status}`); continue; }
  const text = await page.evaluate(() => document.querySelector('main').innerText);
  const html = await page.content();
  const hit = re.exec(text);
  if (hit) problems.push(`${site.route}: "${hit[0]}" is visible in main (${site.id})`);
  for (const [k, v] of [['meta description', m.description], ['og:description', m.ogDescription]]) if (v && re.test(v)) problems.push(`${site.route}: ${k} holds an unsourced figure: "${v}"`);
  const raw = /21 societies|network of 21/i.exec(html);
  if (raw) problems.push(`${site.route}: the HTML payload still holds "${raw[0]}"`);
  if (site.route === '/societies') {
    if (m.h1 !== 'Find an orchid society near you') problems.push(`/societies: h1 is "${m.h1}", want "Find an orchid society near you"`);
    if (await page.locator('[data-page-hero] p').count()) problems.push('/societies: the hero still renders a lede paragraph');
  }
  if (site.route === '/media-kit' && !/1968/.test(text)) problems.push('/media-kit: the sourced 1968 founding-year fact is gone');
}
await ctx.close(); await browser.close();
report(problems, `the unsourced '21' is withheld on ${G.sites.length} public sites; h1 and sourced facts survive`);
