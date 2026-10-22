// nos-faq-public-r57b static: source-level guards for the public FAQ rule. QA input, hash-locked. Each failure names its rule.
//   S1  faq/page.tsx decides "sourced" from data: the row is wired (wired[faq._id]) or faq.status === 'confirmed'; the public list is filtered on it.
//   S2  No hardcoded row ids beyond the two r57 wired ids (the rule is data-driven, not a list of questions).
//   S3  The page-level gap line is the existing ShowStatusLine, drawn once, no longer behind `hideUnanswered ? null`; the JSON-LD still comes from visibleFaqs.
//   S4  ShowFaqList, the CSS and every other component are untouched (footprint) and the page carries no 'use client'.
//   S5  No invention: added lines carry no hex colour, font-family, TBC literal, Sanity write call or new multi-word string literal.
//   S7  nos-structure.css: one rule after the R19 block gives [data-confirmation-badge] (and [data-exhibitor-marker]) letter-spacing normal / text-transform none; r57's .nos-faq-answer rule is gone; the R19 block is untouched.
//   S6  docs/nos-faq-public-r57b.md records r57b, the sourced-row rule and its evidence (status field), O4, JSON-LD, ShowStatusLine and the owner flags.
import { finish, git, readBaseFile, readRepoFile, BASE, DOC } from './_lib.mjs';

const FILE = 'app/(marketing)/national-show/faq/page.tsx';
const failures = [];
const src = readRepoFile(FILE);
const base = readBaseFile(FILE);
if (src === null) failures.push(`${FILE} is missing`);
else {
  // S1
  if (!/\.status\s*===\s*'confirmed'/.test(src)) failures.push("S1: the page does not test faq.status === 'confirmed'");
  if (!/wired\[\s*faq\._id\s*\]/.test(src)) failures.push('S1: the page does not test wired[faq._id] for the sourced rule');
  if (!/hideUnanswered\s*\|\|/.test(src) && !/!hideUnanswered\s*\|\|/.test(src)) failures.push('S1: the sourced rule must apply only when hideUnanswered (a preview build keeps every row)');
  // S2
  const ids = (s) => [...s.matchAll(/showFaq-[a-z0-9-]+/g)].map((m) => m[0]).sort();
  if (JSON.stringify(ids(src)) !== JSON.stringify(ids(base ?? ''))) failures.push(`S2: the showFaq- ids in the page changed (${ids(base ?? '')} -> ${ids(src)}): the public rule must read the data, not name rows`);
  // S3
  const lines = (src.match(/<ShowStatusLine\b/g) ?? []).length;
  if (lines !== 1) failures.push(`S3: expected exactly one <ShowStatusLine> in the page, found ${lines}`);
  if (/hideUnanswered\s*\?\s*null\s*:\s*\(\s*<ShowStatusLine/.test(src)) failures.push('S3: the gap line is still withheld in a public build');
  if (!/faqEntries\s*=\s*visibleFaqs/.test(src)) failures.push('S3: the FAQPage entries must still be derived from visibleFaqs');
  // S4
  if (/'use client'|"use client"/.test(src)) failures.push('S4: the FAQ page must stay a server component');
  // S5
  const added = base === null ? src.split('\n') : git('diff', '-U0', BASE, '--', FILE).split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1));
  for (const line of added) {
    const code = line.trim();
    if (code === '' || code.startsWith('//') || code.startsWith('*') || code.startsWith('/*') || code.startsWith('{/*')) continue;
    if (/#[0-9a-fA-F]{3,8}\b/.test(code) && !/&#/.test(code)) failures.push(`S5: hex colour in an added line: ${code}`);
    if (/font-family/.test(code)) failures.push(`S5: font-family in an added line: ${code}`);
    if (/\bTBC\b/.test(code)) failures.push(`S5: a TBC literal in an added line: ${code}`);
    if (/\.(create|createOrReplace|patch|delete|mutate|transaction)\(|createClient/.test(code)) failures.push(`S5: a Sanity write or client in an added line: ${code}`);
    if (/^import |className|from '/.test(code)) continue;
    for (const m of code.matchAll(/(['"`])([^'"`]*\s[^'"`]*\s[^'"`]*)\1/g)) if (/^(?:[A-Za-z.,'’-]+ ){2,}[A-Za-z.,'’-]+$/.test(m[2])) failures.push(`S5: new multi-word string literal ${JSON.stringify(m[2])} (no invention: every string comes from an existing source)`);
  }
}
// S7
const CSS = 'app/(marketing)/national-show/nos-structure.css';
const css = readRepoFile(CSS);
const cssBase = readBaseFile(CSS);
if (css === null || cssBase === null) failures.push(`S7: ${CSS} is missing`);
else {
  const r19 = css.indexOf('R19 status marker');
  const upper = css.match(/\.nos-theme \[data-confirmation-badge\],\s*\.nos-theme \[data-exhibitor-marker\]\s*\{[^}]*text-transform:\s*none[^}]*\}/g) ?? [];
  const track = css.match(/@layer base\s*\{\s*\.nos-theme \[data-confirmation-badge\],\s*\.nos-theme \[data-exhibitor-marker\]\s*\{[^}]*letter-spacing:\s*normal\s*!important[^}]*\}\s*\}/g) ?? [];
  if (upper.length !== 1 || track.length !== 1) failures.push(`S7: expected one text-transform:none rule and one @layer base letter-spacing:normal !important rule for [data-confirmation-badge] and [data-exhibitor-marker], found ${upper.length} and ${track.length}`);
  else if (css.indexOf(upper[0]) < r19) failures.push('S7: the sentence-case rule must come after the R19 block');
  if (/\.nos-faq-answer \[data-confirmation-badge\]/.test(css)) failures.push("S7: r57's .nos-faq-answer [data-confirmation-badge] rule is still there (redundant)");
  const count = (s, re) => (s.match(re) ?? []).length;
  if (count(css, /text-transform: uppercase;/g) !== count(cssBase, /text-transform: uppercase;/g)) failures.push('S7: an uppercase declaration was added or removed (the R19 block must stay as is)');
  if (count(css, /letter-spacing: 0\.14em;/g) !== count(cssBase, /letter-spacing: 0\.14em;/g)) failures.push('S7: the R19 letter-spacing declarations changed');
}
// S6
const doc = readRepoFile(DOC);
if (doc === null) failures.push(`S6: ${DOC} is missing`);
else for (const [re, what] of [[/r57b/, 'r57b'], [/confirmed/, 'confirmed'], [/status/, 'the showFaq status field'], [/O4/, 'O4'], [/JSON-LD/, 'JSON-LD'], [/ShowStatusLine/, 'ShowStatusLine'], [/owner/i, 'the owner flags'], [/Sanity/, 'Sanity'], [/wired/, 'wired'], [/sentence case/i, 'the sentence-case badge rule'], [/nos-structure/, 'nos-structure.css']]) if (!re.test(doc)) failures.push(`S6: ${DOC} does not mention ${what}`);
finish('static.mjs', failures, 'S1-S7 hold: a data-driven sourced rule, one existing gap line, JSON-LD from the shown rows, nothing invented.');
