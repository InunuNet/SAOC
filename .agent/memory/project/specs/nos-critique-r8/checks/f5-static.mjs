// nos-critique-r8 f5 static (emergency section, Codi FINAL; supersedes golden l.605-616).
//   S1  VisitDisclosure.tsx exports VisitEmergency and owns the dial/on-site split (PHONE_SHAPED and the tel: link move there)
//   S2  page.tsx renders <VisitEmergency ... status={status.emergencyContacts}>, keeps the existing aria-label constant, and no longer draws an emergency ConfirmationBadge, PHONE_SHAPED or tel: itself
//   S3  page.tsx still cites nos-v4/plan-your-visit.html and says the emergency section deviates from it (Codi logged the deviation)
//   S3b the gold band: VisitEmergency renders a NosSection with bg-[var(--gold)] and an mb-8 heading, and the page places it AFTER the main NosSection and before the CtaBand
//   S4  no new copy in page.tsx or VisitDisclosure.tsx vs BASE
import { NS, copyStrings, finish, readBaseFile, readRepoFile, stripComments } from './_lib.mjs';

const failures = [];
const fail = (m) => failures.push(m);
const vdRel = 'components/show/VisitDisclosure.tsx';
const pageRel = `${NS}/plan-your-visit/page.tsx`;
const vd = readRepoFile(vdRel);
const pg = readRepoFile(pageRel);
if (vd === null || pg === null) fail('VisitDisclosure.tsx or the plan-your-visit page is missing');
else {
  const vdCode = stripComments(vd);
  if (!/export function VisitEmergency\b/.test(vdCode)) fail('VisitDisclosure.tsx must export VisitEmergency({ title, label, contacts, status, pendingLabel, researchLabel }) (S1)');
  if (!/PHONE_SHAPED/.test(vdCode) || !/tel:/.test(vdCode)) fail('the dial/on-site split (PHONE_SHAPED, tel: links) belongs in VisitDisclosure.tsx (S1)');
  if (!/data-tone|tone="pale"|tone: 'pale'|tone = 'pale'/.test(vdCode)) fail('the unconfirmed on-site disclosure must use the pale tone (S1)');
  if (!/<NosSection\b[^>]*bg-\[var\(--gold\)\]/.test(vdCode.replace(/\s+/g, ' '))) fail('VisitEmergency must render <NosSection className="... bg-[var(--gold)]"> as the full-bleed band (S3b)');
  if (!/mb-8/.test(vdCode)) fail('the "In an emergency" h2 needs mb-8 (32px) (S3b)');
  const code = stripComments(pg);
  const flat = code.replace(/\s+/g, ' ');
  if (!/<VisitEmergency\b[^>]*status=\{status\.emergencyContacts\}/.test(flat)) fail('page.tsx must render <VisitEmergency ... status={status.emergencyContacts}> (S2)');
  if (!/EMERGENCY_LABEL\s*=\s*'Emergency contacts, to be confirmed by the show committee'/.test(code)) fail('the emergency aria-label constant must stay unchanged (S2)');
  const iClose = code.lastIndexOf('</NosSection>'); const iEm = code.indexOf('<VisitEmergency'); const iCta = code.indexOf('<CtaBand');
  if (!(iClose >= 0 && iEm > iClose && iCta > iEm)) fail('page.tsx must place <VisitEmergency> after the main </NosSection> and before <CtaBand>, so the band is full-bleed (S3b)');
  if (/<ConfirmationBadge\b/.test(code)) fail('page.tsx must not draw a ConfirmationBadge any more (S2)');
  if (/PHONE_SHAPED|tel:/.test(code)) fail('page.tsx must not carry PHONE_SHAPED or tel: links any more (S2)');
  if (!/(\/\/|\/\*)[^\n]*nos-v4\/plan-your-visit\.html/.test(pg)) fail('page.tsx must keep a comment citing nos-v4/plan-your-visit.html (S3)');
  if (!/(\/\/|\/\*)[^\n]*deviat/i.test(pg)) fail('page.tsx needs a comment saying the emergency section deviates from the golden (Codi FINAL) (S3)');
  for (const [rel, src] of [[vdRel, vd], [pageRel, pg]]) {
    const base = readBaseFile(rel);
    if (base === null) continue;
    const was = new Set(copyStrings(base));
    for (const s of copyStrings(src)) if (!was.has(s)) fail(`${rel.split('/').pop()}: adds a copy string not in BASE: "${s.slice(0, 70)}" (S4)`);
  }
}
finish('f5-static.mjs', failures, 'VisitEmergency owns the dial/on-site split with a pale disclosure, the page delegates to it with the unchanged label and a deviation comment, no new copy.');
