// nos-critique-r6 f8 -- static source check for R50 on /national-show/what-to-expect (lead ruling 2026-10-16, re-confirmed 2026-10-17).
//   S1  the logistics NosSection precedes the <LongFormPage> NosSection in page.tsx (the minimal ordering change); LongFormPage,
//       ShowFacts, HoldingState are structurally identical to BASE (class-only differences from f1 pass)
//   S2  no SectionHeading as="h3" left; VisitorInfoBlock gains an additive heading-level prop whose default stays h3 (plan-your-visit
//       keeps its output); the logistics blocks opt into h2
//   S3  weekday range is DERIVED (Intl weekday), not retyped: page.tsx has weekday:'long' and neither it nor app/components/lib
//       contains the literal "Thursday 23 to Sunday 26 September 2027" or any "Thursday"/"Sunday" literal
//   S4  the seven narrative paragraphs in page.tsx equal goldens/f8-narrative.txt (docs/leeann-source/what-to-expect_2026-09-09.md)
//   S5  Codi Q3: one R11 status line per h2 block (page.tsx has at most the dates and hours <ConfirmationBadge>s; VisitorInfoBlock renders
//       its one); every BASE copy string survives and none is added
//   S7  Athanor review: page.tsx imports withholdPlaceholderProse from '@/lib/data/show-pages' and calls it once; no component reads the
//       preview/wall settings itself; the unsourced strings in goldens/f8-unsourced.json are not typed into the page
//   S6  HoldingState is not wired in (no section of Lee-Ann's 3.1 doc is empty) -- informational; docs cite R50
// Run as: node f8-static.mjs   (NOS_CR6_ROOT selects the worktree)
import { copyStrings, finish, readRepoFile, scopeFiles, stripComments, NS, DOC } from './_lib.mjs';
import { readBaseFile, golden, norm, STRUCTURE_LOCKED } from './f6-f8-lib.mjs';

const failures = [];
const fail = (m) => failures.push(m);
const pageRel = `${NS}/what-to-expect/page.tsx`;
const raw = readRepoFile(pageRel);
const page = raw === null ? '' : stripComments(raw);
const flat = page.replace(/\n/g, ' ');
if (raw === null) fail(`${pageRel} missing`);

// S1
const iLong = page.indexOf('<LongFormPage');
const iDates = page.indexOf('Show dates');
const iAccess = page.indexOf('heading="Accessibility"');
if (iLong < 0 || iDates < 0 || iAccess < 0) fail('could not locate <LongFormPage>, "Show dates" and the Accessibility block in page.tsx (S1)');
else if (!(iDates < iLong && iAccess < iLong)) fail('the logistics sections (Show dates .. Accessibility) must come before <LongFormPage> in page.tsx (S1)');
for (const rel of STRUCTURE_LOCKED) {
  const base = readBaseFile(rel);
  const now = readRepoFile(rel);
  if (base === null || now === null) fail(`${rel} missing`);
  else if (base !== now) fail(`${rel}: differs byte-for-byte from main 3f45db11 (BASE2); f8 does not touch the shared long-form template (S1). If an additive prop is truly unavoidable, stop and ask the lead.`);
}

// S2
if (/as=["{']+\s*['"]?h3/.test(flat)) fail('page.tsx still renders a SectionHeading as="h3" (S2)');
const vib = stripComments(readRepoFile('components/show/VisitorInfoBlock.tsx') ?? '');
if (!/'h2'/.test(vib) || !/'h3'/.test(vib)) fail("VisitorInfoBlock.tsx needs an additive heading-level prop typed 'h2' | 'h3' with the default 'h3' (S2)");
if (!/=\s*'h3'/.test(vib)) fail("VisitorInfoBlock's heading level must default to 'h3' so plan-your-visit is unchanged (S2)");
const blocks = [...flat.matchAll(/<VisitorInfoBlock\b[^>]*>/g)].map((m) => m[0]);
if (blocks.length < 5) fail(`expected the five VisitorInfoBlock uses (Admission, Food, Photography, Cloakroom, Accessibility), found ${blocks.length} (S2)`);

// S3
if (!/weekday:\s*'long'/.test(page)) fail("page.tsx has no Intl weekday: 'long' formatter for the show-dates range (S3)");
if (/Thursday|Sunday/.test(page)) fail('page.tsx contains a retyped weekday literal; the range must be derived from showDate/showEndDate (S3)');
for (const rel of scopeFiles().filter((r) => r.endsWith('.tsx'))) {
  if (/Thursday 23 to Sunday 26 September 2027/.test(readRepoFile(rel) ?? '')) fail(`${rel} retypes the FAQ weekday string (S3)`);
}

