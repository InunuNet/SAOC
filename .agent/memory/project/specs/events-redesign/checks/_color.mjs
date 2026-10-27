// nos-critique-r16 colour helpers (QA input, hash-locked): WCAG 2.x relative luminance and contrast ratio on sRGB 0-255 triples.
export const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lin = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
export const luminance = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
export function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
export const round2 = (x) => Math.round(x * 100) / 100;

// Runs in the page: resolves any CSS colour string (rgb(), color(srgb ...), oklab(), with alpha) to the opaque sRGB triple it paints over
// `under` (a triple), using a canvas, so colour-mix() / opacity tokens are measured exactly as the browser composites them.
export const IN_PAGE_RESOLVE = `(css, under) => {
  const c = document.createElement('canvas'); c.width = 1; c.height = 1;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.fillStyle = 'rgb(' + under.join(',') + ')'; x.fillRect(0, 0, 1, 1);
  x.fillStyle = css; x.fillRect(0, 0, 1, 1);
  const d = x.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]];
}`;

// Runs in the page: decodes a base64 PNG into an array of [r,g,b] pixels.
export const IN_PAGE_PIXELS = `async (b64) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data; const out = [];
  for (let i = 0; i < d.length; i += 4) out.push([d[i], d[i + 1], d[i + 2]]);
  return { w: c.width, h: c.height, px: out };
}`;
