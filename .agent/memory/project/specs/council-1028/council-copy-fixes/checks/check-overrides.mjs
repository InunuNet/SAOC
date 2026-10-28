// council-copy-fixes A6: the overrides file the content gates read exists, has the right shape and covers every map entry and pin fragment, and
// the shared gate library actually applies it (so the frozen Drive text is compared in its corrected form).
import { existsSync, readFileSync } from 'node:fs';

const MAP = JSON.parse(readFileSync('.agent/memory/project/specs/council-1028/council-copy-fixes/goldens/copy-map.json', 'utf8'));
const FILE = '.agent/memory/project/specs/nos-content-standard/goldens/council-overrides.json';
const LIB = '.agent/memory/project/specs/nos-content-standard/checks/_lib.mjs';
const fails = [];
if (!existsSync(FILE)) fails.push(`${FILE} does not exist`);
else {
  const o = JSON.parse(readFileSync(FILE, 'utf8'));
  if (o.schema !== 'council.overrides/v1') fails.push(`schema is "${o.schema}", want council.overrides/v1`);
  const have = new Set((o.substitutions ?? []).map((s) => `${s.from}\u0000${s.to}`));
  for (const e of MAP.entries) {
    // Only copy that Lee-Ann's frozen text carries needs an override (the vendor form and code-only constants are not in the Drive mirrors).
    if (e.routes && !have.has(`${e.before}\u0000${e.after}`) && !(o.substitutions ?? []).some((s) => e.before.includes(s.from) && e.after.includes(s.to))) fails.push(`${e.id}: no override covers "${e.before}"`);
  }
  for (const p of MAP.pinSubs) if (!have.has(`${p.from}\u0000${p.to}`)) fails.push(`pin fragment "${p.from}" has no override`);
}
if (!existsSync(LIB) || !/council-overrides\.json/.test(readFileSync(LIB, 'utf8'))) fails.push(`${LIB} does not read council-overrides.json`);
if (fails.length) { console.error(`FAIL overrides: ${fails.length}`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
console.log('PASS overrides');
