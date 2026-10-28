// council-copy-fixes A3: no tracked file outside the frozen/historical list still carries a before-string. Catches pins (goldens, route tables,
// structural greps) that would otherwise pin the old wording and fail a gate later. Uses `git grep` (tracked files only, no shell interpolation).
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const MAP = JSON.parse(readFileSync('.agent/memory/project/specs/council-1028/council-copy-fixes/goldens/copy-map.json', 'utf8'));
const needles = [...new Set([...MAP.entries.map((e) => e.before), ...MAP.pinSubs.map((p) => p.from)])];
const fails = [];
for (const needle of needles) {
  const r = spawnSync('git', ['grep', '-n', '-F', '-e', needle, '--', '.', ':!pnpm-lock.yaml'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0 && r.status !== 1) { console.error(`git grep failed for "${needle}": ${r.stderr}`); process.exit(2); }
  for (const line of (r.stdout || '').split('\n').filter(Boolean)) {
    const file = line.split(':')[0];
    if (MAP.frozenHistorical.some((p) => (p.endsWith('/') ? file.startsWith(p) : file === p))) continue;
    fails.push(`${file}: still carries "${needle}"`);
  }
}
if (fails.length) { console.error(`FAIL no-stale-strings: ${fails.length}`); for (const f of [...new Set(fails)]) console.error('  - ' + f); process.exit(1); }
console.log(`PASS no-stale-strings: ${needles.length} needles, no hits outside the frozen list`);
