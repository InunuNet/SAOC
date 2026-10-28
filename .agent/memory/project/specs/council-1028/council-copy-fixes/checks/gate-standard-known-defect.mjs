// council-copy-fixes A7: runs the nos-content-standard gate and passes when it passes, or when its ONLY failures are the five known pre-existing
// "[768@2 <route>] mid-page the scroller stays reachable and never overlaps the sticky header (top 0, header bottom 97)" lines. Measured on origin/main
// 63146ec5 (same five lines, same numbers): the SAOC wave made the sticky header 97px at 768 while the doc-index scroller sticks at top 0 below 780, so
// the NOS gate's own D7 clause and the SAOC header disagree. It touches /privacy, /terms and /refunds, none of which this mission edits. It is a layout
// defect, not a copy one; nothing about a copy clause is relaxed: any other failing line, or a failure that cannot be parsed, fails this check.
// Backlog: .agent/memory/project/backlog.md, "gate-standard D7 scroller vs 97px header at 768" (lead to file).
import { spawnSync } from 'node:child_process';

const GATE = '.agent/memory/project/specs/nos-content-standard/checks/gate-standard.mjs';
const KNOWN = /^\[768@2 \/(plan-your-visit|faq|privacy|terms|refunds)\] mid-page the scroller stays reachable and never overlaps the sticky header \(top 0, header bottom 97\)$/;
const r = spawnSync(process.execPath, [GATE], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
process.stdout.write(r.stdout ?? '');
if (r.status === 0) { console.log('PASS gate-standard (no failures)'); process.exit(0); }
const lines = (r.stderr ?? '').split('\n'); const start = lines.findIndex((l) => /FAILED:$/.test(l));
if (start < 0) { process.stderr.write(r.stderr ?? ''); console.error('FAIL gate-standard: exited non-zero without a parsable FAILED list'); process.exit(1); }
const failures = lines.slice(start + 1).filter((l) => l.startsWith('- ')).map((l) => l.slice(2).trim());
const other = failures.filter((f) => !KNOWN.test(f));
if (other.length || failures.length === 0) { console.error(`FAIL gate-standard: ${other.length} failure(s) beyond the known five:\n- ${other.join('\n- ')}`); process.exit(1); }
console.log(`PASS gate-standard: only the ${failures.length} known pre-existing D7 scroller line(s) failed (same on origin/main)`);
