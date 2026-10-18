// nos-critique-r15 f1 static (QA input, hash-locked). F1 (lead ruling FINAL 2026-10-18, consistent with F24 vote 1C): the PUBLIC build
// withholds the unsourced per-society estimates through the existing switch, withholdPlaceholderProse() (lib/data/show-pages.ts).
//   S1  lib/data/society-withhold.ts (new) exports withholdSocietyEstimates(society, withhold); it imports nothing at runtime (type-only
//       imports allowed) and contains no string literal (no copy). Behaviour is proved by f1-unit.mjs.
//   S2  app/(marketing)/societies/page.tsx and app/(marketing)/societies/[slug]/page.tsx keep every BASE line except the JSX lines that
//       hand the society data to its renderers (SocietiesClient; SocietyFacts and SocietyAbout), import withholdSocietyEstimates, bind
//       `const <x> = <...>withholdSocietyEstimates(...)` and pass <x> to those renderers (SocietyAbout also gets withhold={...}); the slug
//       page calls withholdPlaceholderProse() (the /societies page already does at BASE).
//   S3  components/societies/SocietyAbout.tsx keeps every BASE line except its props/signature lines and the fallback's opening condition;
//       it gains an optional `withhold` prop; no BASE string literal is dropped and none is added.
//   S4  SocietyCard.tsx, SocietyFacts.tsx, SocietiesClient.tsx, SocietiesFallback.tsx and lib/data/show-pages.ts are byte-identical to
//       BASE: the decision is made on the server, in the data, before anything reaches the client component.
//   S5  no added non-import line anywhere in the F1 footprint carries a string literal of 12+ chars that is not already in the BASE file it
//       sits in (no new copy; the CTA sentence moves into a conditional unchanged).
//   S6  docs/nos-critique-r15.md records F1.
//   S7  (lead ruling FINAL 2026-10-18, amendment) the slug page's CTASection body, the unsourced "SAOC coordinates 21 affiliated societies
//       across South Africa" sentence, is withheld on public the way /about's CTA already is: `body={withhold ? undefined : '<BASE sentence>'}`
//       on the same withhold const, no `marked` prop added (beta byte-unchanged); eyebrow, heading and both buttons stay;
//       components/ui/CTASection.tsx is byte-identical (its body is already optional and renders nothing when omitted).
import { DOC, additions, finish, readBaseFile, readRepoFile } from './_lib.mjs';

const NAME = 'f1-static.mjs';
const failures = [];
const HELPER = 'lib/data/society-withhold.ts';
const LIST = 'app/(marketing)/societies/page.tsx';
const SLUG = 'app/(marketing)/societies/[slug]/page.tsx';
const ABOUT = 'components/societies/SocietyAbout.tsx';
const CTA_BODY = 'SAOC coordinates 21 affiliated societies across South Africa. Browse the full list, or get in touch with the national committee directly.';
const FROZEN = ['components/ui/CTASection.tsx', 'components/societies/SocietyCard.tsx', 'components/societies/SocietyFacts.tsx', 'app/(marketing)/societies/SocietiesClient.tsx', 'app/(marketing)/societies/SocietiesFallback.tsx', 'lib/data/show-pages.ts'];
const MIN_LITERAL = 12;
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const literals = (code) => [...stripComments(code).matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`([^`]*)`/g)].map((m) => m[1] ?? m[2] ?? m[3]);
const textOf = (lines) => lines.join('\n');
const allAdded = [];

// S1
const helper = readRepoFile(HELPER);
if (helper === null) failures.push(`${HELPER} is missing (S1)`);
else {
  if (!/export function withholdSocietyEstimates\s*[<(]/.test(helper)) failures.push(`${HELPER}: no exported function withholdSocietyEstimates (S1)`);
  const runtimeImports = helper.split('\n').filter((l) => /^\s*import\s/.test(l) && !/^\s*import\s+type\s/.test(l));
  if (runtimeImports.length) failures.push(`${HELPER}: runtime import(s) ${JSON.stringify(runtimeImports)}; the helper must be pure (S1)`);
  const lits = literals(helper.split('\n').filter((l) => !/^\s*import\s+type\s/.test(l)).join('\n'));
  if (lits.length) failures.push(`${HELPER}: carries string literal(s) ${JSON.stringify(lits.slice(0, 3))}; no copy (S1)`);
  allAdded.push(...helper.split('\n'));
}

// S2
const RENDER = {
  [LIST]: { dropped: ['          <SocietiesClient societies={societies} provinces={provinceChips} />'], uses: (v) => [new RegExp(`<SocietiesClient societies=\\{${v}\\} provinces=\\{provinceChips\\} />`)] },
  [SLUG]: { dropped: ['        <SocietyFacts society={society} />', '        <SocietyAbout society={society} />', `        body="${CTA_BODY}"`], uses: (v) => [new RegExp(`<SocietyFacts society=\\{${v}\\} />`), new RegExp(`<SocietyAbout society=\\{${v}\\} withhold=\\{[\\w.()]+\\} />`)] },
};
for (const file of [LIST, SLUG]) {
  const head = readRepoFile(file);
  const base = readBaseFile(file);
  if (head === null || base === null) { failures.push(`${file} missing at HEAD or BASE (S2)`); continue; }
  const { added, missing } = additions(head, base, RENDER[file].dropped);
  for (const m of missing) failures.push(`${file}: BASE line removed or changed: "${m.trim().slice(0, 90)}" (S2)`);
  if (!/^import \{[^}]*\bwithholdSocietyEstimates\b[^}]*\} from '@\/lib\/data\/society-withhold';$/m.test(head)) failures.push(`${file}: does not import withholdSocietyEstimates from '@/lib/data/society-withhold' (S2)`);
  const bound = /const (\w+)(?::[^=]+)? = [^;]*\bwithholdSocietyEstimates\(/.exec(textOf(added));
  if (!bound) failures.push(`${file}: no added \`const <x> = ...withholdSocietyEstimates(...)\` (S2)`);
  else for (const re of RENDER[file].uses(bound[1])) if (!re.test(head)) failures.push(`${file}: the renderer does not receive the withheld data ${bound[1]}: want ${re.source} (S2)`);
  if (file === SLUG && !/withholdPlaceholderProse\(\)/.test(textOf(added))) failures.push(`${file}: does not call withholdPlaceholderProse() (S2)`);
  allAdded.push(...added);
}

