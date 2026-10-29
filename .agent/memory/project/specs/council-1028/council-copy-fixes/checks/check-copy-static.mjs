// council-copy-fixes A1: in each source file the before-string is absent and the after-string is present exactly `count` times
// (goldens/copy-map.json). Pure file reads, no server. The Drive copies and Sanity fixtures keep Lee-Ann's original wording and are not read here.
import { readFileSync } from 'node:fs';

const MAP = JSON.parse(readFileSync('.agent/memory/project/specs/council-1028/council-copy-fixes/goldens/copy-map.json', 'utf8'));
const count = (text, needle) => text.split(needle).length - 1;
const fails = [];
const cache = new Map();
const read = (f) => { if (!cache.has(f)) cache.set(f, readFileSync(f, 'utf8')); return cache.get(f); };

for (const e of MAP.entries) {
  const text = read(e.file);
  const b = count(text, e.before);
  const a = count(text, e.after);
  if (b !== 0) fails.push(`${e.id} ${e.file}: before-string still present x${b}: "${e.before}"`);
  if (a !== e.count) fails.push(`${e.id} ${e.file}: after-string present x${a}, want ${e.count}: "${e.after}"`);
}
if (fails.length) { console.error(`FAIL copy-static: ${fails.length}`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
console.log(`PASS copy-static: ${MAP.entries.length} entries`);
