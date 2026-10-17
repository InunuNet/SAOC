// nos-critique-r6 f6 -- static source check for R34 on /national-show/exhibitors (NOS Design "Codi" sign-off 2026-10-17).
//   S1  one chip class string (goldens/f6-chip-class.txt = the FAQ R52 chips at BASE) lives in ONE new shared file
//       components/show/ShowJumpChips.tsx; ShowFaqList imports it and keeps its "FAQ categories" label and faq-<category> ids
//   S2  components/show/ExhibitorJumpNav.tsx (new) is server-only, holds the "On this page" copy, a native <details> with no
//       `open`, a <summary> with min-h-[44px] and an svg chevron, no client code
//   S3  the four h2 components give their <h2> an id and the r4 scroll margin (62 / md:74); exhibitors/page.tsx renders the jump
//       nav, keeps every BASE copy string, keeps the end CTA and adds the banner CTA from ONE "Contact the council" literal
//   S4  R34 #4 IN: ExhibitorSteps keeps its <ol> and its copy, and the step numeral is Fraunces (font-serif, no font-sans)
//   S5  no 'use client' in any new file; docs/nos-critique-r6.md cites R34
// Run as: node f6-static.mjs   (NOS_CR6_ROOT selects the worktree)
import { copyStrings, finish, readRepoFile, scopeFiles, stripComments, NS, DOC } from './_lib.mjs';
import { readBaseFile, golden } from './f6-f8-lib.mjs';

const failures = [];
const fail = (m) => failures.push(m);
const R52 = golden('f6-chip-class.txt').trim();
const code = (rel) => { const raw = readRepoFile(rel); return raw === null ? null : stripComments(raw); };

