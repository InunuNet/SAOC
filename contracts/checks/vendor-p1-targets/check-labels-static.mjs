// F7 -- the /national-show/vendors label is "Exhibitors and Vendors" everywhere, and nothing else
// in the copy moved. Brad (2026-10-15): "Exhibitors and Vendors as a heading, some might just
// Exhibit some may just be vendors eg Food, some may be both like nurseries".
//
// Static, no build needed. Run as: node contracts/checks/vendor-p1-targets/check-labels-static.mjs

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const BASE = 'd2071be5';
const NEW = 'Exhibitors and Vendors';
const OLD_PATTERN = /Exhibiting Nurseries|Trade Vendors/;
const failures = [];

// [file, substring that must be present]
const REQUIRED = [
  ['app/(marketing)/national-show/vendors/page.tsx', `title: '${NEW} — National Show',`],
  ['app/(marketing)/national-show/vendors/page.tsx', `title="${NEW}"`],
  ['app/(marketing)/national-show/page.tsx', `{ href: '/national-show/vendors', label: '${NEW}' }`],
  ['components/show/ShowSectionNav.tsx', `{ href: '/national-show/vendors', label: '${NEW}', hint: 'The trade floor and how to exhibit' }`],
  ['components/chrome/nav-config.ts', `label: '${NEW}',`],
  // The nav's own comment says its labels match this manifest exactly, and the generator is the
  // manifest's source -- all three must agree.
  ['content/national-show-routes.json', `"label": "${NEW}",`],
  ['scripts/generate-nos-route-manifest.ts', `label: '${NEW}',`],
];
for (const [file, needle] of REQUIRED) {
  if (!readFileSync(file, 'utf8').includes(needle)) failures.push(`${file}: missing \`${needle}\``);
}

// nav-config: the vendors item keeps its descriptor and href (only the label moves).
const nav = readFileSync('components/chrome/nav-config.ts', 'utf8');
if (!/id: 'vendors',\s*label: 'Exhibitors and vendors',\s*href: '\/national-show\/vendors',\s*descriptor: 'Trade vendor showcase, application and gated registration\.',/.test(nav)) {
  failures.push("components/chrome/nav-config.ts: the 'vendors' item is not {label: new, href and descriptor unchanged}");
}

// No old label survives in shipped source.
for (const dir of ['app', 'components', 'lib', 'sanity', 'content', 'scripts', 'types']) {
  let hits = '';
  try {
    hits = execFileSync('grep', ['-rnE', OLD_PATTERN.source, dir], { encoding: 'utf8' });
  } catch (error) {
    if (error.status !== 1) throw error; // 1 = no match, which is what we want
  }
  for (const line of hits.split('\n').filter(Boolean)) failures.push(`old label survives: ${line}`);
}

// Lowercase prose form of the old label must not survive either.
for (const dir of ['app', 'components', 'lib', 'content', 'scripts']) {
  let hits = '';
  try {
    hits = execFileSync('grep', ['-rn', 'exhibiting nurseries', dir], { encoding: 'utf8' });
  } catch (error) {
    if (error.status !== 1) throw error; // 1 = no match, which is what we want
  }
  for (const line of hits.split('\n').filter(Boolean)) failures.push(`old lowercase label survives: ${line}`);
}

// Only the label changed: every removed line in the diff against base is an old-label line, and
// its added counterpart is the same line with the label swapped -- no other copy touched.
const LABEL_FILES = [
  'app/(marketing)/national-show/vendors/page.tsx',
  'app/(marketing)/national-show/page.tsx',
  'components/show/ShowSectionNav.tsx',
  'components/chrome/nav-config.ts',
  'content/national-show-routes.json',
  'scripts/generate-nos-route-manifest.ts',
];
for (const file of LABEL_FILES) {
  const diff = execFileSync('git', ['diff', '-U0', BASE, '--', file], { encoding: 'utf8' });
  const removed = diff.split('\n').filter((l) => l.startsWith('-') && !l.startsWith('---')).map((l) => l.slice(1));
  const added = diff.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1));
  if (removed.length !== added.length || removed.length === 0) {
    failures.push(`${file}: diff vs ${BASE} has ${removed.length} removed / ${added.length} added lines (expected equal, non-zero)`);
    continue;
  }
  removed.forEach((line, i) => {
    if (!OLD_PATTERN.test(line)) failures.push(`${file}: a removed line is not an old-label line: ${line.trim()}`);
    const swapped = line.replace(/Exhibiting Nurseries|Trade Vendors/g, NEW);
    if (swapped !== added[i]) failures.push(`${file}: line changed beyond the label swap: "${line.trim()}" -> "${added[i].trim()}"`);
  });
}

if (failures.length > 0) {
  for (const f of failures) console.error(`FAIL: ${f}`);
  process.exit(1);
}
console.log('OK');
