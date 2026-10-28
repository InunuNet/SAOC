// council-copy-fixes A7: runs the nos-content-standard gate and passes ONLY when it passes outright, or when its failure set EQUALS exactly the five known
// pre-existing "[768@2 <route>] mid-page the scroller stays reachable and never overlaps the sticky header (top 0, header bottom 97)" lines (one per route
// below, each once). Measured on origin/main 63146ec5: the same five lines. The SAOC wave made the sticky header 97px at 768 while the doc-index scroller
// sticks at top 0 below 780, so the NOS gate's D7 clause and the SAOC header disagree. A subset fails (a skipped route must not hide behind the
// tolerance), a sixth failure fails, and so does a failure list that cannot be parsed. It is a layout defect, not a copy one; no copy clause is relaxed.
// Coverage floor: the gate's own output must still mention every viewport and route it mentioned on origin/main, or the run visited fewer than expected.
// Backlog: .agent/memory/backlog.md "gate-standard D7 scroller vs 97px header at 768" (lead files it).
// COUNCIL_GATE_SCRIPT overrides the gate path for the self-test (checks/test-known-defect.mjs); never set it in a contract.
import { spawnSync } from 'node:child_process';

const GATE = process.env.COUNCIL_GATE_SCRIPT ?? '.agent/memory/project/specs/nos-content-standard/checks/gate-standard.mjs';
const KNOWN_ROUTES = ['plan-your-visit', 'faq', 'privacy', 'terms', 'refunds'];
const KNOWN = KNOWN_ROUTES.map((r) => `[768@2 /${r}] mid-page the scroller stays reachable and never overlaps the sticky header (top 0, header bottom 97)`).sort();
const FLOOR_TAGS = ['390@3', '768@2', '1024@2', '1440@2'];
const FLOOR_ROUTES = ['about', 'archive', 'faq', 'international-guests', 'plan-your-visit', 'privacy', 'programme', 'refunds', 'sponsors', 'symposium', 'terms', 'vendors', 'workshops'];

const r = spawnSync(process.execPath, [GATE], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
process.stdout.write(r.stdout ?? '');
const seen = new Set(); const seenRoutes = new Set();
for (const m of (r.stdout ?? '').matchAll(/^\[(\d+@\d) \/([^\]\s]+)[^\]]*\]/gm)) { seen.add(m[1]); seenRoutes.add(m[2]); }
const fails = [];
for (const t of FLOOR_TAGS) if (!seen.has(t)) fails.push(`coverage: the gate output no longer mentions viewport ${t} (it visited fewer widths than on origin/main)`);
for (const rt of FLOOR_ROUTES) if (!seenRoutes.has(rt)) fails.push(`coverage: the gate output no longer mentions route /${rt} (it visited fewer routes than on origin/main)`);

if (r.status !== 0) {
  const lines = (r.stderr ?? '').split('\n'); const start = lines.findIndex((l) => /FAILED:$/.test(l));
  if (start < 0) fails.push('the gate exited non-zero without a parsable FAILED list');
  else {
    const failures = lines.slice(start + 1).filter((l) => l.startsWith('- ')).map((l) => l.slice(2).trim()).sort();
    if (JSON.stringify(failures) !== JSON.stringify(KNOWN)) {
      const extra = failures.filter((f) => !KNOWN.includes(f)); const missing = KNOWN.filter((k) => !failures.includes(k));
      if (extra.length) fails.push(`${extra.length} failure(s) beyond the known five:\n  - ${extra.join('\n  - ')}`);
      if (missing.length) fails.push(`${missing.length} of the known five did NOT fail (a route or width was skipped, or the defect was fixed: then drop it from this wrapper):\n  - ${missing.join('\n  - ')}`);
      if (!extra.length && !missing.length) fails.push('the known five appear with different multiplicity');
    }
  }
}
if (fails.length) { console.error(`FAIL gate-standard-known-defect:\n- ${fails.join('\n- ')}`); process.exit(1); }
console.log(r.status === 0 ? 'PASS gate-standard (no failures)' : 'PASS gate-standard: failure set equals exactly the five known pre-existing D7 scroller lines (same on origin/main)');
