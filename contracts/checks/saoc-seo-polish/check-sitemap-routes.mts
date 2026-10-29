// Finding (a): the SAOC sitemap's static routes come from lib/saoc-sitemap-routes.ts (SAOC_STATIC_ROUTES)
// and cover every public static page in app/(marketing) and app/(shared). The drift guard walks the real
// route tree, so a page added later and left out of the sitemap fails here.
// Run as: pnpm exec tsx contracts/checks/saoc-seo-polish/check-sitemap-routes.mts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { SAOC_STATIC_ROUTES } from '../../../lib/saoc-sitemap-routes.ts';

const golden = JSON.parse(readFileSync('contracts/golden/saoc-seo-polish/sitemap-expected.json', 'utf8'));
const failures: string[] = [];

const listed = SAOC_STATIC_ROUTES.map((r) => r.path);
const sameSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');
if (!sameSet(listed, golden.include)) {
  failures.push(`SAOC_STATIC_ROUTES paths ${JSON.stringify(listed)} != golden ${JSON.stringify(golden.include)}`);
}
if (new Set(listed).size !== listed.length) failures.push('duplicate paths in SAOC_STATIC_ROUTES');
for (const r of SAOC_STATIC_ROUTES) {
  if (!(r.priority >= 0 && r.priority <= 1)) failures.push(`${r.path}: priority out of 0..1`);
  if (!r.changeFrequency) failures.push(`${r.path}: missing changeFrequency`);
}
for (const bad of Object.keys(golden.exclude)) {
  if (listed.includes(bad)) failures.push(`${bad} must NOT be in the sitemap`);
}

// Drift guard: every static page.tsx in the two SAOC route groups is listed or deliberately excluded.
function walk(dir: string, urlPath: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (!statSync(full).isDirectory()) {
      if (name === 'page.tsx') out.push(urlPath);
      continue;
    }
    if (name.startsWith('[')) continue; // dynamic segment: enumerated from Sanity in app/sitemap.ts
    const isGroup = name.startsWith('(') && name.endsWith(')');
    walk(full, isGroup ? urlPath : `${urlPath}/${name}`, out);
  }
}
const found: string[] = [];
walk('app/(marketing)', '', found);
walk('app/(shared)', '', found);
const expected = found.filter((p) => !(p in golden.exclude));
if (!sameSet(listed, expected)) {
  failures.push(`route tree drift: tree minus exclusions = ${JSON.stringify(expected.sort())}, sitemap = ${JSON.stringify([...listed].sort())}`);
}

if (failures.length > 0) {
  console.error('FAIL\n' + failures.join('\n'));
  process.exit(1);
}
console.log(`PASS: ${listed.length} static SAOC routes, route tree and sitemap agree`);
