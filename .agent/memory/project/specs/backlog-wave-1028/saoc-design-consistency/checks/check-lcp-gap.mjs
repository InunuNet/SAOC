// F1e: the image-queuing gap closes. Lighthouse mobile (Slow 4G) on /about: LCP minus FCP <= goldens/lcp-bounds.json aboutLcpMinusFcpMaxMs. On the F1d baseline the gap was 4379 - 2272 = 2107 ms
// (the simulated graph queued the hero behind the CSS and fonts). NOS Design: the gate is LCP only; the LCP-FCP gap is REPORTED, never asserted. Also LCP <= 2500 ms on / (when it renders) and /about, measured on the local production build. Needs DC_PROD=1 or DC_BASE_URL.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { withSite, check, finish } from './lib.mjs';
const B = JSON.parse(readFileSync('.agent/memory/project/specs/backlog-wave-1028/saoc-design-consistency/goldens/lcp-bounds.json', 'utf8'));
// NOS Design ruling: the LCP gate is a deployed one, MEDIAN OF 3 runs on beta (DC_BASE_URL). Local runs are one run and `--report-only` (prints, never fails).
const REPORT = process.argv.includes('--report-only'); const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
await withSite(async ({ base, deployed, prod, live }) => {
  if (!prod && !live) { console.error('INCONCLUSIVE: LCP needs a production build (DC_PROD=1) or a deployed DC_BASE_URL'); process.exit(2); }
  for (const path of deployed ? ['/', '/about'] : ['/about']) {
    const runs = []; let failed = null;
    for (let i = 0; i < (live ? 3 : 1); i++) {
      const r = spawnSync('node', ['.agent/memory/project/specs/backlog-wave-1028/saoc-design-consistency/checks/lib-lcp-lighthouse.mjs', base + path], { encoding: 'utf8', timeout: 280000, env: process.env });
      if (r.status !== 0) { failed = (r.stderr || '').slice(-160); break; } runs.push(JSON.parse(r.stdout.trim().split('\n').pop()));
    }
    if (failed !== null) { check(false, `${path}: lighthouse run failed: ${failed}`); continue; }
    const j = { lcpMs: med(runs.map((x) => x.lcpMs)), fcpMs: med(runs.map((x) => x.fcpMs)) }; console.log(`${path} LCP ${j.lcpMs} FCP ${j.fcpMs} gap ${j.lcpMs - j.fcpMs} (median of ${runs.length}: ${runs.map((x) => x.lcpMs).join(', ')})`);
    if (REPORT) continue;
    check(j.lcpMs <= B.lcpMaxMs, `${path}: LCP ${j.lcpMs} ms, want <=${B.lcpMaxMs}`);
  }
});
finish('lcp-gap');
