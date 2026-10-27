// F3 society detail metadata, evaluated against fixtures (pure function, no Sanity, no server).
// The dev extracts lib/society-metadata.ts exporting buildSocietyMetadata(society) -> Metadata, and
// app/(marketing)/societies/[slug]/page.tsx calls it from generateMetadata. Expectations:
//   description: kept as written when <=160 chars; otherwise the longest prefix <=160 chars that ends
//     on a word boundary (next char in the source is whitespace), never mid-word, never over-trimmed
//   openGraph.url and alternates.canonical: `${NEXT_PUBLIC_SAOC_SITE_URL}/societies/${slug}`, so no
//     hard-coded saoc.co.za host survives a different configured origin
// Run as: pnpm exec tsx contracts/checks/polish-wave-2026-10-25/f3-society-meta.mts
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

process.env.NEXT_PUBLIC_SAOC_SITE_URL = 'https://polish-check.example';
process.env.NEXT_PUBLIC_NOS_SITE_URL = 'https://nos.polish-check.example';

const root = process.env.POLISH_ROOT ? resolve(process.env.POLISH_ROOT) : resolve(import.meta.dirname, '../../..');
const failures: string[] = [];
const modPath = resolve(root, 'lib/society-metadata.ts');
if (!existsSync(modPath)) {
  console.error('FAIL f3-society-meta:\n - lib/society-metadata.ts does not exist');
  process.exit(1);
}
const mod = (await import(pathToFileURL(modPath).href)) as {
  buildSocietyMetadata?: (s: { name: string; slug: string; description: string | null; region: string | null }) => {
    description?: string;
    alternates?: { canonical?: string };
    openGraph?: { url?: string | URL };
  };
};
if (typeof mod.buildSocietyMetadata !== 'function') {
  console.error('FAIL f3-society-meta:\n - lib/society-metadata.ts does not export buildSocietyMetadata');
  process.exit(1);
}
const build = mod.buildSocietyMetadata;

const LONG = 'The Cape Orchid Society meets monthly at the Kirstenbosch Tea Room and has grown orchids in the Western Cape since 1969. Members share cultivation notes, bring plants for the bench, and run an annual show. '.repeat(4).trim();
const MID = 'A friendly society that meets monthly to share growing tips and show plants on the bench.';

function run(label: string, description: string | null, region: string | null) {
  const meta = build({ name: 'Cape Orchid Society', slug: 'cape-orchid-society', description, region });
  const out = String(meta.description ?? '');
  if (description === null) {
    const want = region
      ? `Cape Orchid Society — affiliated SAOC society in ${region}.`
      : 'Cape Orchid Society — an affiliated SAOC society.';
    if (out !== want) failures.push(`${label}: fallback description is "${out}", want "${want}"`);
  } else if (description.length <= 160) {
    if (out !== description) failures.push(`${label}: a <=160 char description must be kept verbatim`);
  } else {
    if (out.length === 0 || out.length > 160) failures.push(`${label}: length ${out.length}, want 1-160`);
    if (out.length < 100) failures.push(`${label}: over-trimmed to ${out.length} chars`);
    const body = out.replace(/…$/, '');
    if (!description.startsWith(body)) failures.push(`${label}: result is not a prefix of the source`);
    else if (body.length < description.length && !/\s/.test(description[body.length] ?? '')) failures.push(`${label}: cut mid-word`);
    if (/\s$/.test(out)) failures.push(`${label}: trailing whitespace`);
  }
  const expectUrl = 'https://polish-check.example/societies/cape-orchid-society';
  if (meta.alternates?.canonical !== expectUrl) failures.push(`${label}: canonical is ${String(meta.alternates?.canonical)}, want ${expectUrl}`);
  if (String(meta.openGraph?.url) !== expectUrl) failures.push(`${label}: og:url is ${String(meta.openGraph?.url)}, want ${expectUrl}`);
}
if (LONG.length < 400) failures.push('fixture LONG is not long enough (check bug)');
run('long', LONG, 'Western Cape');
run('word-trap', 'abcdefgh '.repeat(40).trim(), 'Western Cape');
run('mid', MID, 'Western Cape');
run('null-region', null, 'Western Cape');
run('null-no-region', null, null);

if (failures.length > 0) {
  console.error('FAIL f3-society-meta:\n - ' + failures.join('\n - '));
  process.exit(1);
}
console.log('PASS f3-society-meta');
