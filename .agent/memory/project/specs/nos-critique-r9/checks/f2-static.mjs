// nos-critique-r9 f2 static (Codi FINAL research chip ruling): NO INVENTION and wiring.
//   S1  StatusMarker has the opt-in prop shortResearch and uses its own FALLBACK_RESEARCH_LABEL for it; ConfirmationBadge forwards it
//   S2  the visible short string "Not yet confirmed" is typed in exactly one place under components/show (the StatusMarker constant), none of the callers retype it
//   S3  ShowStatusLine (when it draws its disclosure), VisitDisclosure (Getting there, attractions, emergency) pass shortResearch and use ShowStatusFoot for the full research wording
//   S4  docs/nos-critique-r9.md exists
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { DOC, finish, readRepoFile, repoRoot, stripComments } from './_lib.mjs';

const failures = [];
const fail = (m) => failures.push(m);
const src = (rel) => readRepoFile(rel);
const marker = src('components/show/_shared/StatusMarker.tsx');
const badge = src('components/show/ConfirmationBadge.tsx');
const line = src('components/show/ShowStatusLine.tsx');
const visit = src('components/show/VisitDisclosure.tsx');
if ([marker, badge, line, visit].includes(null)) fail('a component file is missing');
else {
  const m = stripComments(marker);
  if (!/shortResearch\??:\s*boolean/.test(m)) fail('StatusMarker needs the opt-in prop shortResearch?: boolean (S1)');
  if ((m.match(/FALLBACK_RESEARCH_LABEL/g) ?? []).length < 3) fail('StatusMarker must use FALLBACK_RESEARCH_LABEL (declaration, the existing fallback and the new shortResearch text) (S1)');
  if (!/shortResearch/.test(stripComments(badge))) fail('ConfirmationBadge must forward shortResearch (S1)');
  const l = stripComments(line);
  if (!/shortResearch/.test(l)) fail('ShowStatusLine must pass shortResearch for its disclosure (S3)');
  if (!/ShowStatusFoot/.test(l) || !/researchLabel/.test(l)) fail('ShowStatusLine must draw the full research wording in a ShowStatusFoot (S3)');
  const v = stripComments(visit);
  if ((v.match(/shortResearch/g) ?? []).length < 3) fail('VisitDisclosure must pass shortResearch on all three disclosures (Getting there, attractions, emergency) (S3)');
  if (!/ShowStatusFoot/.test(v)) fail('VisitDisclosure must draw the full research wording in a ShowStatusFoot (S3)');
}
const walk = (dir) => readdirSync(path.join(repoRoot, dir)).flatMap((n) => {
  const rel = `${dir}/${n}`;
  return statSync(path.join(repoRoot, rel)).isDirectory() ? walk(rel) : /\.tsx?$/.test(n) ? [rel] : [];
});
for (const rel of walk('components/show')) {
  const t = stripComments(src(rel) ?? '');
  const hits = (t.match(/Not yet confirmed/g) ?? []).length;
  if (rel.endsWith('_shared/StatusMarker.tsx') ? hits !== 1 : hits > 0) fail(`${rel}: "Not yet confirmed" typed ${hits} time(s); it lives once, in StatusMarker's FALLBACK_RESEARCH_LABEL (S2)`);
}
if (readRepoFile(DOC) === null) fail(`${DOC} is missing (S4)`);

finish('f2-static.mjs', failures, 'shortResearch is opt-in on StatusMarker (via FALLBACK_RESEARCH_LABEL), forwarded by ConfirmationBadge, passed by every disclosure, the full wording is drawn in a ShowStatusFoot, and the short string is typed once.');
