// F1c A0 companion: the set of files under checks/ must EQUAL the set pinned in goldens/checks.sha256 (an unpinned file and a missing pinned file both fail), and every relative import or checks/<file> path a
// check references must itself be a pinned file. `shasum -a 256 -c` (A0's first half) proves the pinned bytes; this proves nothing unpinned can run beside them.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative, dirname } from 'node:path';
const ROOT = process.cwd(); const SPEC = '.agent/memory/project/specs/backlog-wave-1028/saoc-design-consistency';
const DIR = `${SPEC}/checks`; const PIN = `${SPEC}/goldens/checks.sha256`;
const fails = [];
const pinned = new Set(readFileSync(PIN, 'utf8').split('\n').filter(Boolean).map((l) => l.trim().split(/\s+/).slice(1).join(' ')));
const walk = (d) => readdirSync(join(ROOT, d)).flatMap((n) => { const p = `${d}/${n}`; return statSync(join(ROOT, p)).isDirectory() ? walk(p) : [p]; });
const present = new Set(walk(DIR));
for (const f of present) if (!pinned.has(f)) fails.push(`unpinned file under checks/: ${f}`);
for (const f of pinned) if (!present.has(f)) fails.push(`pinned file missing from checks/: ${f}`);
for (const f of present) {
  if (!f.endsWith('.mjs')) continue; const src = readFileSync(join(ROOT, f), 'utf8');
  for (const m of src.matchAll(/(?:from|import\s{0,3}\()\s{0,3}['"](\.{1,2}\/[^'"]+)['"]/g)) { const t = relative(ROOT, resolve(dirname(join(ROOT, f)), m[1])); if (!pinned.has(t)) fails.push(`${f} imports ${m[1]} (${t}), which is not pinned`); }
  for (const m of src.matchAll(/checks\/([\w.-]+\.mjs)/g)) if (!pinned.has(`${DIR}/${m[1]}`)) fails.push(`${f} references checks/${m[1]}, which is not pinned`);
}
if (fails.length) { console.error(`FAIL verify-pins: ${fails.length} problem(s)`); for (const x of fails) console.error('  - ' + x); process.exit(1); }
console.log(`PASS verify-pins (${present.size} files under checks/, all pinned)`);
