import sharp from 'sharp';
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
