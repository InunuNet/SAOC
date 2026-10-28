// A1: zero U+2190 (and its escaped spellings) in every non-binary file under the NOS route and component roots. Roots and glyph list come from goldens/values.json.
import { closeSync, openSync, readFileSync, readSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SPEC = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const { sourceRoots, forbiddenGlyphs } = JSON.parse(readFileSync(`${SPEC}/goldens/values.json`, 'utf8'));
const SNIFF_BYTES = 8192;
const hits = [];

/** A file is binary when a NUL byte appears in its first 8KB: the only files skipped. */
function isBinary(path) {
  const fd = openSync(path, 'r');
  try {
    const buf = Buffer.alloc(SNIFF_BYTES);
    return buf.subarray(0, readSync(fd, buf, 0, SNIFF_BYTES, 0)).includes(0);
  } finally { closeSync(fd); }
}

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = `${dir}/${name}`;
    const st = statSync(p);
    if (st.isDirectory()) { if (name !== 'node_modules') walk(p); continue; }
    if (isBinary(p)) continue;
    readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
      for (const g of forbiddenGlyphs) if (line.toLowerCase().includes(g.toLowerCase())) hits.push(`${p}:${i + 1} contains ${JSON.stringify(g)}`);
    });
  }
}
for (const root of sourceRoots) walk(root);
if (hits.length) { console.error(`NOS source still carries a system-glyph arrow:\n- ${hits.join('\n- ')}`); process.exit(1); }
console.log(`no U+2190 in ${sourceRoots.join(', ')}`);
