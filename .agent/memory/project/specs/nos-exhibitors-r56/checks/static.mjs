// nos-exhibitors-r56 static check. QA input, hash-locked. Golden: goldens/spec.md (the design), goldens/footprint.json.
//   S1  page.tsx: ExhibitorQuestions renders only when `questionsShown` (= !publicMode && openQuestions.length > 0), and the jump chip to
//       #exhibitor-questions uses the same flag, so a public build ships neither the section nor a dead chip.
//   S2  ExhibitorQuestions.tsx: a native <details> (no `open`) whose <summary> holds the existing H2, built from the jump-nav summary
//       classes (44px target, list-none, focus-visible outline on --ring-focus, webkit marker hidden) plus an aria-hidden svg marker.
//   S3  page.tsx: the three standalone links ("Show classes", "SAOC judging standards", Wild Orchids) get inline-flex min-h-6 items-center.
//   S4  nos-structure.css: one new `.nos-theme [data-exhibitor-marker]` rule, letter-spacing normal + text-transform none, after the R19
//       marker block; the R19 block and the confirmation-badge selector are untouched.
//   S5  ExhibitorKeyDates.tsx: no restatesPending, `{row.dateNote}` always rendered, the pill only for research/question rows.
//   S6  no invention: no colour literal, no custom property, no font, no new JSX text or string copy, "Date to be confirmed" nowhere; TSX diff small.
//   S7  docs/nos-exhibitors-r56.md records r56.
import { finish, git, readBaseFile, readRepoFile, BASE, DOC } from './_lib.mjs';

const failures = [];
const PAGE = 'app/(marketing)/national-show/exhibitors/page.tsx';
const CSS = 'app/(marketing)/national-show/nos-structure.css';
const QUESTIONS = 'components/show/ExhibitorQuestions.tsx';
const KEYDATES = 'components/show/ExhibitorKeyDates.tsx';
const need = (rel) => {
  const t = readRepoFile(rel);
  if (t === null) failures.push(`${rel} is missing`);
  return t ?? '';
};

// S1
const page = need(PAGE);
if (!/const questionsShown\s*=\s*!publicMode\s*&&\s*openQuestions\.length\s*>\s*0\s*;/.test(page)) failures.push('S1: page.tsx lacks "const questionsShown = !publicMode && openQuestions.length > 0;"');
if (!/questionsShown\s*&&\s*info\?\.questionsHeading\s*\?\s*\{\s*href:\s*'#exhibitor-questions'/.test(page)) failures.push('S1: the #exhibitor-questions jump chip is not gated on questionsShown');
const at = page.indexOf('<ExhibitorQuestions');
if (at === -1) failures.push('S1: <ExhibitorQuestions is gone from page.tsx (it must stay, preview-only)');
else if (!/\{questionsShown\s*\?\s*\(\s*$/.test(page.slice(0, at).trimEnd().split('\n').slice(-1)[0] ?? '') && !/questionsShown\s*\?\s*\(\s*$/.test(page.slice(Math.max(0, at - 200), at).trimEnd())) failures.push('S1: <ExhibitorQuestions is not wrapped in {questionsShown ? ( ... ) : null}');
if ((page.match(/<ExhibitorQuestions\b/g) ?? []).length !== 1) failures.push('S1: page.tsx must render <ExhibitorQuestions exactly once');

// S2
const q = need(QUESTIONS);
if (!/<details\b(?![^>]*\bopen\b)[^>]*>/.test(q)) failures.push('S2: no closed-by-default <details> (an `open` attribute is present or <details> is missing)');
const summary = /<summary\b([^>]*)>([\s\S]*?)<\/summary>/.exec(q);
if (!summary) failures.push('S2: no <summary>');
else {
  for (const c of ['min-h-[44px]', 'list-none', 'cursor-pointer', 'focus-visible:outline', 'focus-visible:outline-2', 'focus-visible:outline-[var(--ring-focus)]', '[&::-webkit-details-marker]:hidden'])
    if (!summary[1].includes(c)) failures.push(`S2: the <summary> lacks the class ${c} (copy it from ExhibitorJumpNav)`);
  if (!/<h2\b[\s\S]*?\{heading\}[\s\S]*?<\/h2>/.test(summary[2])) failures.push('S2: the existing H2 ({heading}) is not inside the <summary>');
  if (!/<svg\b[^>]*aria-hidden="true"/.test(summary[2])) failures.push('S2: no aria-hidden svg disclosure marker inside the <summary>');
  if (!/id=\{headingId\}/.test(summary[2])) failures.push('S2: the H2 must keep id={headingId}');
}

// S3
for (const label of ['classesLinkLabel', 'judgingLinkLabel']) {
  const m = new RegExp(`<Link\\s+href="[^"]+"\\s+className="([^"]*)"\\s*>\\s*\\{info\\?\\.${label}`).exec(page);
  if (!m || !/\binline-flex\b/.test(m[1]) || !/\bmin-h-(6|\[24px\])/.test(m[1]) || !/\bitems-center\b/.test(m[1])) failures.push(`S3: the ${label} link lacks inline-flex min-h-6 items-center`);
}
const wosa = /<a\s+href="https:\/\/wildorchids\.co\.za"[^>]*className="([^"]*)"/.exec(page);
if (!wosa || !/\binline-flex\b/.test(wosa[1]) || !/\bmin-h-(6|\[24px\])/.test(wosa[1]) || !/\bitems-center\b/.test(wosa[1])) failures.push('S3: the Wild Orchids link lacks inline-flex min-h-6 items-center');

// S4
const css = need(CSS);
const r19 = css.indexOf('.nos-theme [data-exhibitor-marker] {');
const rules = [...css.matchAll(/\.nos-theme \[data-exhibitor-marker\]\s*\{([^}]*)\}/g)];
if (r19 === -1 || rules.length !== 2) failures.push(`S4: expected the R19 marker rule plus exactly one new ".nos-theme [data-exhibitor-marker] { ... }" rule, found ${rules.length} such rules`);
else {
  const added = rules.find((r) => !/border-radius/.test(r[1]));
  const decls = (added?.[1] ?? '').split(';').map((d) => d.trim()).filter(Boolean).sort();
  if (!added || decls.length !== 2 || decls[0] !== 'letter-spacing: normal' || decls[1] !== 'text-transform: none') failures.push(`S4: the new rule must hold exactly "letter-spacing: normal; text-transform: none", has: ${decls.join('; ')}`);
  if (added && added.index < css.indexOf('.nos-theme [data-confirmation-badge],')) failures.push('S4: the new rule must follow the R19 marker block');
}
const baseCss = readBaseFile(CSS) ?? '';
const r19Block = /\.nos-theme \[data-confirmation-badge\],\n\.nos-theme \[data-exhibitor-marker\] \{[^}]*\}/.exec(baseCss)?.[0];
if (!r19Block || !css.includes(r19Block)) failures.push('S4: the R19 marker block (confirmation badge + exhibitor marker) was edited; the new rule must be separate');

