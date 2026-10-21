// nos-critique-r8 f4 static (Codex interim QA P3s).
//   S1  VisitDisclosure.tsx no longer builds an id from the bare CMS key: no `_key ?? index` inside the id builder
//   S2  TravelRoutes.tsx draws route headings as h3 (no h4)
//   S3  plan-your-visit page.tsx comment is current: it still cites nos-v4/plan-your-visit.html and no longer says "two aria-labels"
//   S4  no new copy in the three files
import { NS, copyStrings, finish, readBaseFile, readRepoFile, stripComments } from './_lib.mjs';

const failures = [];
const fail = (m) => failures.push(m);
const vdRel = 'components/show/VisitDisclosure.tsx';
const trRel = 'components/show/TravelRoutes.tsx';
const pageRel = `${NS}/plan-your-visit/page.tsx`;
const vd = readRepoFile(vdRel);
const tr = readRepoFile(trRel);
const pg = readRepoFile(pageRel);
if (vd === null || tr === null || pg === null) fail('VisitDisclosure.tsx, TravelRoutes.tsx or the plan-your-visit page is missing');
else {
  const vdCode = stripComments(vd).replace(/\s+/g, ' ');
  if (/visit-attraction-\$\{[^}]*_key\s*\?\?\s*index[^}]*\}/.test(vdCode)) fail('the attraction id still uses the bare `_key ?? index` (S1)');
  if (!/<h3\b/.test(stripComments(tr)) || /<h4\b/.test(stripComments(tr))) fail('TravelRoutes.tsx route headings must be h3, not h4 (S2)');
  if (/two aria-labels/i.test(pg)) fail('page.tsx still carries the stale "two aria-labels" comment (S3)');
  if (!/(\/\/|\/\*)[^\n]*nos-v4\/plan-your-visit\.html/.test(pg)) fail('page.tsx must keep a comment citing nos-v4/plan-your-visit.html (S3)');
  for (const [rel, src] of [[vdRel, vd], [trRel, tr], [pageRel, pg]]) {
    const base = readBaseFile(rel);
    if (base === null) continue;
    const was = new Set(copyStrings(base));
    for (const s of copyStrings(src)) if (!was.has(s)) fail(`${rel.split('/').pop()}: adds a copy string not in BASE: "${s.slice(0, 70)}" (S4)`);
  }
}
finish('f4-static.mjs', failures, 'attraction ids no longer use the bare CMS key, TravelRoutes draws h3, the plan page comment is current, no new copy.');
