// council-design-1 C4 supersedes the F1e cap "<=4 font files per SAOC route" with "<=3, two families". The F1e fonts-network gate is edited in place
// (MAX 3) and the F1e contract's A2/A19 descriptions carry the supersession note, so main's checks stay consistent.
import { readFileSync } from 'node:fs';

const D = '.agent/memory/project/specs/backlog-wave-1028/saoc-design-consistency';
const net = readFileSync(`${D}/checks/check-fonts-network.mjs`, 'utf8');
const f1e = readFileSync(`${D}/f1e-critical-path/contract.yaml`, 'utf8');
const doc = readFileSync('docs/saoc-design-consistency.md', 'utf8');
const fails = [];
if (!/distinct\.size <= 3/.test(net) || /distinct\.size <= 4/.test(net)) fails.push('check-fonts-network.mjs must assert distinct.size <= 3 (COUNCIL-1 C4), not <= 4');
if (!/COUNCIL-1/.test(net)) fails.push('check-fonts-network.mjs carries no COUNCIL-1 note at the cap');
for (const id of ['A2', 'A19']) {
  const m = f1e.match(new RegExp(`- id: ${id}\\n(?:\\s+.*\\n){0,3}?\\s+description: "([^"]*)"`));
  if (!m || !/COUNCIL-1/.test(m[1]) || /<=4/.test(m[1])) fails.push(`F1e contract ${id} description must say <=3 and cite COUNCIL-1 (no "<=4")`);
}
if (!/COUNCIL-1/.test(doc)) fails.push('docs/saoc-design-consistency.md does not record the COUNCIL-1 cap change');
if (fails.length) { console.error(`FAIL f1e-supersession: ${fails.length}`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
console.log('PASS f1e-supersession');
