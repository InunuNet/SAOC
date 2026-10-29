// Runs the nos-content-standard gates that cover these pages (A8 gate-verbatim; A7 gate-standard, which holds WE-G1 and PG-G1) in their
// normal mode (Sanity fixture replay) and fails only on failures that belong to /what-to-expect or /programme or name WE-G1 / PG-G1 / the WTE-sourced HM-G1 blocks (the home reads the same frozen source).
// Those two gates are red on main for unrelated reasons (nav label drift, sponsors, scroller; 63 + 1 failures recorded on 2026-10-29), so a
// raw exit code cannot show whether THIS change broke or fixed anything: the scope filter can. The unrelated count is printed, not hidden.
import { spawnSync } from 'node:child_process';

const GATES = ['gate-verbatim.mjs', 'gate-standard.mjs'];
// HM-G1 is scoped to the blocks that trace to the frozen What to Expect source (visit card hours, hero lede, closing band, the every-sentence trace); its
// Exhibit & trade block reads FAQ + nav labels and is red on main (Plant Entry/Registration vs Award Entries), so it is printed out of scope.
const SCOPE = /WE-G1|PG-G1|HM-G1 (the visit card|the hero lede|closing band|every visible sentence)|\[[^\]]*\/(what-to-expect|programme)[^\]]*\]/;
const mine = []; let other = 0;
for (const g of GATES) {
  const r = spawnSync('node', [`.agent/memory/project/specs/nos-content-standard/checks/${g}`], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  const out = `${r.stdout}\n${r.stderr}`;
  const fails = out.split('\n').filter((l) => l.startsWith('- '));
  console.log(`${g}: exit ${r.status}, ${fails.length} failure line(s)`);
  if (r.status !== 0 && fails.length === 0) mine.push(`${g} failed without a failure list: ${out.trim().split('\n').slice(-5).join(' | ').slice(0, 300)}`);
  for (const f of fails) (SCOPE.test(f) ? mine.push(`${g}: ${f.slice(0, 300)}`) : (other += 1));
}
console.log(`failures outside /what-to-expect and /programme (pre-existing, not gated here): ${other}`);
if (mine.length) { console.error(`check-old-gates FAILED (${mine.length} in scope):\n- ${mine.join('\n- ')}`); process.exit(1); }
console.log('check-old-gates pass: no WE-G1 / PG-G1 / WTE-sourced HM-G1 / what-to-expect / programme failure in A8 or A7');