// S1
const chips = code('components/show/ShowJumpChips.tsx');
if (chips === null) fail('components/show/ShowJumpChips.tsx is missing (S1: the shared R52 chip component)');
else {
  if (!chips.includes(R52)) fail('ShowJumpChips.tsx does not contain the R52 chip class string verbatim (S1)');
  if (/['"]use client['"]/.test(chips)) fail('ShowJumpChips.tsx is a client component (S5)');
}
const holders = scopeFiles().filter((rel) => rel.endsWith('.tsx') && (code(rel) ?? '').includes(R52));
if (holders.length !== 1) fail(`the R52 chip class string must live in exactly one file, found ${holders.length}: ${holders.join(', ') || 'none'} (S1)`);
const faq = code('components/show/ShowFaqList.tsx');
if (faq === null) fail('ShowFaqList.tsx missing');
else {
  if (!/from\s*'\.\/ShowJumpChips'|from\s*'@\/components\/show\/ShowJumpChips'/.test(faq)) fail('ShowFaqList.tsx does not import ShowJumpChips (S1)');
  if (!faq.includes('FAQ categories')) fail('ShowFaqList.tsx lost its "FAQ categories" label (S1)');
  if (!faq.includes('`faq-${category}`') && !faq.includes('#faq-')) fail('ShowFaqList.tsx lost the faq-<category> ids (S1)');
}

// S2
const nav = code('components/show/ExhibitorJumpNav.tsx');
if (nav === null) fail('components/show/ExhibitorJumpNav.tsx is missing (S2)');
else {
  if (!nav.includes('On this page')) fail('ExhibitorJumpNav.tsx lacks the "On this page" label (S2)');
  if (!/<details\b/.test(nav) || !/<summary\b/.test(nav)) fail('ExhibitorJumpNav.tsx must use a native <details>/<summary> (S2)');
  if (/<details\b[^>]*\bopen\b/.test(nav)) fail('the <details> must be collapsed by default; no `open` attribute (S2)');
  if (!/<summary\b[^>]*min-h-\[44px\]/.test(nav.replace(/\n/g, ' '))) fail('the <summary> must carry min-h-[44px] (S2)');
  if (!/<svg\b/.test(nav)) fail('the <summary> needs an svg chevron (S2)');
  if (/['"]use client['"]|useState|useEffect|onClick/.test(nav)) fail('ExhibitorJumpNav.tsx must be server-only, no client code (S2, S5)');
  // the name reaches the landmark through ShowJumpChips' `label` prop (it renders <nav aria-label={label}>); no wrapper may repeat it
  if (!/<ShowJumpChips\b[^>]*\blabel=/s.test(nav)) fail('the chip list must get its name through <ShowJumpChips label=...> so it renders <nav aria-label="On this page"> (S2)');
  if (/\brole=["{']+\s*['"]?group/.test(nav)) fail('ExhibitorJumpNav.tsx must not wrap the nav in role="group"; the name would be announced twice (S2)');
  if (/aria-label=/.test(nav.replace(/<ShowJumpChips[\s\S]*?\/>/g, ''))) fail('ExhibitorJumpNav.tsx repeats an aria-label outside the ShowJumpChips label prop (S2)');
}

// S3
for (const [rel, tagName] of [['components/show/ExhibitorKeyDates.tsx', 'h2'], ['components/show/EntryFormLink.tsx', 'h2'], ['components/show/ExhibitorSteps.tsx', 'h2'], ['components/show/ExhibitorQuestions.tsx', 'h2'], ['components/show/ExhibitorSection.tsx', 'h3']]) {
  const src = code(rel) ?? '';
  const h2 = (src.replace(/\n/g, ' ').match(new RegExp(`<${tagName}\\b[^>]*>`)) ?? [''])[0];
  if (!/\bid=/.test(h2)) fail(`${rel}: the <${tagName}> carries no id, so a chip cannot anchor to it (S3)`);
  if (!/scroll-mt-\[62px\]/.test(h2) || !/md:scroll-mt-\[74px\]/.test(h2)) fail(`${rel}: the <${tagName}> lacks scroll-mt-[62px] md:scroll-mt-[74px], the r4 offset (S3)`);
}
const pageRel = `${NS}/exhibitors/page.tsx`;
const page = code(pageRel);
const basePage = readBaseFile(pageRel);
if (page === null) fail(`${pageRel} missing`);
else {
  if (!/ExhibitorJumpNav/.test(page)) fail('exhibitors/page.tsx does not render ExhibitorJumpNav (S3)');
  const now = new Set(copyStrings(readRepoFile(pageRel)));
  for (const s of copyStrings(basePage)) if (!now.has(s)) fail(`exhibitors/page.tsx lost a BASE copy string: "${s.slice(0, 60)}" (S3)`);
  const added = [...now].filter((s) => !copyStrings(basePage).includes(s));
  if (added.length > 0) fail(`exhibitors/page.tsx adds copy strings (new copy lives in ExhibitorJumpNav, not the page; no invention): ${added.map((s) => `"${s.slice(0, 40)}"`).join(', ')} (S3)`);
  const contactLiterals = page.split('\n').filter((l) => /^\s*Contact the council\s*$|['"`]Contact the council['"`]/.test(l)).length;
  if (contactLiterals !== 1) fail(`the button label "Contact the council" appears ${contactLiterals}x as its own literal; the banner and end CTA must share ONE (f1 T8 compares copy as a multiset) (S3)`);
  if ((page.match(/href=["{'`]*\/contact\b|href=\{?\s*CONTACT/g) ?? []).length < 1 && !/\/contact/.test(page)) fail('no /contact href left on the page (S3)');
}

// S4
const steps = code('components/show/ExhibitorSteps.tsx');
if (steps === null) fail('ExhibitorSteps.tsx missing');
else {
  if (!/<ol\b/.test(steps)) fail('ExhibitorSteps lost its <ol> (S4)');
  const numeral = (steps.replace(/\n/g, ' ').match(/<span\b[^>]*aria-hidden[^>]*>\s*\{index \+ 1\}/) ?? [''])[0];
  if (!numeral) fail('could not find the aria-hidden step numeral <span>{index + 1}</span> (S4)');
  else {
    if (!/\bfont-serif\b/.test(numeral)) fail('the step numeral must be Fraunces: font-serif (S4)');
    if (/\bfont-sans\b/.test(numeral)) fail('the step numeral still carries font-sans (S4)');
  }
  const base = readBaseFile('components/show/ExhibitorSteps.tsx');
  if (base !== null && copyStrings(base).sort().join('\n') !== copyStrings(readRepoFile('components/show/ExhibitorSteps.tsx')).sort().join('\n')) fail('ExhibitorSteps copy strings changed (S4: existing text unchanged)');
}

// S6 -- public-mode rulings (NOS Design, 2026-10-17): gated by the EXISTING withholdPlaceholderProse(), never forked
if (page !== null) {
  if (!/import\s*\{[^}]*\bwithholdPlaceholderProse\b[^}]*\}\s*from\s*'@\/lib\/data\/show-pages'/.test(page)) fail("exhibitors/page.tsx must import withholdPlaceholderProse from '@/lib/data/show-pages' (S6: reuse, do not fork)");
  if ((page.match(/withholdPlaceholderProse\(\)/g) ?? []).length !== 1) fail('exhibitors/page.tsx must call withholdPlaceholderProse() exactly once and pass the result down (S6)');
}
for (const rel of ['components/show/ExhibitorSection.tsx', 'components/show/ExhibitorKeyDates.tsx', 'components/show/ExhibitorSteps.tsx', 'components/show/EntryFormLink.tsx', 'components/show/ExhibitorQuestions.tsx', 'components/show/ShowStatusLine.tsx', 'components/show/ExhibitorJumpNav.tsx']) {
  const src = code(rel);
  if (src === null) { if (rel.endsWith('ShowStatusLine.tsx')) fail('components/show/ShowStatusLine.tsx is missing (S6: the one-line status component f6 and f8 share)'); continue; }
  if (/SHOW_PLACEHOLDER_PREVIEW|process\.env|BETA_BASIC_AUTH/.test(src)) fail(`${rel} reads the preview/wall settings itself; only withholdPlaceholderProse() may decide public vs preview (S6)`);
}
const line = code('components/show/ShowStatusLine.tsx');
if (line !== null) {
  if (/['"]use client['"]/.test(line)) fail('ShowStatusLine.tsx is a client component (S5)');
  if (!/StatusMarker|ConfirmationBadge|ExhibitorStatusBadge/.test(line)) fail('ShowStatusLine.tsx must render the existing R11 marker (StatusMarker / ConfirmationBadge / ExhibitorStatusBadge), not a new chip (S6)');
}

// S5
const doc = readRepoFile(DOC);
if (doc === null) fail(`${DOC} missing`);
else if (!/R34/.test(doc)) fail(`${DOC} must cite R34`);

{
  if (chips === null || !/<a\b/.test(chips) || !/href=\{/.test(chips) || /<Link\b/.test(chips)) fail('ShowJumpChips must render plain <a href> anchors, so the jump needs no script (S6)');
  if (chips !== null && /onClick|scrollIntoView|use client/.test(chips)) fail('ShowJumpChips must not add click handlers or client code (S6)');
  const page = code('app/(marketing)/national-show/exhibitors/page.tsx') ?? '';
  if (!/import \{ connection \} from 'next\/server'/.test(page) || !/await connection\(\)/.test(page)) fail('exhibitors/page.tsx must call await connection() so public/preview mode is read per request (S6)');
}
{
  const steps = code('components/show/ExhibitorSteps.tsx') ?? '';
  const m = steps.match(/<p\b[^>]*className=("[^"]*"|\{`[^`]*`\})[^>]*>\s*\{step\.when\}/);
  if (!m) fail('ExhibitorSteps.tsx: the {step.when} timing <p> was not found (S7)');
  else {
    if (!/text-\[14px\]/.test(m[1])) fail('ExhibitorSteps timing line must be text-[14px] (S7)');
    if (!/leading-\[1\.45\]/.test(m[1])) fail('ExhibitorSteps timing line must be leading-[1.45] (S7)');
    if (!/ink-700/.test(m[1])) fail('ExhibitorSteps timing line must use the ink-700 token (S7)');
    if (/text-\[12px\]|text-muted/.test(m[1])) fail('ExhibitorSteps timing line still carries text-[12px] or text-muted (S7)');
  }
}
{
  // S8 Codi FINAL: ShowStatusLine's chip+list variant is the v4 R11 disclosure; the f6 page-level pending line uses it
  const line = code('components/show/ShowStatusLine.tsx') ?? '';
  if (!/data-status-disclosure/.test(line)) fail('ShowStatusLine.tsx must render the gold surface with data-status-disclosure (S8)');
  if (!/data-status-list/.test(line)) fail('ShowStatusLine.tsx must render the list with data-status-list (S8)');
  if (!/\bitems\b/.test(line)) fail('ShowStatusLine.tsx needs an items prop for the list (S8)');
  if (!/gold/.test(line) || !/rounded/.test(line) || !/shadow/.test(line)) fail('ShowStatusLine.tsx surface needs the --gold fill, a rounded radius and shadow-sm (S8)');
  if (!/text-\[16px\]/.test(line) || !/leading-\[1\.55\]/.test(line) || !/ink-700/.test(line)) fail('ShowStatusLine.tsx list must be text-[16px] leading-[1.55] ink-700 (S8)');
  if (/uppercase/.test(line.slice(line.search(/data-status-list/)))) fail('ShowStatusLine.tsx list must not be uppercase (S8)');
  // Codi chip ruling: the tightening is scoped to the disclosure at <=700; the global StatusMarker is untouched
  if (!/0\.06em/.test(line) || !/(?:10px|px-2\.5)/.test(line) || !/700px/.test(line)) fail('ShowStatusLine.tsx must tighten the chip inside the disclosure at <=700px: 0.06em tracking and 10px inline padding (S8)');
  if (!/max-\[700px\]:px-4|max-\[700px\]:px-\[16px\]|max-\[700px\]:\[padding-inline:16px\]|max-width:\s*700px[^}]*padding-inline:\s*16px/.test(line)) fail('the disclosure surface needs 16px inline padding at <=700px (S8)');
  { const sm = readBaseFile('components/show/_shared/StatusMarker.tsx'); const now = readRepoFile('components/show/_shared/StatusMarker.tsx'); if (sm !== null && now !== null && stripComments(sm) !== stripComments(now)) fail('the global StatusMarker.tsx must be unchanged (S8)'); }
  if (!/data-status-body/.test(line) || !/data-status-foot/.test(line)) fail('ShowStatusLine.tsx must render data-status-body and data-status-foot (S8: one surface, chip -> list -> body -> foot -> button)');
  if (!/text-\[15px\]/.test(line.slice(line.search(/data-status-foot/) >= 0 ? line.search(/data-status-foot/) : 0)) || !/ink-500/.test(line)) fail('the foot line must be text-[15px] ink-500, the v4 .disclosure-foot (S8)');
  if (/uppercase/.test(line.slice(line.search(/data-status-foot/) >= 0 ? line.search(/data-status-foot/) : 0))) fail('the foot line must not be uppercase (S8)');
  const pg = code('app/(marketing)/national-show/exhibitors/page.tsx') ?? '';
  { // Codi 2026-10-17: the steps item in the list is the ruled label "steps", held as a named const with a comment citing the ruling
    const rawPg = readRepoFile('app/(marketing)/national-show/exhibitors/page.tsx') ?? '';
    const m = rawPg.match(/((?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*)(?:export\s+)?const\s+((?=[A-Z0-9_]*STEPS)[A-Z][A-Z0-9_]*)\s*=\s*'steps'/);
    if (!m) fail("exhibitors/page.tsx must hold the ruled list label as a named const equal to 'steps', e.g. STEPS_LIST_LABEL (S8)");
    else if (!/Codi/.test(m[1]) || !/2026-10-17/.test(m[1])) fail('the steps label const needs a comment citing the Codi 2026-10-17 ruling directly above it (S8)');
    else if ((rawPg.match(new RegExp(`\\b${m[2]}\\b`, 'g')) ?? []).length < 2) fail(`the const ${m[2]} is declared but never used for the list (S8)`);
  }
  if (!/<ShowStatusLine\b[^>]*\bbody=/s.test(pg) || !/<ShowStatusLine\b[^>]*\bfoot=/s.test(pg)) fail('exhibitors/page.tsx must pass body= and foot= to the one public <ShowStatusLine> surface (S8)');
  if ((pg.match(/Exhibitor entries are not yet open/g) ?? []).length !== 1) fail('the banner sentence must appear exactly once in exhibitors/page.tsx (no copy duplicated into the surface) (S8)');
  if (!/<ShowStatusLine/.test(pg)) fail('exhibitors/page.tsx must render <ShowStatusLine> (S8)');
  if (!/<ShowStatusLine\b[^>]*\bitems=/s.test(pg)) fail('exhibitors/page.tsx must pass items= to the page-level <ShowStatusLine> pending line (S8)');
}
finish('f6-static.mjs', failures, 'R34: shared R52 chip class in one file, FAQ reuses it, collapsed native details + 44px summary + chevron, h2 ids and scroll-mt, banner CTA from one literal, Fraunces step numeral, no client code, docs cite R34, public-mode gating reuses withholdPlaceholderProse.');
