// F1d (SA-9): Lighthouse mobile LCP (standard simulated Slow 4G + 4x CPU) <= 2500 ms on / and /about. DEPLOYED check: it
// needs DC_BASE_URL (a production-built origin) because a dev server's LCP is meaningless. Credentials come from
// BETA_BASIC_AUTH_USER/PASSWORD inside lib-lcp-lighthouse.mjs. Exit 2 (inconclusive) when DC_BASE_URL is unset.
import { spawnSync } from 'node:child_process';
const base = process.env.DC_BASE_URL;
if (!base) { console.error('INCONCLUSIVE: set DC_BASE_URL to a production-built origin'); process.exit(2); }
const LIMIT = 2500; const bad = [];
for (const path of ['/', '/about']) {
  const r = spawnSync('node', ['.agent/memory/project/specs/backlog-wave-1028/saoc-design-consistency/checks/lib-lcp-lighthouse.mjs', base + path], { encoding: 'utf8', timeout: 260000 });
  if (r.status !== 0) { console.error(`${path}: lighthouse run failed`); process.exit(3); }
  const j = JSON.parse(r.stdout.trim().split('\n').pop()); console.log(path, 'LCP', j.lcpMs, 'ms');
  if (j.lcpMs > LIMIT) bad.push(`${path} LCP ${j.lcpMs} ms > ${LIMIT}`);
}
if (bad.length) { console.error('FAIL lcp:\n  - ' + bad.join('\n  - ')); process.exit(1); }
console.log('PASS lcp');