// S5
const kd = need(KEYDATES);
if (/restatesPending/.test(kd)) failures.push('S5: ExhibitorKeyDates still uses restatesPending');
if (!/\{row\.dateNote\}/.test(kd) || /restates|hideMarkers\s*&&[^}]*row\.dateNote|row\.dateNote\s*\?/.test(kd.replace(/\/\*[\s\S]*?\*\//g, ''))) failures.push('S5: {row.dateNote} must be rendered unconditionally');
if (!/row\.status\s*===\s*'research'/.test(kd) || !/row\.status\s*===\s*'question'/.test(kd)) failures.push("S5: the row pill must be limited to row.status === 'research' | 'question'");
if (!/<ExhibitorStatusBadge\b/.test(kd)) failures.push('S5: ExhibitorStatusBadge must stay for research/question rows');

// S6
const FILES = [PAGE, CSS, QUESTIONS, KEYDATES];
let tsxAdded = 0;
for (const rel of FILES) {
  const diff = git('diff', '-U0', BASE, '--', rel);
  const added = diff.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1));
  const isCss = rel.endsWith('.css');
  if (!isCss) tsxAdded += added.length;
  const removed = new Set(diff.split('\n').filter((l) => l.startsWith('-') && !l.startsWith('---')).flatMap((l) => l.slice(1).split(/\s+/)));
  for (const full of added) {
    const l = full.split(/\s+/).filter((tok) => !removed.has(tok)).join(' ');
    if (/#[0-9a-fA-F]{3,8}\b/.test(l)) failures.push(`S6: colour literal added in ${rel}: ${l.trim()}`);
    if (isCss && (/^\s*--[\w-]+\s*:/.test(l) || /font-family|@font-face|rgba?\(|\bhsl/.test(l))) failures.push(`S6: custom property/font/colour added in ${rel}: ${l.trim()}`);
    if (!isCss && />\s*[A-Za-z][^<>{}]*</.test(l) && !/=>/.test(l)) failures.push(`S6: JSX text added in ${rel}: ${l.trim()}`);
    if (!isCss && /Date to be confirmed/i.test(l)) failures.push(`S6: invented copy added in ${rel}: ${l.trim()}`);
  }
}
if (tsxAdded > 90) failures.push(`S6: the TSX diff adds ${tsxAdded} lines (limit 90)`);

// S7
const doc = readRepoFile(DOC);
if (doc === null) failures.push(`S7: ${DOC} is missing`);
else for (const t of ['r56', 'details', 'publicMode', 'letter-spacing', 'Date to be confirmed']) if (!doc.includes(t)) failures.push(`S7: ${DOC} does not mention ${t}`);

finish('static.mjs', failures, 'public gate + chip, details/summary with the H2, 24px links, sentence-case pill rule, key-date pills dropped, no invention, docs present.');
