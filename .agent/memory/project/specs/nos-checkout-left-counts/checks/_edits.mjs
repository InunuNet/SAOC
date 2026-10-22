// nos-checkout-left-counts (rLC) helpers (QA input, hash-locked; the r45 helpers cut down to what rLC needs).
import { readBaseFile, readRepoFile } from './_lib.mjs';

/** A file must equal its BASE text with exactly the given substitutions ({ from, to }, each `from` occurring once in BASE). */
export function exactSubstitutions(file, substitutions, tag) {
  const base = readBaseFile(file);
  const head = readRepoFile(file);
  if (base === null || head === null) return [`${file}: missing at ${base === null ? 'BASE' : 'HEAD'} (${tag})`];
  const out = [];
  let want = base;
  for (const s of substitutions) {
    const n = want.split(s.from).length - 1;
    if (n !== 1) { out.push(`${file}: a golden \`from\` occurs ${n} times in BASE, want 1 (${tag})`); continue; }
    want = want.replace(s.from, () => s.to);
  }
  if (head !== want) {
    const h = head.split('\n');
    const w = want.split('\n');
    const diff = [];
    for (let i = 0; i < Math.max(h.length, w.length) && diff.length < 3; i++) {
      if (h[i] === w[i]) continue;
      diff.push(`line ${i + 1}: got ${JSON.stringify((h[i] ?? '<eof>').slice(0, 110))}, want ${JSON.stringify((w[i] ?? '<eof>').slice(0, 110))}`);
    }
    out.push(`${file}: not BASE + exactly the golden substitutions: ${diff.join('; ')} (${tag})`);
  }
  return out;
}

const PROSE = /^[A-Z][a-z’']+(?:[ ,][A-Za-z’'—–-]+)+[.!?]?$/;

/** NO INVENTION: prose-like string literals and JSX text on lines added since BASE that appear nowhere in the BASE `corpus` files. */
export function newProse(file, corpus) {
  const base = readBaseFile(file) ?? '';
  const head = readRepoFile(file) ?? '';
  const baseLines = new Set(base.split('\n'));
  const known = corpus.map((f) => readBaseFile(f) ?? '').join('\n');
  const out = [];
  for (const line of head.split('\n')) {
    if (baseLines.has(line) || /^\s*(import|\/\/|\*|\/\*)/.test(line)) continue;
    const bits = [...line.matchAll(/'([^']{12,})'|"([^"]{12,})"|`([^`$]{12,})`|>([^<>{}]{12,})</g)].map((m) => (m[1] ?? m[2] ?? m[3] ?? m[4]).trim());
    for (const b of bits) if (PROSE.test(b) && !known.includes(b)) out.push(`${file}: new copy ${JSON.stringify(b)} (NO INVENTION)`);
  }
  return out;
}
