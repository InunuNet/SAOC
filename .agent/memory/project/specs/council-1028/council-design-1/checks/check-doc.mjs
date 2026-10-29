// council-design-1: the feature doc names the four rulings, the role classes and the asset path.
import { existsSync, readFileSync } from 'node:fs';

const DOC = 'docs/council-design-1.md';
if (!existsSync(DOC)) { console.error(`FAIL doc: ${DOC} missing`); process.exit(1); }
const t = readFileSync(DOC, 'utf8');
const need = ['C1', 'C3', 'C4', 'C5', 'btn-caps', 't-label', 't-crumb', 't-num', 't-field', 'public/images/saoc/lockup', 'Simple Icons', 'COUNCIL-1'];
const missing = need.filter((n) => !t.includes(n));
if (missing.length) { console.error(`FAIL doc: ${DOC} does not mention ${missing.join(', ')}`); process.exit(1); }
console.log('PASS doc');
