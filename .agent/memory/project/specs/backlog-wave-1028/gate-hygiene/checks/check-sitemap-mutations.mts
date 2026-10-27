// gate-hygiene item 1: the two sitemap checks must also FAIL on a deliberately broken sitemap, not only pass on a good one.
// For each mutation: rewrite one source file in place, run the named check, require a non-zero exit, restore the file byte-for-byte
// in a finally (and on exit/signals). Nothing outside the named source files is touched; no Sanity or Firestore.
// Run as: pnpm exec tsx <this file> (from the checkout under test)
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const SAOC_CHECK = 'contracts/checks/saoc-seo-polish/check-sitemap-routes.mts';
const NOS_CHECK = 'contracts/checks/audit-fixes-2026-10-25/check-sitemap-routes.mts';
const mutations = [
  { id: 'M1 drop /about from SAOC_STATIC_ROUTES', file: 'lib/saoc-sitemap-routes.ts', from: "  { path: '/about', changeFrequency: 'monthly', priority: 0.8 },\n", to: '', check: SAOC_CHECK },
  { id: 'M2 list /media-kit (gated, must stay out) in SAOC sitemap', file: 'lib/saoc-sitemap-routes.ts', from: "  { path: '/about',", to: "  { path: '/media-kit', changeFrequency: 'yearly', priority: 0.1 },\n  { path: '/about',", check: SAOC_CHECK },
  { id: 'M3 list /privacy (canonical is the SAOC host) in NOS_EXTRA_STATIC_ROUTES', file: 'lib/nos-sitemap-routes.ts', from: "  { path: '/contact',", to: "  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },\n  { path: '/contact',", check: NOS_CHECK },
  { id: 'M4 drop /contact from NOS_EXTRA_STATIC_ROUTES', file: 'lib/nos-sitemap-routes.ts', from: "  { path: '/contact', changeFrequency: 'yearly', priority: 0.5 },\n", to: '', check: NOS_CHECK },
];

const failures: string[] = [];
const originals = new Map<string, string>();
const restore = () => { for (const [file, text] of originals) writeFileSync(file, text); };
process.on('exit', restore);
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => { restore(); process.exit(130); });

const run = (check: string) => spawnSync('pnpm', ['exec', 'tsx', check], { encoding: 'utf8' });

for (const check of [SAOC_CHECK, NOS_CHECK]) {
  const base = run(check);
  if (base.status !== 0) failures.push(`baseline ${check} does not pass unmutated: ${(base.stderr || base.stdout).slice(0, 300)}`);
}
for (const m of mutations) {
  const text = readFileSync(m.file, 'utf8');
  if (!text.includes(m.from)) { failures.push(`${m.id}: anchor text not found in ${m.file}`); continue; }
  originals.set(m.file, text);
  try {
    writeFileSync(m.file, text.replace(m.from, m.to));
    const r = run(m.check);
    if (r.status === 0) failures.push(`${m.id}: check still PASSED on the broken sitemap`);
  } finally {
    writeFileSync(m.file, text);
    originals.delete(m.file);
  }
}
if (failures.length) { console.error('FAIL\n' + failures.join('\n')); process.exit(1); }
console.log(`PASS: both sitemap checks pass unmutated and fail on all ${mutations.length} mutations`);
