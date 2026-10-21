// nos-critique-r9 f4 static (interim QA P3s 2 and 3): one label filter for the emergency contacts, and the exhibitor-kind short tag pinned as intended.
//   S1  plan-your-visit/page.tsx no longer filters the emergency contacts by label; it hands the CMS list to VisitEmergency, which owns the filter
//   S2  VisitEmergency still drops contacts without a label (and returns nothing when none are left)
//   S3  exhibitor-kind short tag is the ruled behaviour (r8 F1 ruling item 4, Codi FINAL): ShowStatusLine passes shortOnNarrow to its marker; ExhibitorStatusBadge (the SAOC callers) does not
//   S4  docs/nos-critique-r9.md exists
import { DOC, finish, readRepoFile, stripComments } from './_lib.mjs';

const failures = [];
const fail = (m) => failures.push(m);
const page = readRepoFile('app/(marketing)/national-show/plan-your-visit/page.tsx');
const visit = readRepoFile('components/show/VisitDisclosure.tsx');
const line = readRepoFile('components/show/ShowStatusLine.tsx');
const badge = readRepoFile('components/show/ExhibitorStatusBadge.tsx');
if ([page, visit, line, badge].includes(null)) fail('a source file is missing');
else {
  const p = stripComments(page).replace(/\s+/g, ' ');
  if (/emergencyContacts[^;]*\.filter\(/.test(p) || /\(info\?\.emergencyContacts[^;]*\.filter\(/.test(p)) fail('plan-your-visit/page.tsx still filters the emergency contacts; VisitEmergency owns the label filter (S1)');
  if (!/<VisitEmergency\b[^>]*contacts=\{[^}]*emergencyContacts/.test(p)) fail('page.tsx must still hand the contacts to VisitEmergency (S1)');
  const v = stripComments(visit).replace(/\s+/g, ' ');
  const em = v.slice(v.indexOf('export function VisitEmergency'));
  if (!/contacts\.filter\(\(?contact\)? => contact\?\.label\)/.test(em) || !/shown\.length === 0\) return null/.test(em)) fail('VisitEmergency must keep dropping unlabelled AND null contacts (null-safe contact?.label) and return null when none remain (S2)');
  if (!/shortOnNarrow/.test(stripComments(line))) fail('ShowStatusLine must keep passing shortOnNarrow (S3)');
  if (/shortOnNarrow/.test(stripComments(badge))) fail('ExhibitorStatusBadge must not opt in to shortOnNarrow; the SAOC callers are unchanged (S3)');
}
if (readRepoFile(DOC) === null) fail(`${DOC} is missing (S4)`);

finish('f4-static.mjs', failures, 'the emergency contacts are label-filtered once, in VisitEmergency; ShowStatusLine opts in to the short tag and ExhibitorStatusBadge does not.');
