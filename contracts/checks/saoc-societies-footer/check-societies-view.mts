// Findings (f) counts and (g) eyebrow. lib/societies-view.ts provinceCounts() drives the chip counts;
// SocietyCard always renders its province eyebrow line so titles align across a row.
// Run as: pnpm exec tsx contracts/checks/saoc-societies-footer/check-societies-view.mts
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { SocietyCard } from '../../../components/societies/SocietyCard.tsx';
import { provinceCounts } from '../../../lib/societies-view.ts';

const fixture = JSON.parse(readFileSync('contracts/golden/saoc-societies-footer/societies-fixture.json', 'utf8'));
const failures: string[] = [];

// (f) counts come from the data, case-insensitively, ALL is the total, an empty province is 0.
const counts = provinceCounts(fixture.societies, fixture.provinces);
if (JSON.stringify(counts) !== JSON.stringify(fixture.expectedCounts)) {
  failures.push(`provinceCounts ${JSON.stringify(counts)} != ${JSON.stringify(fixture.expectedCounts)}`);
}
const bigger = provinceCounts([...fixture.societies, { province: 'EC' }], fixture.provinces);
if (bigger.EC !== 1 || bigger.ALL !== 7) failures.push('counts are not computed from the input (hard-coded?)');

// (g) the eyebrow line is reserved whether or not the province is present.
const base = { founded: null, region: null, meets: null, venue: null, memberCount: null, description: null, logo: null, website: null, markBadge: null };
const eyebrowOf = (html: string) => html.match(/<p class="([^"]*uppercase[^"]*)"([^>]*)>([\s\S]*?)<\/p>/);
const withProv = eyebrowOf(renderToStaticMarkup(createElement(SocietyCard, { society: { ...base, _id: 'a', name: 'A', slug: 'a', province: 'WC' } })));
const noProv = eyebrowOf(renderToStaticMarkup(createElement(SocietyCard, { society: { ...base, _id: 'b', name: 'B', slug: 'b', province: null } })));
if (!withProv) failures.push('no eyebrow element with a province');
if (!noProv) failures.push('no eyebrow element when province is null (the line is not reserved)');
if (withProv && noProv) {
  if (withProv[1] !== noProv[1]) failures.push(`eyebrow classes differ: "${withProv[1]}" vs "${noProv[1]}"`);
  if (withProv[3].trim() !== 'WC' || withProv[2].includes('aria-hidden')) failures.push('present eyebrow must show the province and not be aria-hidden');
  if (!noProv[2].includes('aria-hidden="true"')) failures.push('reserved eyebrow must be aria-hidden');
  if (noProv[3] !== ' ' && noProv[3] !== '&nbsp;' && noProv[3] !== '&#160;') failures.push(`reserved eyebrow must contain only a non-breaking space, got ${JSON.stringify(noProv[3])}`);
}

if (failures.length > 0) {
  console.error('FAIL\n' + failures.join('\n'));
  process.exit(1);
}
console.log('PASS: province counts from data, eyebrow reserved');
