// gate-hygiene item 1 (round 2): assert on the BUILT sitemap, by calling the real default export of app/sitemap.ts for each host,
// so a wiring change (a dropped spread, a removed list) is caught, not only a change to the route helper modules.
// Mocked at the module boundary (CJS require hook): next/headers (host switch), next-sanity createClient (every query empty),
// firebase-admin/app and firebase-admin/firestore (stock read returns nothing). No real Sanity or Firestore.
// Run as: pnpm exec tsx <this file> (from the checkout under test)
import Module from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SAOC_ORIGIN = 'https://saoc.test';
const NOS_ORIGIN = 'https://nos.test';
process.env.NEXT_PUBLIC_SAOC_SITE_URL = SAOC_ORIGIN;
process.env.NEXT_PUBLIC_NOS_SITE_URL = NOS_ORIGIN;
process.env.NEXT_PUBLIC_SANITY_PROJECT_ID = 'mockproj';
process.env.SANITY_FIXTURE_MODE = 'off';

let host = 'saoc.test';
const emptyDoc = { get: async () => ({ exists: false, data: () => undefined }) };
const emptyCollection = { doc: () => emptyDoc, where: () => emptyCollection, get: async () => ({ docs: [], empty: true }) };
const load = (Module as unknown as { _load: (req: string, parent: unknown, isMain: boolean) => unknown })._load;
(Module as unknown as { _load: unknown })._load = function (req: string, parent: unknown, isMain: boolean) {
  const real = () => load(req, parent, isMain) as object;
  if (req === 'next/headers') return { ...real(), headers: async () => new Headers({ host }), draftMode: async () => ({ isEnabled: false }) };
  if (req === 'next-sanity') return { ...real(), createClient: () => ({ config: () => ({ useCdn: true }), fetch: async () => [] }) };
  if (req === 'firebase-admin/app') return { ...real(), getApps: () => [{}] };
  if (req === 'firebase-admin/firestore') return { ...real(), getFirestore: () => ({ collection: () => emptyCollection }) };
  return load(req, parent, isMain);
};

const here = (rel: string) => pathToFileURL(path.resolve(rel)).href;
const sitemap = ((await import(here('app/sitemap.ts'))) as { default: () => Promise<{ url: string }[]> }).default;
const { nosPath } = (await import(here('lib/nos-paths.ts'))) as { nosPath: (p: string) => string };
const { PAST_SHOWS_HREF } = (await import(here('lib/data/past-shows.ts'))) as { PAST_SHOWS_HREF: string };
const golden = JSON.parse(readFileSync('contracts/golden/saoc-seo-polish/sitemap-expected.json', 'utf8')) as { include: string[]; exclude: Record<string, string> };
const manifest = JSON.parse(readFileSync('content/national-show-routes.json', 'utf8')) as { routes: { slug: string; indexable: boolean; dynamic: boolean }[] };

const failures: string[] = [];
const pathsOf = (entries: { url: string }[], origin: string) => {
  const bad = entries.filter((e) => !e.url.startsWith(origin)).map((e) => e.url);
  if (bad.length) failures.push(`entries outside ${origin}: ${bad.join(',')}`);
  return entries.map((e) => e.url.slice(origin.length));
};

// SAOC host: the static paths are exactly the golden; dynamic /societies/<slug> and /events/<slug> come from Sanity (empty here).
host = 'saoc.test';
const saoc = pathsOf(await sitemap(), SAOC_ORIGIN);
const saocStatic = saoc.filter((p) => !p.startsWith('/societies/') && !p.startsWith('/events/'));
if (JSON.stringify([...saocStatic].sort()) !== JSON.stringify([...golden.include].sort())) failures.push(`SAOC built sitemap statics ${JSON.stringify(saocStatic.sort())} != golden ${JSON.stringify(golden.include)}`);
for (const bad of Object.keys(golden.exclude)) if (saoc.includes(bad)) failures.push(`SAOC built sitemap lists excluded ${bad}`);
if (saoc.some((p) => p.startsWith('/national-show'))) failures.push('SAOC built sitemap lists show entries');

// NOS host: every indexable non-dynamic manifest route (the Past shows page may be withheld) plus /contact; never the shared pages.
host = 'nos.test';
const nos = pathsOf(await sitemap(), NOS_ORIGIN);
const wanted = manifest.routes.filter((r) => r.indexable && !r.dynamic && r.slug !== PAST_SHOWS_HREF).map((r) => nosPath(r.slug));
const missing = wanted.filter((p) => !nos.includes(p));
if (missing.length) failures.push(`NOS built sitemap is missing manifest routes: ${missing.join(',')}`);
if (!nos.includes('/contact')) failures.push('NOS built sitemap is missing /contact');
for (const shared of ['/privacy', '/terms', '/refunds']) if (nos.includes(shared)) failures.push(`NOS built sitemap lists ${shared}`);
if (new Set(nos).size !== nos.length) failures.push('NOS built sitemap has duplicate paths');
const unexpected = nos.filter((p) => !wanted.includes(p) && p !== '/contact' && !p.startsWith('/tickets/') && !p.startsWith(nosPath('/national-show/archive/')) && p !== nosPath(PAST_SHOWS_HREF));
if (unexpected.length) failures.push(`NOS built sitemap has unexpected paths: ${unexpected.join(',')}`);

if (failures.length) { console.error('FAIL\n' + failures.join('\n')); process.exit(1); }
console.log(`PASS: built sitemap, SAOC ${saoc.length} entries, NOS ${nos.length} entries`);