// S4
const jsx = page.slice(page.indexOf('paragraphs={['), page.indexOf(']}', page.indexOf('paragraphs={[')));
const got = [...jsx.matchAll(/<>\s*([\s\S]*?)\s*<\/>/g)].map((m) => norm(m[1].replace(/&rsquo;/g, "'").replace(/&lsquo;/g, "'").replace(/&amp;/g, '&')));
const want = golden('f8-narrative.txt').split('\n').map(norm).filter(Boolean);
if (got.length !== want.length) fail(`narrative paragraphs: ${got.length} in page.tsx, ${want.length} in the Drive mirror (S4)`);
want.forEach((w, i) => { if (got[i] !== w) fail(`narrative paragraph ${i + 1} differs from docs/leeann-source/what-to-expect_2026-09-09.md (S4): "${(got[i] ?? '').slice(0, 70)}"`); });

// S5
const badgeUses = (page.match(/<ConfirmationBadge\b/g) ?? []).length;
if (badgeUses > 2) fail(`<ConfirmationBadge> rendered ${badgeUses}x in page.tsx; only the dates and hours blocks may carry their own line, one per block (Codi Q3) (S5)`);
const base = readBaseFile(pageRel);
if (base !== null && raw !== null) {
  const now = new Set(copyStrings(raw));
  const was = copyStrings(base);
  for (const s of was) if (!now.has(s)) fail(`copy string lost: "${s.slice(0, 60)}" (S5, move only)`);
  for (const s of now) if (!was.includes(s)) fail(`copy string added: "${s.slice(0, 60)}" (S5, no invention)`);
}
if (/HoldingState/.test(page)) console.warn('note: HoldingState is wired into what-to-expect; the Drive 3.1 doc has no empty section, so this needs the lead (S6)');

// S7
if (!/import\s*\{[^}]*\bwithholdPlaceholderProse\b[^}]*\}\s*from\s*'@\/lib\/data\/show-pages'/.test(page)) fail("what-to-expect/page.tsx must import withholdPlaceholderProse from '@/lib/data/show-pages' (S7: reuse, do not fork)");
if ((page.match(/withholdPlaceholderProse\(\)/g) ?? []).length !== 1) fail('what-to-expect/page.tsx must call withholdPlaceholderProse() exactly once (S7)');
if (/SHOW_PLACEHOLDER_PREVIEW|BETA_BASIC_AUTH/.test(page) || /SHOW_PLACEHOLDER_PREVIEW|BETA_BASIC_AUTH/.test(vib)) fail('only withholdPlaceholderProse() may decide public vs preview (S7)');
for (const str of JSON.parse(golden('f8-unsourced.json')).withheldInPublic) if (page.includes(str)) fail(`page.tsx types unsourced text: "${str}" (S7)`);

// S8 -- public logistics line (Codi): ShowHoldingNote = ONE R11 line via ShowStatusLine + the existing "Be the first to know" link
const note = stripComments(readRepoFile('components/show/ShowHoldingNote.tsx') ?? '');
if (note === '') fail('components/show/ShowHoldingNote.tsx is missing (S8: the public status line + link)');
else {
  if (/['"]use client['"]/.test(note)) fail('ShowHoldingNote.tsx is a client component (S8)');
  if (!/from\s*'\.\/ShowStatusLine'|from\s*'@\/components\/show\/ShowStatusLine'/.test(note)) fail('ShowHoldingNote.tsx must reuse ShowStatusLine (S8)');
  if (!note.includes('Be the first to know') || !/href=\{?['"]\/contact['"]/.test(note)) fail('ShowHoldingNote.tsx must carry the existing "Be the first to know" string linking /contact (S8)');
}
if (!/ShowHoldingNote/.test(page)) fail('what-to-expect/page.tsx does not render ShowHoldingNote (S8)');

// S6
const doc = readRepoFile(DOC);
if (doc === null) fail(`${DOC} missing`);
else if (!/R50/.test(doc)) fail(`${DOC} must cite R50`);

{
  // S9 Codi FINAL: the public line is the v4 R11 disclosure built by ShowStatusLine's chip+list variant
  const note9 = readRepoFile('components/show/ShowHoldingNote.tsx') ?? '';
  const line9 = readRepoFile('components/show/ShowStatusLine.tsx') ?? '';
  if (!/data-status-disclosure/.test(line9) || !/data-status-list/.test(line9)) fail('ShowStatusLine.tsx must render data-status-disclosure and data-status-list (S9)');
  if (!/<ShowStatusLine\b[^>]*\bitems=/s.test(note9)) fail('ShowHoldingNote.tsx must pass items= to ShowStatusLine (S9)');
  if (/\$\{[^}]*pendingLabel[^}]*\}:/.test(note9) || /label\}: /.test(note9)) fail('ShowHoldingNote.tsx still builds the old "label: names" caps line (S9)');
  if (!/toLowerCase\(\)/.test(note9) || !/' · '/.test(note9)) fail('ShowHoldingNote.tsx must lower-case the headings after the first and join them with " · " (S9)');
  if (!/<Link\b[\s\S]*Be the first to know[\s\S]*<\/ShowStatusLine>/.test(note9) && !/children/.test(line9)) fail('"Be the first to know" must sit inside the ShowStatusLine surface (S9)');
}
finish('f8-static.mjs', failures, 'R50: logistics before LongFormPage, shared template untouched, h2 siblings, weekday range derived, seven Drive paragraphs verbatim, one status line, no copy change, docs cite R50.');
