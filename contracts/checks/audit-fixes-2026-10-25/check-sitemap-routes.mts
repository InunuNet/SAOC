// NOS sitemap contents, from the pure helpers the dev is to add in lib/nos-sitemap-routes.ts and from
// app/sitemap.ts wiring. The live sitemap is checked by live-probe.mjs.
import { readFileSync } from 'node:fs';

import * as routes from '../../../lib/nos-sitemap-routes.ts';

const problems: string[] = [];
const extra = routes.NOS_EXTRA_STATIC_ROUTES.map((r) => r.path);

if (!extra.includes('/contact')) problems.push('NOS_EXTRA_STATIC_ROUTES must include /contact');
for (const shared of ['/privacy', '/terms', '/refunds']) {
  // These canonicalise to the SAOC host on NOS (app/(shared)); listing them would put a
  // non-canonical URL in the NOS sitemap. See goldens/nos-sitemap.golden.md.
  if (extra.includes(shared)) problems.push(`${shared} must not be in the NOS sitemap (canonical is the SAOC host)`);
}

const paths = routes.nosTicketSlugPaths(['vip', 'weekend-pass', 'vip', 'Bad Slug', '../x', '', 'day-visitor']);
const expected = ['/tickets/day-visitor', '/tickets/vip', '/tickets/weekend-pass'];
if (JSON.stringify(paths) !== JSON.stringify(expected)) {
  problems.push(`nosTicketSlugPaths fixture: got ${JSON.stringify(paths)}, want ${JSON.stringify(expected)}`);
}

const sitemap = readFileSync('app/sitemap.ts', 'utf8');
if (!/from '@\/lib\/nos-sitemap-routes'/.test(sitemap)) problems.push('app/sitemap.ts does not import lib/nos-sitemap-routes');

if (problems.length) {
  console.error('FAIL\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('ok: NOS sitemap helpers match the golden');
