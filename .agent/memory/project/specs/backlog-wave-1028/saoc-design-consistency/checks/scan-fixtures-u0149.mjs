// F1e glyph ruling, REPORT ONLY: lists every occurrence of U+0149 (deprecated, Afrikaans now writes 'n) in the Sanity fixtures. Never converts, never fails; exit 0 always. Hits go to Brad/Lee-Ann, not into the content.
import { readdirSync, readFileSync, statSync } from 'node:fs';
const DIR = '.agent/memory/project/specs/nos-content-standard/fixtures/sanity'; let hits = 0;
const walk = (d) => { for (const n of readdirSync(d)) { const p = `${d}/${n}`; if (statSync(p).isDirectory()) { walk(p); continue; } const t = readFileSync(p, 'utf8'); t.split('\n').forEach((line, i) => { if (line.includes('ŉ')) { hits++; const k = line.indexOf('ŉ'); console.log(`${p}:${i + 1}: ...${line.slice(Math.max(0, k - 30), k + 30).trim()}...`); } }); } };
walk(DIR); console.log(`U+0149 hits in ${DIR}: ${hits} (report only)`);
