// Finding (b): /members, /constitution, /privacy, /terms, /refunds and /events/submit take their
// metadata from buildPageMetadata (lib/seo.ts), so og:title, canonical, og:url and twitter carry the
// page title. A page that still exports a hand-written `metadata = { ... }` literal fails.
// Source-level check; the deployed og:title is proven by the browser_deployed_check assertion.
// Run as: node contracts/checks/saoc-seo-polish/check-page-metadata.mjs
import { readFileSync } from 'node:fs';

const pages = [
  { file: 'app/(marketing)/members/page.tsx', path: '/members', title: 'Members Portal', noIndex: false },
  { file: 'app/(marketing)/constitution/page.tsx', path: '/constitution', title: 'Constitution', noIndex: false },
  { file: 'app/(shared)/privacy/page.tsx', path: '/privacy', title: 'Privacy Policy', noIndex: false },
  { file: 'app/(shared)/terms/page.tsx', path: '/terms', title: 'Terms of Use', noIndex: false },
  { file: 'app/(shared)/refunds/page.tsx', path: '/refunds', title: 'Refund & Cancellation Policy', noIndex: false },
  { file: 'app/(marketing)/events/submit/page.tsx', path: '/events/submit', title: 'Submit an Event', noIndex: true, description: 'Your submission will be reviewed by the council before it appears on the site.' },
];

const failures = [];
for (const p of pages) {
  const src = readFileSync(p.file, 'utf8');
  const call = src.match(/buildPageMetadata\(\{[\s\S]*?\n\}\)/);
  if (!/import \{[^}]*\bbuildPageMetadata\b[^}]*\} from '@\/lib\/seo'/.test(src)) failures.push(`${p.file}: does not import buildPageMetadata from '@/lib/seo'`);
  if (!call) { failures.push(`${p.file}: no buildPageMetadata({...}) call`); continue; }
  if (!/export const metadata: Metadata = buildPageMetadata\(/.test(src)) failures.push(`${p.file}: metadata export is not assigned from buildPageMetadata`);
  if (/export const metadata: Metadata = \{/.test(src)) failures.push(`${p.file}: still exports a hand-written metadata literal`);
  if (!call[0].includes(`path: '${p.path}'`)) failures.push(`${p.file}: call does not pass path: '${p.path}'`);
  if (!call[0].includes(`title: '${p.title}'`)) failures.push(`${p.file}: call does not pass title: '${p.title}' (the page title, without the site name)`);
  if (/title:\s*'[^']*\|[^']*'/.test(call[0]) || /South African Orchid Council'/.test(call[0].match(/title:[^\n]*/)?.[0] ?? '')) failures.push(`${p.file}: title repeats the site name; the layout template adds it`);
  if (p.description && !call[0].includes(p.description)) failures.push(`${p.file}: description must be the page's own sentence: ${p.description}`);
  const hasNoIndex = /noIndex:\s*true/.test(call[0]);
  if (p.noIndex && !hasNoIndex) failures.push(`${p.file}: members-only page must pass noIndex: true`);
  if (!p.noIndex && hasNoIndex) failures.push(`${p.file}: public page must not be noIndex`);
}

if (failures.length > 0) {
  console.error('FAIL\n' + failures.join('\n'));
  process.exit(1);
}
console.log(`PASS: ${pages.length} pages use buildPageMetadata`);
