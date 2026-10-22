// Pixel metrics shared by the rHB2 checks (QA input, hash-locked). Images are { data (RGB bytes), W, H }; `heroRows` is the index of the
// first row below the hero (the seam is between heroRows - 1 and heroRows); distances are CSS px above the seam.
import { require } from './_server.mjs';

const sharp = require('sharp');
export const BLOCK = 16;
export const WINDOW = 4;

export const lstar = (r, g, b) => { const f = (v) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }; const Y = 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); return Y > 216 / 24389 ? 116 * Math.cbrt(Y) - 16 : (Y * 24389) / 27; };
export const median = (a) => { const s = [...a].sort((p, q) => p - q); const k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };
export const r2 = (v) => Number(v.toFixed(2));
export const r3 = (v) => Number(v.toFixed(3));
export const decode = async (input) => { const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, W: info.width, H: info.height }; };
/** Mean RGB of rows y0..y1-1 over columns x0..x1-1. */
export const rowMeans = (img, y0, y1, x0 = 0, x1 = img.W) => {
  const out = [];
  for (let y = y0; y < y1; y++) { const s = [0, 0, 0]; for (let x = x0; x < x1; x++) for (let c = 0; c < 3; c++) s[c] += img.data[(y * img.W + x) * 3 + c]; out.push(s.map((v) => v / (x1 - x0))); }
  return out;
};
/** slope[i]: L* per CSS px over the WINDOW-px window starting at profile row i (rows run downward, towards the seam). */
export const slopes = (L, dpr) => { const k = Math.round(WINDOW * dpr); const s = []; for (let i = 0; i + k < L.length; i++) s.push(((L[i + k] - L[i]) / k) * dpr); return { s, k }; };

/**
 * P1 over the photo: per BLOCK-px column block the L* profile from (span) CSS px above the seam to `below` px under it. At each row the
 * kink |slope(window below) - slope(window above)| is taken per block and the MEDIAN over blocks kept (a Mach line runs the full width;
 * photo texture is local). Also the seam slope: the median over blocks of |slope| over the WINDOW px ending on the last hero row.
 */
export function fullWidthKink(img, heroRows, dpr, span, below) {
  const top = Math.max(0, heroRows - Math.round(span * dpr)); const end = Math.min(img.H, heroRows + Math.round(below * dpr));
  const B = Math.round(BLOCK * dpr); const nb = Math.floor(img.W / B); const k = Math.round(WINDOW * dpr);
  const Ls = []; const Ks = []; const seams = [];
  for (let b = 0; b < nb; b++) {
    const L = rowMeans(img, top, end, b * B, (b + 1) * B).map(([r, g, bl]) => lstar(r, g, bl));
    const { s } = slopes(L, dpr);
    const kink = []; for (let i = k; i < s.length; i++) kink.push(Math.abs(s[i] - s[i - k]));
    Ls.push(L); Ks.push(kink);
    seams.push(Math.abs(s[heroRows - 1 - k - top]));
  }
  let worst = 0; let worstAt = 0;
  for (let i = 0; i < Ks[0].length; i++) { const med = median(Ks.map((q) => q[i])); if (med > worst) { worst = med; worstAt = (heroRows - (top + i + k)) / dpr; } }
  return { coherentKink: r2(worst), kinkAt: r2(worstAt), seamSlope: r3(median(seams)), medL: Ls[0].map((_, i) => median(Ls.map((q) => q[i]))), top };
}

/** P3 on a flat-ground capture: full-width L* profile; the largest adjacent-window slope change over the peak slope, and the seam slope. */
export function pullProfile(img, heroRows, dpr, span, below) {
  const top = Math.max(0, heroRows - Math.round(span * dpr)); const end = Math.min(img.H, heroRows + Math.round(below * dpr));
  const rows = rowMeans(img, top, end);
  const L = rows.map(([r, g, b]) => lstar(r, g, b));
  const { s, k } = slopes(L, dpr);
  const peak = Math.max(...s.map(Math.abs));
  let jump = 0; let jumpAt = 0;
  for (let i = k; i < s.length; i++) { const j = Math.abs(s[i] - s[i - k]) / peak; if (j > jump) { jump = j; jumpAt = (heroRows - (top + i)) / dpr; } }
  return { rows, L, top, jump: r3(jump), jumpAt: r2(jumpAt), peak: r2(peak), seamSlope: r3(Math.abs(s[heroRows - 1 - k - top])) };
}
