// nos-critique-r5 F2 — static source check for R52, the restyle of the r4 FAQ category jump chips.
// Ported from nos-critique-r4/check-static.mjs (labelled nav, single-source categories, stable ids,
// scroll-margin, wrap, 44px, theme focus ring, no filter, no client code, badge untouched). R52 SUPERSEDES
// the r4 chip-fill pins: the r4 rest fill `bg-bone`, text `text-primary` and `hover:text-accent` are
// replaced by a 1px --primary border, transparent rest fill, ink text, bone only on hover and
// focus-visible, 14px sentence case, Karla 600-700, tracking 0. R44-A3 stays: copy, ids, targets, ring.
//
// Run as: node contracts/checks/nos-critique-r5/check-static-f2.mjs
import { DOC, LIST, NAV_LABEL, copyStrings, finish, readBaseFile, readRepoFile, stripComments } from './_lib.mjs';

const NAME = 'check-static-f2.mjs';
const failures = [];
const fail = (m) => failures.push(m);

const src = readRepoFile(LIST);
const base = readBaseFile(LIST);
if (src === null) {
  finish(NAME, [`${LIST} missing`]);
} else {
  const code = stripComments(src);

  // --- the nav ---
  const navs = code.match(/<nav\b[^>]*>/g) ?? [];
  if (navs.length !== 1) fail(`want exactly one <nav> in ${LIST}, found ${navs.length}`);
  else if (!navs[0].includes(`aria-label="${NAV_LABEL}"`)) fail(`the <nav> must carry aria-label="${NAV_LABEL}" (neutral structural label, no new marketing copy)`);
  const navStart = code.indexOf('<nav');
  const navEnd = code.indexOf('</nav>');
  const nav = navStart >= 0 && navEnd > navStart ? code.slice(navStart, navEnd) : '';
  const firstSection = code.indexOf('<section');
  if (navStart < 0 || firstSection < 0 || navStart > firstSection) fail('the <nav> must come before the first <section> in source order');
  if (nav && !/<a\b|<Link\b/.test(nav)) fail('nav must render in-page links (<a> or <Link>)');
  if (nav && !/href=\{[^}]*#/.test(nav)) fail('nav hrefs must be built as an in-page "#<id>" expression');
  if (/href=["']#/.test(nav) || /["'`]#faq-[a-z-]/.test(nav)) fail('nav hrefs must not hard-code a category id; derive from the category key');
  if (nav && !/CATEGORY_LABELS\[/.test(nav)) fail('chip text must come from CATEGORY_LABELS[...]');
  if (nav && !/\.map\(/.test(nav)) fail('chips must be rendered by mapping the categories, not listed by hand');

  // --- categories stay single-source ---
  for (const label of ['Getting there', 'Tickets', 'Accessibility', 'Plant sales', 'General']) {
    const n = (code.match(new RegExp(`['"\`]${label}['"\`]`, 'g')) ?? []).length;
    if (n !== 1) fail(`label "${label}" must appear once (in CATEGORY_LABELS), found ${n}`);
  }
  const orderDefs = (code.match(/\[\s*'getting-there'/g) ?? []).length;
  if (orderDefs !== 1) fail(`CATEGORY_ORDER must remain the only category list, found ${orderDefs} array literals starting 'getting-there'`);
  const orderLit = code.match(/CATEGORY_ORDER = \[([^\]]*)\]/)?.[1] ?? '';
  if (orderLit.replace(/\s/g, '') !== "'getting-there','tickets','accessibility','plant-sales','general'") fail('CATEGORY_ORDER must keep its five keys in the existing order');

  // --- stable ids + scroll margin on the heading ---
  if (!/id=\{`faq-\$\{[^}]+\}`\}/.test(code)) fail('section heading must keep its stable id `faq-${...}`');
  if (!/aria-labelledby=\{`faq-\$\{[^}]+\}`\}/.test(code)) fail('section must keep aria-labelledby={`faq-${...}`}');
  const h2 = code.match(/<h2\b[\s\S]*?>/)?.[0] ?? '';
  if (!/\bscroll-mt-\[62px\]/.test(h2)) fail('h2 must carry scroll-mt-[62px] (sticky header 62px at 375)');
  if (!/\b(md|lg|sm):scroll-mt-\[74px\]/.test(h2)) fail('h2 must carry <breakpoint>:scroll-mt-[74px] (sticky header 74px at 768+)');

  // --- chip classes ---
  if (!/\bflex-wrap\b/.test(nav)) fail('chip set must wrap (flex-wrap)');
  if (/overflow-x-(auto|scroll)|\bflex-nowrap\b|\bsnap-x\b|\bwhitespace-nowrap\b/.test(nav)) fail('chip set must not be a horizontal scroller (R44-A4: no overflow-x, flex-nowrap, snap-x)');
  if (!/min-h-\[44px\]/.test(nav)) fail('each chip needs min-h-[44px]');
  if (!/focus-visible:outline-\[var\(--ring-focus\)\]/.test(nav)) fail('chip needs the theme focus ring focus-visible:outline-[var(--ring-focus)] (R9/3)');
  if (!/focus-visible:outline-2\b/.test(nav) || !/focus-visible:outline-offset-2\b/.test(nav)) fail('chip focus ring must match the theme: outline-2 + outline-offset-2');
  if (/focus:outline-none|outline-none/.test(nav.replace(/focus-visible:outline-none/g, 'x')) ) fail('chip must not remove its outline');

  // --- R52 chip style (supersedes the r4 fill/text/hover pins) ---
  const chip = nav.match(/<a\b[\s\S]*?className="([^"]*)"/)?.[1] ?? '';
  const toks = chip.split(/\s+/).filter(Boolean);
  const has = (t) => toks.includes(t);
  if (!chip) fail('could not find the chip <a className="…">');
  if (!has('border-[length:var(--border-primary)]') || !has('border-primary')) fail('R52: chip needs the 1px primary (royal) border: border-[length:var(--border-primary)] border-primary');
  if (!has('bg-transparent')) fail('R52: chip rest fill must be bg-transparent');
  if (toks.some((t) => /^(bg-bone|bg-primary|bg-accent|bg-parchment|bg-rule)/.test(t))) fail('R52 supersedes r4: the chip must not carry a rest fill (bg-bone only as hover:/focus-visible:)');
  if (!has('hover:bg-bone')) fail('R52: bone fill on hover: hover:bg-bone');
  if (!has('focus-visible:bg-bone')) fail('R52: bone fill on focus-visible: focus-visible:bg-bone');
  if (!has('text-ink')) fail('R52: chip text must be ink: text-ink');
  if (toks.some((t) => /^(text-primary|text-accent|text-muted|hover:text-|focus-visible:text-)/.test(t))) fail('R52 supersedes r4: no text-primary / hover:text-accent; the text stays ink in every state');
  if (!has('text-[14px]')) fail('R52 (ratified type): 14px');
  if (!has('font-semibold') && !has('font-bold')) fail('R52 (ratified type): Karla 600-700 (font-semibold or font-bold)');
  if (!has('tracking-normal')) fail('R52 (R35: tracking follows case): sentence case takes tracking 0, pin tracking-normal');
  if (toks.some((t) => /^(uppercase|lowercase|capitalize|tracking-(?!normal$))/.test(t))) fail('R52: sentence case, no case transform, no tracking other than 0');
  if (toks.some((t) => /^(hover:|focus-visible:|group-)?(shadow|underline)/.test(t)) || /\bhover:(scale|-translate|translate)/.test(chip)) fail('R52: no shadow, underline or movement on the chip');
  const tr = chip.match(/motion-safe:transition-\[([^\]]+)\]/);
  if (!tr) fail('chip must keep a motion-safe:transition-[…] with an explicit property list');
  else if (!tr[1].split(',').every((p) => p === 'color' || p === 'background-color')) fail(`chip may transition only color and/or background-color (never outline-color, border-color, all); found ${tr[1]}`);
  if (/(?<![\w-])transition-(colors|all|none)\b|(?<![\w-])transition(?![-\w\[])/.test(chip.replace(/motion-safe:transition-\[[^\]]+\]/g, ''))) fail('chip must not use bare transition / transition-colors / transition-all: they animate outline-color and the focus ring fades in');
  if (!toks.includes('rounded-[length:var(--radius-pill)]')) fail('chip keeps the pill radius token rounded-[length:var(--radius-pill)]');

  // --- no filter, no client code, no smooth scroll ---
  if (/<input\b|<textarea\b|<select\b|type=["']search["']|role=["']search["']|<form\b|onChange|onInput|useState|useReducer|['"]use client['"]/.test(code)) fail('no filter field and no client state (R44-A3: NO filter) — the list stays a Server Component');
  if (/scroll-smooth|scrollIntoView|scroll-behavior|scrollTo\(/.test(code)) fail('no scripted or smooth scroll; native anchor jump only');

  // --- no new copy, per-answer badge untouched ---
  // copyStrings' JSX-text heuristic also catches code between `=>` and `<`; real copy has no `;` or `(`.
  const copyOf = (s) => copyStrings(s).filter((t) => !/[;()]/.test(t));
  const had = new Set(copyOf(base));
  const added = copyOf(src).filter((t) => !had.has(t));
  if (added.length) fail(`new copy (R52 is a style change): ${JSON.stringify(added)}`);
  const hasNow = new Set(copyOf(src));
  const removed = [...had].filter((t) => !hasNow.has(t));
  if (removed.length) fail(`existing copy removed: ${JSON.stringify(removed)}`);
  const badge = (s) => (stripComments(s).match(/<ConfirmationBadge[\s\S]*?\/>/)?.[0] ?? '').replace(/\s+/g, ' ');
  if (!badge(src) || badge(src) !== badge(base)) fail('the per-answer <ConfirmationBadge …/> must be byte-identical (R41 is a data fix, out of scope)');
  if (!/import \{ ConfirmationBadge \} from '\.\/ConfirmationBadge';/.test(code)) fail('ConfirmationBadge import must remain');

  // --- no new visual tokens in added lines ---
  const baseLines = new Set(base.split('\n').map((l) => l.trim()));
  const addedLines = src.split('\n').filter((l) => !baseLines.has(l.trim())).join('\n');
  if (/#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|\brgba?\(|\bhsla?\(|\bshadow-|\bbg-gradient|\btext-\[#/.test(stripComments(addedLines))) fail('added lines introduce a literal colour, shadow or gradient; reuse existing theme tokens only');

  // --- docs ---
  const doc = readRepoFile(DOC);
  if (doc === null) fail(`${DOC} missing`);
  else {
    if (!/R52/.test(doc)) fail(`${DOC} must cite R52`);
    if (!/--primary|royal/i.test(doc) || !/bone/i.test(doc)) fail(`${DOC} must name the tokens used (--primary royal border, bone hover/focus fill)`);
  }

  finish(NAME, failures, 'R52 chips: 1px --primary border, transparent rest, ink text, bone on hover/focus-visible, 14px sentence case Karla 600-700 tracking 0, transitions limited to colour/background, 44px + ring + wrap kept, no copy change, badge untouched, docs present.');
}
