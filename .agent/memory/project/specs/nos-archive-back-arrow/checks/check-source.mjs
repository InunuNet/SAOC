// A1: zero U+2190 (and its escaped spellings) in the NOS route and component source. Roots and glyph list come from goldens/values.json.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SPEC = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const { sourceRoots, forbiddenGlyphs } = JSON.parse(readFileSync(`${SPEC}/goldens/values.json`, 'utf8'));
const EXT = /\.(tsx?|jsx?|css|mdx?|json)$/;
const hits = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = `${dir}/${name}`;
    const st = statSync(p);
    if (st.isDirectory()) { if (name !== 'node_modules') walk(p); continue; }
    if (!EXT.test(name)) continue;
    readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
      for (const g of forbiddenGlyphs) if (line.toLowerCase().includes(g.toLowerCase())) hits.push(`${p}:${i + 1} contains ${JSON.stringify(g)}`);
    });
  }
}
for (const root of sourceRoots) walk(root);
if (hits.length) { console.error(`NOS source still carries a system-glyph arrow:\n- ${hits.join('\n- ')}`); process.exit(1); }
console.log(`no U+2190 in ${sourceRoots.join(', ')}`);
