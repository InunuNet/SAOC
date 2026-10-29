// council-copy-fixes A3: no tracked file outside the frozen/historical list still carries a before-string. Catches pins (goldens, route tables,
// structural greps) that would otherwise pin the old wording and fail a gate later. Uses `git grep` (tracked files only, no shell interpolation).
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const MAP = JSON.parse(readFileSync('.agent/memory/project/specs/council-1028/council-copy-fixes/goldens/copy-map.json', 'utf8'));
const needles = [...new Set([...MAP.entries.map((e) => e.before), ...MAP.pinSubs.map((p) => p.from)])];
// Files that carry an old string BY DESIGN, allowlisted by exact path with the reason. Nothing may be hidden behind escaping: check-overrides.mjs (A6)
// rejects \\u00xx escapes of printable ASCII in council-overrides.json, so its `from` strings are plain, greppable text and are allowed here openly.
const ALLOWED_BY_DESIGN = new Map([
  ['.agent/memory/project/specs/nos-content-standard/goldens/council-overrides.json', 'the overrides map the frozen Lee-Ann wording (from) to the corrected wording (to) at read time; the old string is its input'],
  ['.agent/memory/project/specs/council-1028/council-copy-fixes/goldens/sanity-exceptions.json', 'the Sanity-vs-Drive exception list pairs the frozen Drive wording with what Sanity now holds'],
]);
const fails = [];
for (const needle of needles) {
  const r = spawnSync('git', ['grep', '-n', '-F', '-e', needle, '--', '.', ':!pnpm-lock.yaml'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0 && r.status !== 1) { console.error(`git grep failed for "${needle}": ${r.stderr}`); process.exit(2); }
  for (const line of (r.stdout || '').split('\n').filter(Boolean)) {
    const file = line.split(':')[0];
    if (ALLOWED_BY_DESIGN.has(file)) continue;
    if (MAP.frozenHistorical.some((p) => (p.endsWith('/') ? file.startsWith(p) : file === p))) continue;
    fails.push(`${file}: still carries "${needle}"`);
  }
}
if (fails.length) { console.error(`FAIL no-stale-strings: ${fails.length}`); for (const f of [...new Set(fails)]) console.error('  - ' + f); process.exit(1); }
console.log(`PASS no-stale-strings: ${needles.length} needles, no hits outside the frozen list`);
