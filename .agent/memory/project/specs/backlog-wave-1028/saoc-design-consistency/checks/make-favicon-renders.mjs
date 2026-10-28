// Golden generator (not a gate): derives the 16/32/180 favicon review renders from the confirmed source (goldens/favicon-source.json) by the NOS Design ruling:
// crop to the flower's alpha bounds first, then scale; 1px margin at 16 and 32 (transparent); the 180 is opaque on #F4F3EC with the flower's longer side at 76% of the cell.
import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
const SPEC = '.agent/memory/project/specs/backlog-wave-1028/saoc-design-consistency/goldens/';
const man = JSON.parse(readFileSync(SPEC + 'favicon-source.json', 'utf8'));
const flower = await sharp(readFileSync(man.path)).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 1 }).png().toBuffer();
async function render(size, fill, bg) {
  const inner = Math.round(size * fill); const f = await sharp(flower).resize(inner, inner, { fit: 'inside', kernel: 'lanczos3' }).png().toBuffer(); const m = await sharp(f).metadata();
  const canvas = sharp({ create: { width: size, height: size, channels: 4, background: bg ?? { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: f, left: Math.floor((size - m.width) / 2), top: Math.floor((size - m.height) / 2) }]);
  return (bg ? canvas.flatten({ background: bg }) : canvas).png({ compressionLevel: 9, palette: true, colours: size < 180 ? 256 : 128, effort: 10 }).toBuffer();
}
for (const [size, fill, bg] of [[16, 14 / 16], [32, 30 / 32], [48, 46 / 48], [180, 0.76, { r: 0xf4, g: 0xf3, b: 0xec }]]) { const b = await render(size, fill, bg); writeFileSync(`${SPEC}favicon-renders/favicon-${size}.png`, b); console.log(size, b.length, 'bytes'); }
