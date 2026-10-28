// Pure rules for the nos-type-tokens gate. No browser, no I/O: selftest.mjs exercises every function here, and gate-type.mjs applies them to what collect.mjs measured.
export const clampPx = (c, vw) => Math.min(c.max, Math.max(c.min, c.a + (c.b * vw) / 100));

/** R-W (Brad's weight band): 300 at >=32px, 400 at 20-31.99px, 500 below 20px. */
export function wantWeight(size, band) {
  if (size >= band.hiMin) return band.hi;
  if (size >= band.midMin) return band.mid;
  return band.lo;
}

const chan = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
export const parseRgb = (s) => (String(s).match(/[\d.]+/g) ?? []).map(Number);
export const luminance = (rgb) => { const [r, g, b] = parseRgb(rgb); return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b); };
export function contrast(fg, bg) {
  const a = luminance(fg); const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** The opsz value out of a computed font-variation-settings string such as `"opsz" 72`. null when absent. */
export function opszOf(fvs) {
  const m = /"opsz"\s+([\d.]+)/.exec(String(fvs ?? ''));
  return m ? Number(m[1]) : null;
}

/** The three NR-8 label tuples. A node passes when its (weight, size, tracking, transform) is one of them. */
export function labelKind(n, L) {
  const t = Number.parseFloat(n.ls) || 0;
  if (n.tt === L.label.transform && n.wt === String(L.label.weight) && n.size === L.label.size && Math.abs(t) < 0.05) return 'label';
  if (n.tt === L.formLabel.transform && n.wt === String(L.formLabel.weight) && n.size === L.formLabel.size && Math.abs(t) < 0.05) return 'formLabel';
  if (n.tt === L.caps.transform && n.wt === String(L.caps.weight) && L.caps.sizes.includes(n.size) && Math.abs(t - L.caps.trackingEm * n.size) < 0.08) return 'caps';
  return null;
}

/** Group failure strings by their text so a run prints counts and a few examples, not thousands of lines. */
export function summarise(failures, per = 3, max = 25) {
  const m = new Map();
  for (const f of failures) { const k = f.key; if (!m.has(k)) m.set(k, { n: 0, ex: [] }); const g = m.get(k); g.n += 1; if (g.ex.length < per) g.ex.push(f.where); }
  return [...m.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, max).map(([k, g]) => `${g.n}x ${k} (e.g. ${g.ex.join(', ')})`);
}
