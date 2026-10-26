// F3: pg1.json routes vs standard.json. Fails on a route not in standard.json, an excluded id present, or an ungated standard route missing.
import { readFileSync } from 'node:fs';
const SPEC = '.agent/memory/project/specs/saoc-content-standard';
const pg = JSON.parse(readFileSync(`${SPEC}/goldens/pg1.json`, 'utf8'));
const std = JSON.parse(readFileSync(`${SPEC}/goldens/standard.json`, 'utf8'));
const byId = new Map(std.routes.map((r) => [r.id, r]));
const bad = [];
for (const r of pg.routes) {
  const s = byId.get(r.id);
  if (!s) bad.push(`pg1 route ${r.id} is not in standard.json`);
  else if (s.path !== r.path) bad.push(`pg1 route ${r.id} path ${r.path} != standard.json ${s.path}`);
  if (pg.outOfScope.includes(r.id)) bad.push(`pg1 route ${r.id} is an out-of-scope exception`);
}
for (const s of std.routes.filter((x) => !x.gated)) if (!pg.routes.some((r) => r.id === s.id)) bad.push(`standard.json route ${s.id} missing from pg1.json`);
if (pg.routes.length < 8) bad.push(`only ${pg.routes.length} routes`);
if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
console.log(`route-list: ok (${pg.routes.length} routes)`);
