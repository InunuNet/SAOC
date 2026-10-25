// Shared helpers for the polish-wave-2026-10-25 checks (architect input, never edited by @dev).
// POLISH_ROOT overrides the tree under test so a check can be proven red against an unchanged
// checkout (mutation proof) without touching the working tree.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = process.env.POLISH_ROOT
  ? resolve(process.env.POLISH_ROOT)
  : resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

export function read(rel) {
  const p = resolve(repoRoot, rel);
  if (!existsSync(p)) throw new Error(`missing file: ${rel}`);
  return readFileSync(p, 'utf8');
}

// Every opening tag of `name` (JSX, so `<Button` and `<button` are different names), spanning lines.
export function tags(src, name) {
  const out = [];
  const re = new RegExp(`<${name}\\b`, 'g');
  let m;
  while ((m = re.exec(src)) !== null) {
    let depth = 0;
    let i = m.index;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0 && src[i - 1] !== '=') break;
    }
    out.push(src.slice(m.index, i + 1));
  }
  return out;
}

export function finish(name, failures) {
  if (failures.length > 0) {
    console.error(`FAIL ${name}:\n - ${failures.join('\n - ')}`);
    process.exit(1);
  }
  console.log(`PASS ${name}`);
}

export function parseHex(hex) {
  const h = hex.replace('#', '');
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}
const lum = ({ r, g, b }) => {
  const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
export function contrast(a, b) {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
