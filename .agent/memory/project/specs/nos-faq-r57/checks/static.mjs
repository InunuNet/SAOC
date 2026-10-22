// nos-faq-r57 static: source-level guards for the FAQ / what-to-expect wiring. QA input, hash-locked. Each failure names its rule.
//   S1  AdmissionPriceList.tsx: a server component, one <ul data-admission-prices> of fanLinkLabel() items over TICKET_FAN_ORDER, no price or string literal of its own.
//   S2  faq/page.tsx wires the cost row (showFaq-tickets-1) from loadTicketCardViewModels + AdmissionPriceList and the venue row (showFaq-getting-there-3)
//       from the show's venue name, only when confirmations.venue is confirmed; it passes `wired` to ShowFaqList.
//   S3  ShowFaqList.tsx: native details/summary kept, no marker inside <summary>, the marker in the answer panel, a data-faq-wired hook, still a server component.
//   S4  what-to-expect/page.tsx: Admission built from AdmissionPriceList and the Tickets link; the Sanity admissionNote is no longer the Admission body.
//   S5  nos-structure.css: one added sentence-case rule scoped to .nos-faq-answer; the R19 uppercase block untouched.
//   S6  No invention: added lines carry no hex colour, font-family, TBC literal, Sanity write call or new multi-word string literal.
//   S7  docs/nos-faq-r57.md records the audit, the two wired rows, the venue confirmation and the owner flags.
import { finish, git, goldenJson, readBaseFile, readRepoFile, BASE, DOC } from './_lib.mjs';

const G = goldenJson('edits.json');

const failures = [];
const FILES = {
  list: 'components/show/AdmissionPriceList.tsx',
  faqPage: 'app/(marketing)/national-show/faq/page.tsx',
  faqList: 'components/show/ShowFaqList.tsx',
  wte: 'app/(marketing)/national-show/what-to-expect/page.tsx',
  css: 'app/(marketing)/national-show/nos-structure.css',
};
const text = Object.fromEntries(Object.entries(FILES).map(([k, rel]) => [k, readRepoFile(rel)]));
for (const [k, v] of Object.entries(text)) if (v === null) failures.push(`${FILES[k]} is missing`);
const has = (k, re, msg) => { if (text[k] !== null && !re.test(text[k])) failures.push(msg); };
const lacks = (k, re, msg) => { if (text[k] !== null && re.test(text[k])) failures.push(msg); };

