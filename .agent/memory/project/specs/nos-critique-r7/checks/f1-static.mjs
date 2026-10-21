// nos-critique-r7 f1 static (plan-your-visit disclosure grouping, Codi P3 H8; golden nos-v4/plan-your-visit.html l.575-616).
//   S1  the page does not read the environment (the grouping is structural, not a mode rule)
//   S2  page.tsx cites the golden in a comment
//   S3  NO INVENTION: the only copy strings added vs BASE are the two golden aria-labels; none lost; the CMS-owned sentences are never typed
//   S4  both golden aria-labels and role="group" are present; the old 26px contact value is gone; tel: links are kept
//   S5  VisitorInfoBlock.tsx: copy unchanged, still exported, no env reading
//   S6  docs/nos-critique-r7.md cites H8
//   S7  VisitDisclosure.tsx exports VisitGettingThere (items, pendingLabel, researchLabel); page.tsx renders it and passes statuses through props, with no status switch in code
import { DOC, NS, copyStrings, finish, readBaseFile, readRepoFile, stripComments } from './_lib.mjs';

const failures = [];
const fail = (m) => failures.push(m);
const pageRel = `${NS}/plan-your-visit/page.tsx`;
const discRel = 'components/show/VisitDisclosure.tsx';
const GOLDEN_LABELS = ['Details to be confirmed by the show committee', 'Emergency contacts, to be confirmed by the show committee'];
const CMS_ONLY = ['To be confirmed', 'It will be published here once it is ready', 'The committee will supply the on-site contact'];

const raw = readRepoFile(pageRel);
const disc = readRepoFile(discRel);
if (raw === null) fail(`${pageRel} is missing`);
else {
  const sources = [raw, ...(disc === null ? [] : [disc])];
  const code = sources.map(stripComments).join('\n');
  if (/process\.env|SHOW_PLACEHOLDER_PREVIEW/.test(code)) fail('plan-your-visit must not read the environment (S1)');
  if (!/(\/\/|\/\*)[^\n]*nos-v4\/plan-your-visit\.html/.test(raw)) fail('page.tsx needs a comment citing nos-v4/plan-your-visit.html (S2)');
  const base = readBaseFile(pageRel);
  if (base !== null) {
    const was = new Set(copyStrings(base));
    const now = new Set(sources.flatMap((s) => copyStrings(s)));
    for (const s of now) if (!was.has(s) && !GOLDEN_LABELS.includes(s)) fail(`adds a copy string that is not in BASE and not a golden aria-label: "${s.slice(0, 70)}" (NO INVENTION, S3)`);
    for (const s of was) if (!now.has(s)) fail(`lost a BASE copy string: "${s.slice(0, 70)}" (S3)`);
  }
  for (const s of CMS_ONLY) if (code.includes(s)) fail(`"${s}" is a CMS value and must not be typed into code (S3)`);
  for (const l of GOLDEN_LABELS) if (!code.includes(l)) fail(`missing the golden aria-label "${l}" (S4)`);
  if (!/role=["']group["']/.test(code)) fail('the disclosure surfaces need role="group" (S4)');
  if (/text-\[26px\]/.test(code)) fail('the 26px pending contact value is still present (S4)');
  if (!/tel:/.test(code)) fail('tel: links were dropped (S4)');
}
const vibRel = 'components/show/VisitorInfoBlock.tsx';
const vib = readRepoFile(vibRel);
const vibBase = readBaseFile(vibRel);
if (vib === null) fail(`${vibRel} is missing`);
else {
  if (!/export function VisitorInfoBlock/.test(vib)) fail('VisitorInfoBlock must stay exported (S5)');
  if (/process\.env|SHOW_PLACEHOLDER_PREVIEW|withholdPlaceholderProse/.test(stripComments(vib))) fail('VisitorInfoBlock must not read the mode (S5)');
  if (vibBase !== null && copyStrings(vib).sort().join('\n') !== copyStrings(vibBase).sort().join('\n')) fail('VisitorInfoBlock.tsx copy differs from BASE (S5)');
}
const doc = readRepoFile(DOC);
if (doc === null) fail(`${DOC} is missing`);
else if (!/H8/.test(doc)) fail(`${DOC} must cite H8 (S6)`);

const vd = readRepoFile(discRel);
if (vd === null) fail(`${discRel} is missing (S7)`);
else {
  if (!/export function VisitGettingThere/.test(vd)) fail('VisitDisclosure.tsx must export VisitGettingThere (S7)');
  if (!/export function VisitAttractions/.test(vd)) fail('VisitDisclosure.tsx must export VisitAttractions({ title, attractions, status, pendingLabel, researchLabel }) (S7)');
  if (!/\bitems\b/.test(vd) || !/pendingLabel/.test(vd) || !/researchLabel/.test(vd)) fail('VisitGettingThere takes items, pendingLabel and researchLabel props (S7)');
}
const pg = readRepoFile(pageRel);
if (pg !== null && !/<VisitGettingThere\b/.test(pg)) fail('page.tsx must render <VisitGettingThere> (S7)');
if (pg !== null) {
  const code = stripComments(pg);
  if (!/<VisitAttractions\b[^>]*status=\{status\.attractions\}/.test(code.replace(/\s+/g, ' '))) fail('page.tsx must render <VisitAttractions ... status={status.attractions}> (S7)');
  if (/<ConfirmationBadge[^>]*status=\{status\.attractions\}/.test(code.replace(/\s+/g, ' '))) fail('the attractions section must not draw its own ConfirmationBadge (S7)');
}

finish('f1-static.mjs', failures, 'plan-your-visit disclosure grouping: golden cited, only the two golden aria-labels added, CMS sentences not typed, role=group present, tel links kept, VisitorInfoBlock copy intact, docs cite H8.');
