// F1e: the image-queuing gap closes. Lighthouse mobile (Slow 4G) on /about: LCP minus FCP <= goldens/lcp-bounds.json aboutLcpMinusFcpMaxMs. On the F1d baseline the gap was 4379 - 2272 = 2107 ms
// (the simulated graph queued the hero behind the CSS and fonts). Also LCP <= 2500 ms on / (when it renders) and /about, measured on the local production build. Needs DC_PROD=1 or DC_BASE_URL.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { withSite, check, finish } from './lib.mjs';
const B = JSON.parse(readFileSync('.agent/memory/project/specs/backlog-wave-1028/saoc-design-consistency/goldens/lcp-bounds.json', 'utf8'));
await withSite(async ({ base, deployed, prod, live }) => {
  if (!prod && !live) { console.error('INCONCLUSIVE: LCP needs a production build (DC_PROD=1) or a deployed DC_BASE_URL'); process.exit(2); }
  for (const path of deployed ? ['/', '/about'] : ['/about']) {
    const r = spawnSync('node', ['.agent/memory/project/specs/backlog-wave-1028/saoc-design-consistency/checks/lib-lcp-lighthouse.mjs', base + path], { encoding: 'utf8', timeout: 280000, env: process.env });
    if (r.status !== 0) { check(false, `${path}: lighthouse run failed: ${(r.stderr || '').slice(-160)}`); continue; }
    const j = JSON.parse(r.stdout.trim().split('\n').pop()); console.log(`${path} LCP ${j.lcpMs} FCP ${j.fcpMs} gap ${j.lcpMs - j.fcpMs}`);
    check(j.lcpMs <= B.lcpMaxMs, `${path}: LCP ${j.lcpMs} ms, want <=${B.lcpMaxMs}`);
    if (path === '/about') check(j.lcpMs - j.fcpMs <= B.aboutLcpMinusFcpMaxMs, `/about: LCP-FCP ${j.lcpMs - j.fcpMs} ms, want <=${B.aboutLcpMinusFcpMaxMs} (the hero request is still queued behind CSS/fonts)`);
  }
});
finish('lcp-gap');