// S3
{
  const head = readRepoFile(ABOUT);
  const base = readBaseFile(ABOUT);
  if (head === null || base === null) failures.push(`${ABOUT} missing (S3)`);
  else {
    const dropped = ['  society: SanitySociety;', 'export function SocietyAbout({ society }: SocietyAboutProps) {', '      {!society.description && ('];
    const { added, missing } = additions(head, base, dropped);
    for (const m of missing) failures.push(`${ABOUT}: BASE line removed or changed: "${m.trim().slice(0, 90)}" (S3)`);
    if (!/\bwithhold\?:\s*boolean;/.test(head)) failures.push(`${ABOUT}: no optional \`withhold?: boolean\` prop (S3)`);
    const baseLits = new Set(literals(base));
    for (const l of literals(head)) if (l.length >= MIN_LITERAL && !baseLits.has(l)) failures.push(`${ABOUT}: new string literal "${l.slice(0, 60)}" (S3)`);
    for (const l of literals(base)) if (!literals(head).includes(l)) failures.push(`${ABOUT}: BASE literal dropped "${l.slice(0, 60)}" (S3)`);
    allAdded.push(...added);
  }
}

// S4
for (const f of FROZEN) if (readRepoFile(f) !== readBaseFile(f)) failures.push(`${f} must be byte-identical to BASE (S4: decide on the server, in the data)`);

// S5
const baseLiterals = new Set([LIST, SLUG, ABOUT].flatMap((f) => literals(readBaseFile(f) ?? '')));
for (const l of literals(allAdded.filter((x) => !/^\s*import\s/.test(x)).join('\n'))) if (l.length >= MIN_LITERAL && !baseLiterals.has(l)) failures.push(`added string literal "${l.slice(0, 60)}" is new copy (S5)`);

// S7
{
  const head = readRepoFile(SLUG) ?? '';
  const cta = /<CTASection\b([\s\S]*?)\/>/.exec(head);
  if (!cta) failures.push(`${SLUG}: no CTASection (S7)`);
  else {
    const props = cta[1];
    const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!new RegExp(`\\bbody=\\{\\s*withhold\\s*\\?\\s*undefined\\s*:\\s*'${esc(CTA_BODY)}'\\s*\\}`).test(props)) failures.push(`${SLUG}: CTASection body is not \`{withhold ? undefined : '<the BASE sentence>'}\` (S7)`);
    if (/\bmarked=/.test(props)) failures.push(`${SLUG}: CTASection gains a marked prop; the beta preview must stay byte-unchanged (S7)`);
    for (const p of ['eyebrow="Keep exploring"', 'heading="Find another society, or reach the council"', "primaryCta={{ href: '/societies', label: 'Find a society' }}", "secondaryCta={{ href: '/contact', label: 'Contact SAOC' }}"]) if (!props.includes(p)) failures.push(`${SLUG}: CTASection lost ${p} (S7)`);
  }
}

// S6
const doc = readRepoFile(DOC);
if (doc === null || !/\bF1\b/.test(doc)) failures.push(`${DOC} must record F1 (S6)`);

finish(NAME, failures, 'the estimates and the CTA count are withheld on the server through withholdPlaceholderProse(); client components and CTASection untouched; no new copy; docs record F1.');
