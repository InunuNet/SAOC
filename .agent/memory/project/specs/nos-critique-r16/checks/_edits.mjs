// nos-critique-r16 exact-edit helpers (QA input, hash-locked).
import { readBaseFile, readRepoFile } from './_lib.mjs';

/**
 * A file must equal its BASE text with exactly the given line edits ({ line, from, to }, BASE numbering) applied and the inclusive BASE
 * line ranges in `drops` removed. Returns failure strings (empty when it matches), naming the first differing lines.
 */
export function exactEdits(file, edits, drops = [], tag = 'S1') {
  const base = readBaseFile(file);
  const head = readRepoFile(file);
  if (base === null || head === null) return [`${file}: missing at ${base === null ? 'BASE' : 'HEAD'} (${tag})`];
  const lines = base.split('\n');
  const out = [];
  for (const e of edits) if (lines[e.line - 1] !== e.from) out.push(`${file}:${e.line}: BASE line is not the golden \`from\` (${tag})`);
  const dropped = new Set();
  for (const [a, b] of drops) for (let n = a; n <= b; n++) dropped.add(n);
  const want = [];
  lines.forEach((l, i) => { if (dropped.has(i + 1)) return; const e = edits.find((x) => x.line === i + 1); want.push(e ? e.to : l); });
  const h = head.split('\n');
  if (h.join('\n') !== want.join('\n')) {
    const diff = [];
    for (let i = 0; i < Math.max(h.length, want.length) && diff.length < 3; i++) {
      if (h[i] === want[i]) continue;
      const a = h[i] ?? '<eof>'; const b = want[i] ?? '<eof>';
      let k = 0; while (k < a.length && a[k] === b[k]) k++;
      const at = Math.max(0, k - 30);
      diff.push(`line ${i + 1} col ${k + 1}: got ${JSON.stringify(a.slice(at, at + 80))}, want ${JSON.stringify(b.slice(at, at + 80))}`);
    }
    out.push(`${file}: not BASE + exactly the golden edits: ${diff.join('; ')} (${tag})`);
  }
  return out;
}

const PROSE = /^[A-Z][a-z’']+(?:[ ,][A-Za-z’'—–-]+)+[.!?]?$/;

/** NO INVENTION: prose-like string literals and JSX text on lines added since BASE that appear nowhere in the BASE `corpus` files. */
// `allow` lists the ruling's own strings (verbatim); `caseOnly` also accepts a BASE string whose only change is letter case (the
// sentence-case rulings).
export function newProse(file, corpus, opts = {}) {
  const allow = opts.allow ?? [];
  const caseOnly = opts.caseOnly === true;
  const base = readBaseFile(file) ?? '';
  const head = readRepoFile(file) ?? '';
  const baseLines = new Set(base.split('\n'));
  const known = corpus.map((f) => readBaseFile(f) ?? '').join('\n');
  const knownLower = known.toLowerCase();
  const out = [];
  for (const line of head.split('\n')) {
    if (baseLines.has(line) || /^\s*(import|\/\/|\*|\/\*)/.test(line)) continue;
    const bits = [...line.matchAll(/'([^']{12,})'|"([^"]{12,})"|`([^`$]{12,})`|>([^<>{}]{12,})</g)].map((m) => (m[1] ?? m[2] ?? m[3] ?? m[4]).trim());
    for (const b of bits) if (PROSE.test(b) && !known.includes(b) && !allow.includes(b) && !(caseOnly && knownLower.includes(b.toLowerCase()))) out.push(`${file}: new copy ${JSON.stringify(b)} (NO INVENTION)`);
  }
  return out;
}
