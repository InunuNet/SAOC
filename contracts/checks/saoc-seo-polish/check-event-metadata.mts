// Finding (c): lib/event-metadata.ts buildEventMetadata(event, slug) is what generateMetadata returns
// for /events/[slug]. Proves (1) a description exists when event.description is empty, built only from
// title, dates and venue, (2) og:url and canonical follow the configured site origin, not a literal.
// Run as: pnpm exec tsx contracts/checks/saoc-seo-polish/check-event-metadata.mts
import { readFileSync } from 'node:fs';

const golden = JSON.parse(readFileSync('contracts/golden/saoc-seo-polish/event-metadata-fixtures.json', 'utf8'));
process.env.NEXT_PUBLIC_SAOC_SITE_URL = golden.origin;
const { buildEventMetadata } = await import('../../../lib/event-metadata.ts');

const failures: string[] = [];
for (const c of golden.cases) {
  const md = buildEventMetadata(c.event, c.slug);
  const url = `${golden.origin}/events/${c.slug}`;
  if (md.description !== c.expectedDescription) failures.push(`${c.name}: description ${JSON.stringify(md.description)} != ${JSON.stringify(c.expectedDescription)}`);
  if (md.title !== c.event.title) failures.push(`${c.name}: title ${JSON.stringify(md.title)}`);
  if (md.openGraph?.url !== url) failures.push(`${c.name}: og:url ${md.openGraph?.url} != ${url}`);
  if (md.alternates?.canonical !== url) failures.push(`${c.name}: canonical ${md.alternates?.canonical} != ${url}`);
  if (md.openGraph?.title !== c.event.title) failures.push(`${c.name}: og:title ${md.openGraph?.title}`);
  if (md.openGraph?.description !== c.expectedDescription) failures.push(`${c.name}: og:description differs from description`);
  if (JSON.stringify(md).includes('saoc.co.za')) failures.push(`${c.name}: metadata contains a hard-coded saoc.co.za`);
}

if (failures.length > 0) {
  console.error('FAIL\n' + failures.join('\n'));
  process.exit(1);
}
console.log(`PASS: ${golden.cases.length} event metadata cases`);
