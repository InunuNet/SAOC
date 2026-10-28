// F1e lever 2 (glyph coverage, against the shipped subset files): every font file the site serves contains ê ë é è ô ï û ŉ and the typographic punctuation
// ‘ ’ “ ” – — … · • × plus the letter R. Today NO shipped file has U+0149 (ŉ): Afrikaans text falls back to a system face. The subset stays Latin + Latin-1 plus
// these: no code point outside Basic Latin, Latin-1, Latin Extended (U+0100-024F), U+02xx modifiers, combining marks (U+0300-036F), General Punctuation, currency/symbols (U+20AC, U+2122, U+2190-2193, U+2212, U+2215, U+FEFF).
import { withSite, openPage, check, finish } from './lib.mjs';
import { woff2Cmap } from './lib-woff2.mjs';
const NEED = [...'êëéèôïûŉ‘’“”–—…·•×R']; const ALLOWED = [[0x20, 0x7e], [0xa0, 0xff], [0x100, 0x24f], [0x2b0, 0x2ff], [0x300, 0x36f], [0x2000, 0x206f], [0x20ac, 0x20ac], [0x2122, 0x2122], [0x2190, 0x2193], [0x2212, 0x2212], [0x2215, 0x2215], [0xfeff, 0xfeff], [0, 0x1f]];
await withSite(async ({ base, browser, ctxOpts, deployed }) => {
  const files = new Set(); let ctx;
  for (const path of deployed ? ['/', '/about'] : ['/about']) {
    ctx = await browser.newContext(ctxOpts({ width: 1440, height: 900 })); const page = await ctx.newPage(); page.on('request', (r) => { if (r.resourceType() === 'font') files.add(r.url()); });
    await page.goto(base + path, { waitUntil: 'networkidle', timeout: 120000 }); await page.waitForTimeout(500); if (path !== '/about' || !deployed) { /* keep ctx for the byte fetches below */ } 
  }
  check(files.size > 0, 'no font requests seen on the routes');
  for (const u of files) {
    const res = await ctx.request.get(u); check(res.status() === 200, `${u} -> ${res.status()}`); const cps = woff2Cmap(await res.body()); const name = u.split('/').pop().split('?')[0];
    check(NEED.every((c) => cps.has(c.codePointAt(0))), `${name}: missing ${NEED.filter((c) => !cps.has(c.codePointAt(0))).map((c) => c + ' U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join(', ')}`);
    const stray = [...cps].filter((cp) => !ALLOWED.some(([a, b]) => cp >= a && cp <= b)); check(stray.length === 0, `${name}: code points outside the Latin + Latin-1 subset: ${stray.slice(0, 8).map((c) => c.toString(16)).join(' ')}`);
  }
  await ctx.close();
});
finish('font-glyphs');
