// council-design-1: no existing check silently keeps pinning the retired facts (JetBrains Mono, font-mono, --mono, mono-label, SaocLockup in the SAOC footer, Lora).
// Rescans executable checks; every hit file must be classified in goldens/superseded-checks.json and carry the COUNCIL-1 marker when updated.
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const MAN = JSON.parse(readFileSync('.agent/memory/project/specs/council-1028/council-design-1/goldens/superseded-checks.json', 'utf8'));
const byFile = new Map(MAN.entries.map((e) => [e.file, e]));
const EXEC = /\.(mjs|mts|ts|sh|cjs|py|js)$/;
const fails = [];
const r = spawnSync('git', ['grep', '-l', '-i', '-E', '-e', 'font-mono|jetbrains|--mono\\b|mono-label|SaocLockup|\\bLora\\b', '--', 'contracts/checks', 'e2e', '.agent/memory/project/specs', ':!.agent/memory/project/specs/council-1028'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
if (r.status > 1) { console.error(r.stderr); process.exit(2); }
const hits = (r.stdout || '').split('\n').filter((f) => f && EXEC.test(f));
for (const f of hits) {
  const e = byFile.get(f);
  if (!e) { fails.push(`${f}: names a retired fact and is not in superseded-checks.json (classify it)`); continue; }
  if (e.disposition === 'unreviewed' || !['update', 'retire', 'keep'].includes(e.disposition)) { fails.push(`${f}: disposition "${e.disposition}"`); continue; }
  if (e.disposition === 'keep' && (e.note ?? '').length < 20) fails.push(`${f}: keep needs a reason of 20+ characters`);
  if (e.disposition !== 'keep' && !/COUNCIL-1/.test(readFileSync(f, 'utf8'))) fails.push(`${f}: still names a retired fact but is marked ${e.disposition} and carries no COUNCIL-1 marker (a remaining hit must be explained where it stands)`);
}
for (const e of MAN.entries) if (!existsSync(e.file) && e.disposition !== 'retire') fails.push(`${e.file}: listed but missing and not marked retire`);
if (fails.length) { console.error(`FAIL superseded: ${fails.length}`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
console.log(`PASS superseded: ${hits.length} hit file(s) all classified`);
