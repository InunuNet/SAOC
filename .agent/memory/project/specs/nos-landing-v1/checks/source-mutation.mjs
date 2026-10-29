// source-mutation: proves check-source.mjs has effect. Copies the spec's goldens into .tmp/sandbox/nos-landing-v1-srcmut, breaks one
// thing at a time, and requires check-source to exit non-zero each time (and zero on the untouched copy).
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const SPEC = '.agent/memory/project/specs/nos-landing-v1';
const BOX = '.tmp/sandbox/nos-landing-v1-srcmut';
const sandbox = `${BOX}/spec`;

function fresh() {
  spawnSync('python3', ['execution/safe_delete.py', BOX]);
  mkdirSync(`${sandbox}/goldens`, { recursive: true });
  cpSync(`${SPEC}/goldens`, `${sandbox}/goldens`, { recursive: true });
}
const run = () => spawnSync('node', [`${SPEC}/checks/check-source.mjs`], { env: { ...process.env, NLV_SPEC: sandbox }, encoding: 'utf8' }).status;
const edit = (file, fn) => { const p = `${sandbox}/goldens/${file}`; writeFileSync(p, fn(readFileSync(p, 'utf8'))); };
const json = (file, fn) => edit(file, (s) => { const o = JSON.parse(s); fn(o); return JSON.stringify(o, null, 1); });

const CASES = {
  'source edited after freeze (typo fixed)': () => edit('sources/content.md', (s) => s.replace('can be judges', 'can be judged')),
  'unit text corrected away from the source': () => json('copy.json', (o) => { o.units.find((u) => u.id === 'about-judging').text = o.units.find((u) => u.id === 'about-judging').text.replace('can be judges', 'can be judged'); }),
  'unit raw not on its line': () => json('copy.json', (o) => { o.units.find((u) => u.id === 'stat-2').line = 47; }),
  'classified line dropped': () => json('classification.json', (o) => { o.lines = o.lines.filter((l) => l.line !== 44); }),
  'instruction line given a unit': () => json('classification.json', (o) => { o.lines.find((l) => l.line === 31).units = ['hero-lede']; }),
  'italics list altered': () => json('copy.json', (o) => { o.units.find((u) => u.id === 'group-3-desc').em = []; }),
  'class counts lie': () => json('classification.json', (o) => { o.counts.copy += 1; }),
  'Ten heading corrected in the golden': () => json('copy.json', (o) => { const u = o.units.find((u) => u.id === 'judging-h2'); u.raw = 'Thirteen judging groups'; u.text = 'Thirteen judging groups'; }),
};

let bad = 0;
fresh();
if (run() !== 0) { bad += 1; console.log('BASELINE copy fails check-source'); }
for (const [name, fn] of Object.entries(CASES)) {
  fresh();
  fn();
  if (run() === 0) { bad += 1; console.log(`SURVIVED  ${name}`); } else console.log(`killed    ${name}`);
}
spawnSync('python3', ['execution/safe_delete.py', BOX]);
console.log(`source-mutation: ${Object.keys(CASES).length} mutants, ${bad} problem(s)`);
process.exit(bad ? 1 : 0);
