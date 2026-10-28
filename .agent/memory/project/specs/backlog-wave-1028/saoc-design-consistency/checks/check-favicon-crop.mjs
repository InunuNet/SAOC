// F1e lever 4 (NOS Design ruling): the 16 (read from favicon.ico), the 32 and the 48 PNG are cropped to the flower before scaling, so its longer side fills >=87% of the cell with
// >=1px of margin on every side (today ~70%). No linked 16 PNG is required: the 16 lives in favicon.ico. The 180 apple-touch icon is OPAQUE on #F4F3EC (every pixel alpha 255, corner = F4F3EC) with the flower's longer side at 72-80% of the cell (76% ruled).
// Default: reads the icons the site serves on /about. `--goldens`: runs the same rules on goldens/favicon-renders (proves the review renders obey the ruling).
import { readFileSync, existsSync } from 'node:fs';
import sharp from 'sharp';
import { withSite, openPage, check, finish } from './lib.mjs';
const GROUND = [0xf4, 0xf3, 0xec]; const SPEC = process.env.DC_FAVICON_DIR || '.agent/memory/project/specs/backlog-wave-1028/saoc-design-consistency/goldens/favicon-renders/';
// Flower bounds: alpha > 16 for icons with transparency, else any pixel further than 24/channel from the corner (ground) pixel.
// favicon.ico entries: PNG-embedded images pass through; 32bpp BMP (DIB, height doubled, bottom-up BGRA) is converted to a raw RGBA PNG.
export async function icoImages(buf) {
  const n = buf.readUInt16LE(4); const out = [];
  for (let i = 0; i < n; i++) {
    const o = 6 + i * 16; const w = buf[o] || 256; const len = buf.readUInt32LE(o + 8); const off = buf.readUInt32LE(o + 12); const d = buf.subarray(off, off + len);
    if (d.readUInt32BE(0) === 0x89504e47) { out.push({ size: w, png: Buffer.from(d) }); continue; }
    const hdr = d.readUInt32LE(0); if (d.readUInt16LE(14) !== 32) continue; const raw = Buffer.alloc(w * w * 4);
    for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) { const s = hdr + ((w - 1 - y) * w + x) * 4; const t = (y * w + x) * 4; raw[t] = d[s + 2]; raw[t + 1] = d[s + 1]; raw[t + 2] = d[s]; raw[t + 3] = d[s + 3]; }
    out.push({ size: w, png: await sharp(raw, { raw: { width: w, height: w, channels: 4 } }).png().toBuffer() });
  }
  return out;
}
export async function flowerBox(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); const { width: w, height: h } = info; const c = [data[0], data[1], data[2]];
  const opaque = (() => { for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return false; return true; })(); let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; const on = opaque ? Math.max(Math.abs(data[i] - c[0]), Math.abs(data[i + 1] - c[1]), Math.abs(data[i + 2] - c[2])) > 24 : data[i + 3] > 16; if (on) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  return { w, h, opaque, corner: c, x0, y0, x1, y1, bw: x1 - x0 + 1, bh: y1 - y0 + 1 };
}
export async function checkIcon(label, buf) {
  const b = await flowerBox(buf); const size = b.w; const longer = Math.max(b.bw, b.bh) / size;
  if (b.x1 < 0) { check(false, `${label}: no flower pixels found`); return; }
  if (size === 16 || size === 32 || size === 48) {
    check(longer >= 0.87, `${label}: flower fills ${(longer * 100).toFixed(0)}% of the ${size}px cell, want >=87% (crop to the flower before scaling)`);
    check(b.x0 >= 1 && b.y0 >= 1 && size - 1 - b.x1 >= 1 && size - 1 - b.y1 >= 1, `${label}: flower touches the ${size}px cell edge, want >=1px margin on every side`);
  } else if (size === 180) {
    check(b.opaque, `${label}: apple-touch icon has transparent pixels, want fully opaque`);
    check(b.corner.every((v, i) => Math.abs(v - GROUND[i]) <= 1), `${label}: apple-touch ground is rgb(${b.corner.join(',')}), want #F4F3EC`);
    check(longer >= 0.72 && longer <= 0.80, `${label}: flower fills ${(longer * 100).toFixed(0)}% of the 180px cell, want 72-80% (76% ruled)`);
  }
}
if (process.argv.includes('--goldens')) {
  for (const s of [16, 32, 48, 180]) { const f = `${SPEC}favicon-${s}.png`; check(existsSync(f), `${f} missing`); if (existsSync(f)) await checkIcon(`golden favicon-${s}`, readFileSync(f)); }
} else {
  await withSite(async ({ base, browser, ctxOpts }) => {
    const { page, ctx } = await openPage(browser, ctxOpts, base, '/about', 1440);
    const hrefs = await page.evaluate(() => [...document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="shortcut icon"]')].map((l) => new URL(l.getAttribute('href'), location.href).href)); const seen = new Set();
    for (const href of hrefs) {
      const res = await ctx.request.get(href); const buf = await res.body(); const type = res.headers()['content-type'] || '';
      if (/\.ico(\?|$)/.test(href) || (/icon/.test(type) && !/png/.test(type))) { for (const e of await icoImages(buf)) { seen.add(`ico${e.size}`); if (e.size === 16) await checkIcon('favicon.ico 16px entry', e.png); } continue; }
      if (!/image\/png/.test(type)) continue; const m = await sharp(buf).metadata(); seen.add(m.width); await checkIcon(`${href.split('/').pop()} (${m.width}px)`, buf);
    }
    check(seen.has('ico16'), `favicon.ico has no 16px entry (found: ${[...seen].join(', ') || 'none'})`);
    for (const s of [32, 48, 180]) check(seen.has(s), `no ${s}px PNG icon is linked from /about (found: ${[...seen].join(', ') || 'none'})`);
    await ctx.close();
  });
}
finish('favicon-crop');