// S1
has('list', /data-admission-prices/, 'S1: AdmissionPriceList has no data-admission-prices hook');
has('list', /fanLinkLabel/, 'S1: AdmissionPriceList must label items with fanLinkLabel (the hub fan\'s own wording)');
has('list', /TICKET_FAN_ORDER/, 'S1: AdmissionPriceList must iterate TICKET_FAN_ORDER');
lacks('list', /'use client'|"use client"/, 'S1: AdmissionPriceList must stay a server component');
lacks('list', /\bR\s?\d{2,}/, 'S1: AdmissionPriceList carries a literal price');
// S2
has('faqPage', /loadTicketCardViewModels/, 'S2: faq/page.tsx must read the cards through loadTicketCardViewModels (the hub\'s loader)');
has('faqPage', /AdmissionPriceList/, 'S2: faq/page.tsx must render AdmissionPriceList');
has('faqPage', /showFaq-tickets-1/, 'S2: the cost row id showFaq-tickets-1 is not wired');
has('faqPage', /showFaq-getting-there-3/, 'S2: the venue row id showFaq-getting-there-3 is not wired');
has('faqPage', /confirmations\??\.venue/, 'S2: the venue row must be gated on info.confirmations.venue');
has('faqPage', /venue\??\.name/, 'S2: the venue row must read the show\'s venue.name (the fact strip\'s source)');
has('faqPage', /wired=/, 'S2: faq/page.tsx must pass `wired` to ShowFaqList');
// S3
if (text.faqList !== null) {
  const summaries = [...text.faqList.matchAll(/<summary\s+data-faq-summary[\s\S]*?<\/summary>/g)].map((m) => m[0]);
  if (summaries.length !== 1) failures.push(`S3: expected one <summary> block in ShowFaqList, found ${summaries.length}`);
  else if (/ConfirmationBadge/.test(summaries[0])) failures.push('S3: ConfirmationBadge is still inside <summary>');
  const panel = text.faqList.match(/className="nos-faq-answer"[\s\S]*?<\/details>/);
  if (!panel || !/ConfirmationBadge/.test(panel[0])) failures.push('S3: the marker is not inside the .nos-faq-answer panel');
  if (!/<details/.test(text.faqList) || !/<summary/.test(text.faqList)) failures.push('S3: ShowFaqList is no longer native details/summary');
}
has('faqList', /data-faq-wired/, 'S3: ShowFaqList has no data-faq-wired hook');
lacks('faqList', /'use client'|"use client"/, 'S3: ShowFaqList must stay a server component');
// S4
has('wte', /AdmissionPriceList/, 'S4: what-to-expect must render AdmissionPriceList');
has('wte', /loadTicketCardViewModels/, 'S4: what-to-expect must read the cards through loadTicketCardViewModels');
lacks('wte', /body=\{admissionNote\}/, 'S4: the Sanity admissionNote must no longer be the Admission body');
has('wte', /\/national-show\/tickets/, 'S4: the Tickets link is gone');
// S5
if (text.css !== null) {
  if (!/\.nos-theme \.nos-faq-answer \[data-confirmation-badge\]\s*\{[^}]*text-transform:\s*none[^}]*\}/.test(text.css) || !/\.nos-faq-answer \[data-confirmation-badge\]\s*\{[^}]*letter-spacing:\s*normal/.test(text.css)) failures.push('S5: nos-structure.css has no .nos-theme .nos-faq-answer [data-confirmation-badge] rule with text-transform none and letter-spacing normal');
  const base = readBaseFile(FILES.css) ?? '';
  const count = (s, re) => (s.match(re) ?? []).length;
  if (count(text.css, /text-transform: uppercase;/g) !== count(base, /text-transform: uppercase;/g)) failures.push('S5: an uppercase declaration was added or removed (the R19 block must stay as is)');
  if (count(text.css, /letter-spacing: 0\.14em;/g) !== count(base, /letter-spacing: 0\.14em;/g)) failures.push('S5: the R19 letter-spacing declarations changed');
}
// S6
const added = [];
for (const rel of Object.values(FILES)) {
  if (text[Object.keys(FILES).find((k) => FILES[k] === rel)] === null) continue;
  const base = readBaseFile(rel);
  if (base === null) { added.push(...readRepoFile(rel).split('\n').map((l) => [rel, l])); continue; }
  for (const line of git('diff', '-U0', BASE, '--', rel).split('\n')) if (line.startsWith('+') && !line.startsWith('+++')) added.push([rel, line.slice(1)]);
}
for (const [rel, line] of added) {
  const code = line.trim();
  if (code === '' || code.startsWith('//') || code.startsWith('*') || code.startsWith('/*') || code.startsWith('{/*')) continue;
  if (/#[0-9a-fA-F]{3,8}\b/.test(code) && !/&#/.test(code)) failures.push(`S6: ${rel}: hex colour in an added line: ${code}`);
  if (/font-family/.test(code)) failures.push(`S6: ${rel}: font-family in an added line: ${code}`);
  if (/\bTBC\b/.test(code)) failures.push(`S6: ${rel}: a TBC literal in an added line: ${code}`);
  if (/\.(create|createOrReplace|patch|delete|mutate|transaction)\(|createClient/.test(code)) failures.push(`S6: ${rel}: a Sanity write or client in an added line: ${code}`);
  if (/^import |className|from '/.test(code)) continue;
  for (const m of code.matchAll(/(['"`])([^'"`]*\s[^'"`]*\s[^'"`]*)\1/g)) if (m[2] !== G.linkLabel && /^(?:[A-Za-z.,'\u2019-]+ ){2,}[A-Za-z.,'\u2019-]+$/.test(m[2])) failures.push(`S6: ${rel}: new multi-word string literal ${JSON.stringify(m[2])} (no invention: every string comes from an existing source)`);
}
// S7
const doc = readRepoFile(DOC);
if (doc === null) failures.push(`S7: ${DOC} is missing`);
else for (const [re, what] of [[/r57/, 'r57'], [/TICKET_PRODUCTS/, 'TICKET_PRODUCTS'], [/confirmations\.venue/, 'confirmations.venue'], [/showFaq-tickets-1/, 'the cost row id'], [/showFaq-getting-there-3/, 'the venue row id'], [/owner/i, 'the owner flags'], [/Admission/, 'Admission'], [/Sanity/, 'Sanity']]) if (!re.test(doc)) failures.push(`S7: ${DOC} does not mention ${what}`);
finish('static.mjs', failures, 'S1-S7 hold: wired from the hub\'s loader and the fact strip\'s venue, marker out of the summary, nothing invented.');
