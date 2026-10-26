// Offline checks for sitemap-lastmodified. Usage: tsx check.mjs <case>. SAOC_ROOT overrides the repo root.
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.env.SAOC_ROOT ?? process.cwd();
const fail = (msg) => { console.error(`FAIL ${msg}`); process.exit(1); };
let mod;
try {
  mod = await import(pathToFileURL(join(root, 'lib/sitemap-entry.ts')).href);
} catch (e) {
  fail(`lib/sitemap-entry.ts must exist and export sitemapEntry (${e.code ?? e.message})`);
}
if (typeof mod.sitemapEntry !== 'function') fail('lib/sitemap-entry.ts must export sitemapEntry');
const entry = (updatedAt) => mod.sitemapEntry('https://saoc.co.za/societies/x', { changeFrequency: 'monthly', priority: 0.6 }, updatedAt);

const cases = {
  'real-date-used'() {
    const e = entry('2026-09-14T10:20:30Z');
    if (!(e.lastModified instanceof Date) || e.lastModified.toISOString() !== '2026-09-14T10:20:30.000Z') {
      fail(`lastModified must be the source date, got ${JSON.stringify(e.lastModified)}`);
    }
    if (e.url !== 'https://saoc.co.za/societies/x' || e.changeFrequency !== 'monthly' || e.priority !== 0.6) fail('url/changeFrequency/priority must pass through');
  },
  'no-date-omitted'() {
    for (const v of [undefined, null, '', 'not a date', '2026-13-45', 42, {}]) {
      const e = entry(v);
      if ('lastModified' in e) fail(`no usable source date (${JSON.stringify(v)}) must omit lastModified, got ${JSON.stringify(e.lastModified)}`);
      if (Object.values(e).some((x) => x === undefined)) fail('entry has an undefined own property');
    }
    const bare = mod.sitemapEntry('https://saoc.co.za/about', { changeFrequency: 'monthly', priority: 0.8 });
    if ('lastModified' in bare) fail('a static route (no date argument) must have no lastModified');
  },
};

const name = process.argv[2];
if (!cases[name]) fail(`unknown case ${name}`);
await cases[name]();
console.log(`ok ${name}`);
