// F1e lever 4: the favicon weighs <=10 KB in total (NOS Design ruling, corrected: icons fetched on page load total <=10 KB, no .ico allowance); the 180px apple-touch icon <=16 KB (iOS fetches it lazily). The icons are DERIVED from the supplied emblem recorded in goldens/favicon-source.json (path + sha256),
// never redrawn: each shipped PNG icon and every favicon.ico entry (16/32/48 required) is compared with that source resized by Lanczos, mean absolute channel difference <= 14/255. 16/32/180 review renders exist.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import sharp from 'sharp';
import { icoImages } from './lib-ico.mjs';
import { withSite, openPage, check, finish } from './lib.mjs';
// Distance between a shipped icon and the supplied emblem after the allowed derivations (flatten, trim to artwork, scale, pad): both are flattened on the icon's own background
// colour, trimmed to the artwork, fitted into 64x64 and compared per RGB channel.
export async function emblemDistance(iconBuf, srcBuf) {
  const flat = await sharp(iconBuf).flatten({ background: '#ffffff' }).png().toBuffer(); const px = await sharp(flat).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer(); const bg = { r: px[0], g: px[1], b: px[2] };
  const norm = async (buf, flatten) => { let p = sharp(buf); if (flatten) p = p.flatten({ background: bg }); const t = await p.png().toBuffer(); const trimmed = await sharp(t).trim({ background: bg, threshold: 25 }).png().toBuffer();
    return sharp(trimmed).resize(64, 64, { fit: 'contain', background: bg, kernel: 'lanczos3' }).removeAlpha().raw().toBuffer(); };
  const a = await norm(flat, false); const b = await norm(srcBuf, true); let d = 0; for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i]); return d / a.length;
}
const SPEC = '.agent/memory/project/specs/backlog-wave-1028/saoc-design-consistency/goldens/';
const man = JSON.parse(readFileSync(SPEC + 'favicon-source.json', 'utf8'));
check(existsSync(man.path), `favicon source ${man.path} is missing`);
if (existsSync(man.path)) check(createHash('sha256').update(readFileSync(man.path)).digest('hex') === man.sha256, `favicon source ${man.path} changed (sha256 differs from goldens/favicon-source.json)`);
for (const s of [16, 32, 180]) check(existsSync(`${SPEC}favicon-renders/favicon-${s}.png`), `review render favicon-${s}.png missing`);
await withSite(async ({ base, browser, ctxOpts }) => {
  const { page, ctx } = await openPage(browser, ctxOpts, base, '/about', 1440);
  const links = await page.evaluate(() => [...document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="shortcut icon"]')].map((l) => ({ rel: l.rel, href: new URL(l.getAttribute('href'), location.href).href, sizes: l.getAttribute('sizes') || '' })));
  check(links.length > 0, 'no icon links on /about'); let total = 0; const src = existsSync(man.path) ? readFileSync(man.path) : null;
  for (const l of links) {
    const res = await ctx.request.get(l.href); check(res.status() === 200, `${l.href} -> ${res.status()}`); const body = await res.body(); const apple = l.rel.includes('apple');
    if (apple) check(body.length <= 16384, `apple-touch icon ${l.href.split('/').pop()} is ${(body.length / 1024).toFixed(1)} KB, want <=16 KB`); else { total += body.length; }
    if (src && (/\.ico(\?|$)/.test(l.href) || /icon/.test(res.headers()['content-type'] || '') && !/png/.test(res.headers()['content-type'] || ''))) {
      const entries = await icoImages(body); const sizes = entries.map((e) => e.size);
      for (const want of [16, 32, 48]) check(sizes.includes(want), `${l.href.split('/').pop()} has no ${want}px entry (found ${sizes.join(',') || 'none'})`);
      for (const e of entries) { const mean = await emblemDistance(e.png, src); check(mean <= 20, `${l.href.split('/').pop()} ${e.size}px entry differs from the supplied emblem by ${mean.toFixed(1)}/255 mean, want <=20 (derived, not redrawn)`); }
      continue;
    }
    if (src && /image\/png/.test(res.headers()['content-type'] || '')) {
      const m = await sharp(body).metadata(); const mean = await emblemDistance(body, src); check(mean <= 20, `${l.href.split('/').pop()} (${m.width}px) differs from the supplied emblem by ${mean.toFixed(1)}/255 mean, want <=20 (derived, not redrawn)`);
    }
  }
  const cap = 10240; check(total <= cap, `favicon links total ${(total / 1024).toFixed(1)} KB, want <=${cap / 1024} KB`); console.log(`favicon total ${total} bytes (cap ${cap})`);
  await ctx.close();
});
finish('favicon');
