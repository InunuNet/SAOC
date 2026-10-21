// nos-critique-r8 f2 static: the Getting-there lede is gated by gettingThereLede (props-testable), not passed straight through.
//   S1  VisitDisclosure.tsx exports gettingThereLede
//   S2  plan-your-visit page.tsx feeds SectionHeading's lede from gettingThereLede(info?.gettingThereIntro, <the items passed to VisitGettingThere>)
//   S3  page.tsx no longer passes info?.gettingThereIntro straight to a lede
//   S4  no new copy: page.tsx and VisitDisclosure.tsx strings equal BASE
import { NS, copyStrings, finish, readBaseFile, readRepoFile, stripComments } from './_lib.mjs';

const failures = [];
const fail = (m) => failures.push(m);
const vdRel = 'components/show/VisitDisclosure.tsx';
const pageRel = `${NS}/plan-your-visit/page.tsx`;
const vd = readRepoFile(vdRel);
const pg = readRepoFile(pageRel);
if (vd === null || pg === null) fail('VisitDisclosure.tsx or the plan-your-visit page is missing');
else {
  if (!/export function gettingThereLede\b/.test(vd)) fail('VisitDisclosure.tsx must export gettingThereLede(intro, items) (S1)');
  const flat = stripComments(pg).replace(/\s+/g, ' ');
  if (!/lede=\{gettingThereLede\(\s*info\?\.gettingThereIntro\s*,\s*gettingThereItems\s*\)\}/.test(flat)) fail('page.tsx must pass lede={gettingThereLede(info?.gettingThereIntro, gettingThereItems)} (S2)');
  if (/lede=\{info\?\.gettingThereIntro/.test(flat)) fail('page.tsx still passes info?.gettingThereIntro straight to a lede (S3)');
  for (const [rel, src] of [[vdRel, vd], [pageRel, pg]]) {
    const base = readBaseFile(rel);
    if (base === null) continue;
    const was = new Set(copyStrings(base));
    for (const s of copyStrings(src)) if (!was.has(s)) fail(`${rel.split('/').pop()}: adds a copy string not in BASE: "${s.slice(0, 70)}" (S4)`);
  }
}
finish('f2-static.mjs', failures, 'the Getting-there lede goes through gettingThereLede(info?.gettingThereIntro, gettingThereItems); no new copy.');
