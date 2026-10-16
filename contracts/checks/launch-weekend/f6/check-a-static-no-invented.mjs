#!/usr/bin/env node
// A1 - static: no invented venue, visitor, trophy or "Since 1974" literal remains in shipped source; the static
// seed file is gone and nothing imports it; the archive pages no longer use stock photos.
import { readFileSync, existsSync } from 'node:fs';
import { FORBIDDEN, walk, report } from './_lib.mjs';

const problems = [];
const files = ['app', 'lib', 'components', 'sanity', 'types'].flatMap((d) => walk(d, ['.ts', '.tsx']));
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const lit of FORBIDDEN) if (src.includes(lit)) problems.push(`${f} contains forbidden literal "${lit}"`);
  if (/from ['"]@\/lib\/data\/shows['"]|from ['"]\.\/shows['"]|from ['"]\.\.\/shows['"]/.test(src)) problems.push(`${f} imports lib/data/shows`);
  if (/staticShows/.test(src)) problems.push(`${f} still references staticShows`);
}
if (existsSync('lib/data/shows.ts')) problems.push('lib/data/shows.ts still exists');
for (const f of ['app/(marketing)/national-show/archive/page.tsx', 'app/(marketing)/national-show/archive/[year]/page.tsx']) {
  const src = readFileSync(f, 'utf8');
  if (/NOS_HERO_IMAGES|archivePhotoFor|next\/image/.test(src)) problems.push(`${f} still uses a stock photo path`);
}
// Nav copy must not promise champions or galleries the archive does not have (descriptions are trimmed to "Previous editions", no new copy).
for (const f of ['components/chrome/nav-config.ts', 'components/show/ShowSectionNav.tsx', 'app/(marketing)/national-show/page.tsx']) {
  const lines = readFileSync(f, 'utf8').split('\n');
  lines.forEach((l, i) => {
    const near = lines.slice(Math.max(0, i - 4), i + 5).join('\n');
    if (/champion|galler/i.test(l) && /national-show\/archive/.test(near)) problems.push(`${f}:${i + 1} nav copy still promises champions or galleries`);
  });
}
const idx = readFileSync('app/(marketing)/national-show/archive/page.tsx', 'utf8');
if (!idx.includes('Show history awaiting committee records')) problems.push('archive index lacks the "Show history awaiting committee records" state');
if (!/ConfirmationBadge/.test(idx)) problems.push('archive index does not use ConfirmationBadge');
if (/Since 1974|every three years/.test(idx)) problems.push('archive lede still carries the unsourced 1974 / rotation claim');
const nsp = readFileSync('app/(marketing)/national-show/page.tsx', 'utf8');
if (/Past editions|PastEditionCard|pastEditionImage/.test(nsp)) problems.push('/national-show still renders the past editions section');
const merge = readFileSync('lib/data/mergeShows.ts', 'utf8');
if (/staticShows|lib\/data\/shows/.test(merge)) problems.push('mergeShows still merges a static record');
report(problems, `${files.length} source files free of invented archive literals; static seed removed`);
