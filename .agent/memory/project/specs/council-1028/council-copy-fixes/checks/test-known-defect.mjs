// Self-test of gate-standard-known-defect.mjs with stub gates (written to .tmp/sandbox/council-1028/stubs): all five pass, a subset fails, a sixth fails,
// a clean run passes, a run that visited fewer widths or routes fails, an unparsable failure fails.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const DIR = '.tmp/sandbox/council-1028/stubs'; mkdirSync(DIR, { recursive: true });
const ROUTES = ['about', 'archive', 'faq', 'international-guests', 'plan-your-visit', 'privacy', 'programme', 'refunds', 'sponsors', 'symposium', 'terms', 'vendors', 'workshops'];
const TAGS = ['390@3', '768@2', '1024@2', '1440@2'];
const notes = (routes = ROUTES, tags = TAGS) => tags.flatMap((t) => routes.map((r) => `[${t} /${r}] note`)).join('\n');
const line = (r) => `[768@2 /${r}] mid-page the scroller stays reachable and never overlaps the sticky header (top 0, header bottom 97)`;
const FIVE = ['plan-your-visit', 'faq', 'privacy', 'terms', 'refunds'];
const stub = (name, out, errLines, code) => { const f = `${DIR}/${name}.mjs`; writeFileSync(f, `console.log(${JSON.stringify(out)});${errLines ? `console.error(${JSON.stringify('standard FAILED:\n' + errLines.map((l) => '- ' + l).join('\n'))});` : ''}process.exit(${code});`); return f; };
const cases = [
  ['all five', stub('five', notes(), FIVE.map(line), 1), 0],
  ['clean run', stub('clean', notes(), null, 0), 0],
  ['subset (four of five)', stub('subset', notes(), FIVE.slice(1).map(line), 1), 1],
  ['five plus a sixth', stub('sixth', notes(), [...FIVE.map(line), '[1440@2 /faq] some other clause'], 1), 1],
  ['sixth only', stub('sixthonly', notes(), ['[1440@2 /faq] some other clause'], 1), 1],
  ['fewer widths visited', stub('widths', notes(ROUTES, ['768@2', '1440@2']), FIVE.map(line), 1), 1],
  ['fewer routes visited', stub('routes', notes(ROUTES.filter((r) => r !== 'terms')), FIVE.filter((r) => r !== 'terms').map(line), 1), 1],
  ['unparsable failure', stub('unparsable', notes(), null, 1), 1],
];
let bad = 0;
for (const [name, gate, want] of cases) {
  const r = spawnSync(process.execPath, ['.agent/memory/project/specs/council-1028/council-copy-fixes/checks/gate-standard-known-defect.mjs'], { encoding: 'utf8', env: { ...process.env, COUNCIL_GATE_SCRIPT: gate } });
  const ok = r.status === want; if (!ok) bad += 1; console.log(`${ok ? 'ok  ' : 'BAD '} ${name}: exit ${r.status}, want ${want}`);
}
if (bad) { console.error(`FAIL test-known-defect: ${bad} case(s) wrong`); process.exit(1); }
console.log('PASS test-known-defect');
