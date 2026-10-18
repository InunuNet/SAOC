// F7 -- the /national-show/vendors label is "Exhibitors and Vendors" everywhere.
// REBASED by launch-weekend F18 (goldens/f18/supersession.json): this file used to diff six files against the ancient base d2071be5 ("nothing else moved"),
// which can never pass on a tree that has had F8-F17. It is now purely structural: the label pins, the nav item, and the absence of the old labels.
// The hub's literal label list was replaced by the R69 index (NosShowIndex reads nav-config), so that pin is gone. Brad (2026-10-15): "Exhibitors and Vendors as a heading, some might just
// Exhibit some may just be vendors eg Food, some may be both like nurseries".
//
// Static, no build needed. Run as: node contracts/checks/vendor-p1-targets/check-labels-static.mjs

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const NEW = 'Exhibitors and Vendors';
const OLD_PATTERN = /Exhibiting Nurseries|Trade Vendors/;
const failures = [];

// [file, substring that must be present]
const REQUIRED = [
  ['app/(marketing)/national-show/vendors/page.tsx', `title: '${NEW}',`], // F24 911fd349: the NOS layout template adds the suffix (nos-critique-r12 supersession)
  ['app/(marketing)/national-show/vendors/page.tsx', `title="${NEW}"`],
  ['components/show/ShowSectionNav.tsx', `{ href: '/national-show/vendors', label: '${NEW}', hint: 'The trade floor and how to exhibit' }`],
  ['components/chrome/nav-config.ts', `label: '${NEW}',`],
  // The nav's own comment says its labels match this manifest exactly, and the generator is the
  // manifest's source -- all three must agree.
  ['content/national-show-routes.json', `"label": "${NEW}",`],
  ['scripts/generate-nos-route-manifest.ts', `label: '${NEW}',`],
];
for (const [file, needle] of REQUIRED) {
  // Whitespace and trailing commas are formatting, not content: batch 2 (f10) let the formatter break the ShowSectionNav object over several lines.
  const squash = (text) => text.replace(/\s+/g, '').replace(/,\}/g, '}');
  if (!squash(readFileSync(file, 'utf8')).includes(squash(needle))) failures.push(`${file}: missing \`${needle}\``);
}

// nav-config: the vendors item keeps its descriptor and href (only the label moves).
const nav = readFileSync('components/chrome/nav-config.ts', 'utf8');
if (!/id: 'vendors',\s*label: 'Exhibitors and Vendors',\s*href: '\/national-show\/vendors',\s*descriptor: 'Trade vendor showcase, application and registration\.',/.test(nav)) {
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

if (failures.length > 0) {
  for (const f of failures) console.error(`FAIL: ${f}`);
  process.exit(1);
}
console.log('OK');
