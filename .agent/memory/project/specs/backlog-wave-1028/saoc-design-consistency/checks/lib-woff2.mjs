// Minimal WOFF2 reader: returns the Set of code points a font file maps to a real glyph (cmap formats 4 and 12). The cmap table is never
// transformed in WOFF2 (only glyf/loca are), so a Brotli decompress plus the table directory is enough. Node's zlib ships Brotli.
import { brotliDecompressSync } from 'node:zlib';

const TAG_CMAP = 0; const TAG_GLYF = 10; const TAG_LOCA = 11;
function base128(buf, pos) { let v = 0; for (let i = 0; i < 5; i++) { const b = buf[pos.o++]; v = (v << 7) | (b & 0x7f); if (!(b & 0x80)) return v >>> 0; } throw new Error('bad UIntBase128'); }

export function woff2Cmap(file) {
  if (file.toString('latin1', 0, 4) !== 'wOF2') throw new Error('not a WOFF2 file');
  const numTables = file.readUInt16BE(12); const compressedSize = file.readUInt32BE(20); const pos = { o: 48 }; const tables = [];
  for (let i = 0; i < numTables; i++) {
    const flags = file[pos.o++]; const idx = flags & 0x3f; const ver = (flags >> 6) & 3; if (idx === 63) pos.o += 4;
    const orig = base128(file, pos); const isGL = idx === TAG_GLYF || idx === TAG_LOCA; const transformed = isGL ? ver === 0 : ver !== 0;
    const len = transformed ? base128(file, pos) : orig; tables.push({ idx, len });
  }
  const data = brotliDecompressSync(file.subarray(pos.o, pos.o + compressedSize));
  let off = 0; let cmapOff = -1; for (const t of tables) { if (t.idx === TAG_CMAP) cmapOff = off; off += t.len; }
  if (cmapOff < 0) throw new Error('no cmap table');
  const cps = new Set(); const n = data.readUInt16BE(cmapOff + 2);
  for (let i = 0; i < n; i++) {
    const plat = data.readUInt16BE(cmapOff + 4 + i * 8); const enc = data.readUInt16BE(cmapOff + 6 + i * 8); const sub = cmapOff + data.readUInt32BE(cmapOff + 8 + i * 8);
    if (!((plat === 3 && (enc === 1 || enc === 10)) || plat === 0)) continue;
    const fmt = data.readUInt16BE(sub);
    if (fmt === 4) {
      const segX2 = data.readUInt16BE(sub + 6); const seg = segX2 / 2; const endB = sub + 14; const startB = endB + segX2 + 2; const deltaB = startB + segX2; const rangeB = deltaB + segX2;
      for (let s = 0; s < seg; s++) {
        const end = data.readUInt16BE(endB + s * 2); const start = data.readUInt16BE(startB + s * 2); const delta = data.readInt16BE(deltaB + s * 2); const ro = data.readUInt16BE(rangeB + s * 2);
        for (let cp = start; cp <= end && cp !== 0xffff; cp++) {
          let gid; if (ro === 0) gid = (cp + delta) & 0xffff; else { const a = rangeB + s * 2 + ro + 2 * (cp - start); gid = data.readUInt16BE(a); if (gid) gid = (gid + delta) & 0xffff; }
          if (gid) cps.add(cp);
        }
      }
    } else if (fmt === 12) {
      const groups = data.readUInt32BE(sub + 12);
      for (let g = 0; g < groups; g++) { const s0 = data.readUInt32BE(sub + 16 + g * 12); const e0 = data.readUInt32BE(sub + 20 + g * 12); const gid0 = data.readUInt32BE(sub + 24 + g * 12); for (let cp = s0; cp <= e0; cp++) if (gid0 + (cp - s0)) cps.add(cp); }
    }
  }
  return cps;
}
