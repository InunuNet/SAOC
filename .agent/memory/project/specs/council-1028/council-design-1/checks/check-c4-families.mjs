// council-design-1 C4 rendered gate (COUNCIL-1 C4, SAOC host): on every walked route at 390 and 1440 the FIRST family of every rendered text node
// (and visible form control) is Crimson Pro or Manrope (or their metric-matched next/font fallbacks), and the loaded @font-face faces and the
// font files fetched are only those two families. Fails on any system-ui, Lora, JetBrains or unstyled-control leak.
import { withSite, openPage, check, finish, tenRoutes, VIEWPORTS, EXTRA_ROUTES, FAMILY_OK, TEXT_WALK, firstFamily, societyDetail } from './council-lib.mjs';

await withSite(async (site) => {
  const { base, browser, ctxOpts } = site;
  const soc = await societyDetail(base);
  const routes = [...tenRoutes(site), ...EXTRA_ROUTES, ...(soc ? [soc] : [])];
  for (const width of VIEWPORTS) for (const path of routes) {
    const ctx = await browser.newContext(ctxOpts({ width, height: 900 })); const page = await ctx.newPage(); const files = [];
    page.on('request', (r) => { if (r.resourceType() === 'font') files.push(r.url()); });
    const resp = await page.goto(base + path, { waitUntil: 'networkidle', timeout: 120000 }); await page.waitForTimeout(400);
    const w = `${path}@${width}`; const s = resp ? resp.status() : 0;
    if (!(s === 200 || (path.includes('does-not-exist') && s === 404))) { check(false, `${w}: status ${s}`); await ctx.close(); continue; }
    const nodes = await page.evaluate(`(${TEXT_WALK})()`);
    check(nodes.length > 5, `${w}: only ${nodes.length} text nodes walked`);
    const bad = nodes.filter((n) => !FAMILY_OK.test(firstFamily(n.family)));
    check(bad.length === 0, `${w}: ${bad.length} text node(s) whose first family is not Crimson Pro/Manrope: ${bad.slice(0, 4).map((b) => `"${b.text}" <${b.tag} class="${b.cls}"> ${firstFamily(b.family)}`).join(' | ')}`);
    const faces = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded' && !/Fallback/i.test(f.family)).map((f) => f.family));
    const badFace = faces.filter((f) => !FAMILY_OK.test(f)); check(badFace.length === 0, `${w}: loaded face(s) outside the pair: ${badFace.join(', ')}`);
    const badFile = [...new Set(files)].filter((u) => !/crimson|manrope/i.test(u.split('/').pop())); check(badFile.length === 0, `${w}: font file(s) outside the pair fetched: ${badFile.map((u) => u.split('/').pop()).join(', ')}`);
    await ctx.close();
  }
});
finish('c4-families');
