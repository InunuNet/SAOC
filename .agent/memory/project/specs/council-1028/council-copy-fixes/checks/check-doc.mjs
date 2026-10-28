// council-copy-fixes A12: the feature doc names every copy-map id.
import { existsSync, readFileSync } from 'node:fs';

const MAP = JSON.parse(readFileSync('.agent/memory/project/specs/council-1028/council-copy-fixes/goldens/copy-map.json', 'utf8'));
const DOC = 'docs/council-copy-fixes-1028.md';
if (!existsSync(DOC)) { console.error(`FAIL doc: ${DOC} missing`); process.exit(1); }
const t = readFileSync(DOC, 'utf8');
const missing = MAP.entries.map((e) => e.id).filter((id) => !t.includes(id));
if (missing.length) { console.error(`FAIL doc: ${DOC} does not name ${missing.join(', ')}`); process.exit(1); }
console.log('PASS doc');
