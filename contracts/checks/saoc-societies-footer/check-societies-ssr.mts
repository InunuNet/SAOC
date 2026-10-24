// Finding (e): the society cards are in the server-rendered HTML. components/societies/SocietiesGrid.tsx is a
// server-safe component (no hooks, no useSearchParams) that renders every society's card. The page uses it as
// the Suspense fallback of the client filter, which is what Next emits in the static HTML when the client
// component bails out on useSearchParams. Here it is rendered the way the server does.
// Run as: pnpm exec tsx contracts/checks/saoc-societies-footer/check-societies-ssr.mts
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { SocietiesGrid } from '../../../components/societies/SocietiesGrid.tsx';

const fixture = JSON.parse(readFileSync('contracts/golden/saoc-societies-footer/societies-fixture.json', 'utf8'));
const failures: string[] = [];

const filled = fixture.societies.map((s: Record<string, unknown>) => ({
  founded: null, region: null, meets: null, venue: null, memberCount: null, description: null, logo: null, website: null, markBadge: null,
  ...s,
}));
const html = renderToStaticMarkup(createElement(SocietiesGrid, { societies: filled }));

for (const s of fixture.societies) {
  const hrefs = html.match(new RegExp(`<a [^>]*href="/societies/${s.slug}"`, 'g')) ?? [];
  if (hrefs.length !== 1) failures.push(`expected exactly 1 link to /societies/${s.slug}, found ${hrefs.length}`);
  if (!html.includes(s.name)) failures.push(`card title missing for ${s.name}`);
}
const allLinks = html.match(/<a [^>]*href="\/societies\/[^"]+"/g) ?? [];
if (allLinks.length !== fixture.societies.length) failures.push(`expected ${fixture.societies.length} society links, found ${allLinks.length}`);
if (html.includes('animate-pulse')) failures.push('grid still renders skeleton blocks');

const empty = renderToStaticMarkup(createElement(SocietiesGrid, { societies: [] }));
if (/href="\/societies\//.test(empty)) failures.push('empty list rendered a link');

if (failures.length > 0) {
  console.error('FAIL\n' + failures.join('\n'));
  process.exit(1);
}
console.log(`PASS: ${allLinks.length} society links in server-rendered grid`);
