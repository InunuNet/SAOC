// F1e: in the SERVER HTML <head> the hero image preload comes BEFORE every stylesheet link (and before the font preload), exactly one font is preloaded, and it is the file
// that renders the h1/hero face (not an italic or an unused weight). Reads the raw HTML (no JS).
import { withSite, openPage, check, finish } from './lib.mjs';
await withSite(async ({ base, browser, ctxOpts, deployed }) => {
  const user = process.env.BETA_BASIC_AUTH_USER; const pass = process.env.BETA_BASIC_AUTH_PASSWORD;
  const headers = process.env.DC_BASE_URL && user && pass ? { Authorization: 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64') } : {};
  for (const path of deployed ? ['/', '/about'] : ['/about']) {
    const html = await (await fetch(base + path, { headers })).text(); const head = html.slice(0, html.indexOf('</head>') + 7);
    const hero = head.search(/<link[^>]*rel="preload"[^>]*as="image"[^>]*imagesrcset/i); const css = head.search(/<link[^>]*rel="stylesheet"/i);
    check(hero >= 0, `${path}: no hero image preload (imagesrcset) in <head>`); check(css >= 0 && hero >= 0 && hero < css, `${path}: hero preload at ${hero} is not before the first stylesheet at ${css}`);
    const fonts = [...head.matchAll(/<link[^>]*rel="preload"[^>]*as="font"[^>]*>/gi)].map((m) => m[0]); check(fonts.length === 1, `${path}: ${fonts.length} font preloads, want exactly 1 (the h1/hero face)`);
    const { page, ctx } = await openPage(browser, ctxOpts, base, path, 1440);
    const h1src = await page.evaluate(() => { const h = document.querySelector('h1'); const c = getComputedStyle(h); const fam = c.fontFamily.split(',')[0].replace(/['"\s]/g, ''); const wt = Number(c.fontWeight);
      const rules = [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules]; } catch { return []; } }).filter((r) => r.type === CSSRule.FONT_FACE_RULE && r.style.getPropertyValue('font-family').replace(/['"\s]/g, '') === fam && (r.style.getPropertyValue('font-style') || 'normal') === c.fontStyle);
      const r = rules.find((x) => { const [a, b] = (x.style.getPropertyValue('font-weight') || '400').trim().split(/\s+/).map(Number); return wt >= a && wt <= (b ?? a); }) ?? rules[0]; const m = r && r.style.getPropertyValue('src').match(/url\(["']?([^"')]+)/); return m ? new URL(m[1], r.parentStyleSheet.href || location.href).pathname : null; });
    if (fonts[0] && h1src) check(fonts[0].includes(h1src.split('/').pop()) || fonts[0].includes(h1src), `${path}: the preloaded font is not the h1 face (${h1src.split('/').pop()}): ${fonts[0].slice(0, 120)}`);
    await ctx.close();
  }
});
finish('preload-order');
