// F3: every token pinned in pg1.json sharedApi.files must still appear in its file (names NOS Site pins to).
import { existsSync, readFileSync } from 'node:fs';
const pg = JSON.parse(readFileSync('.agent/memory/project/specs/saoc-content-standard/goldens/pg1.json', 'utf8'));
const bad = [];
let checked = 0;
for (const [file, tokens] of Object.entries(pg.sharedApi.files)) {
  if (!existsSync(file)) { bad.push(`missing file ${file}`); continue; }
  const src = readFileSync(file, 'utf8');
  for (const t of tokens) { checked++; if (!src.includes(t)) bad.push(`${file}: lost "${t}"`); }
}
if (checked < 15) bad.push(`only ${checked} tokens checked`);
if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
console.log(`shared-api: ok (${checked} tokens)`);
