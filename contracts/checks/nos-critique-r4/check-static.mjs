// nos-critique-r4 F1 — static source check for the R44-A3 FAQ category jump chips.
// Pins: one <nav aria-label="FAQ categories"> in ShowFaqList before the sections; chips derived from
// CATEGORY_ORDER / CATEGORY_LABELS (no second category list, no hard-coded label or href literal);
// stable h2 ids kept; scroll-margin on the h2; wrapping, 44px, theme focus ring, no scroller; NO filter
// field; no 'use client'; no new copy beyond the nav label; the per-answer ConfirmationBadge untouched;
// no new visual tokens; docs present.
//
// Run as: node contracts/checks/nos-critique-r4/check-static.mjs
import { DOC, LIST, NAV_LABEL, PAGE, copyStrings, finish, readBaseFile, readRepoFile, stripComments } from './_lib.mjs';

const NAME = 'check-static.mjs';
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

  if (!/motion-safe:transition-\[color\]/.test(nav)) fail('chip must transition only its text colour: motion-safe:transition-[color]');
  if (/(?<![\w-])transition-(colors|all)\b|(?<![\w-])transition(?![-\w])/.test(nav.replace(/motion-safe:transition-\[color\]/g, ''))) fail('chip must not use transition / transition-colors / transition-all: they animate outline-color and the focus ring fades in');

  // --- no filter, no client code, no smooth scroll ---
  if (/<input\b|<textarea\b|<select\b|type=["']search["']|role=["']search["']|<form\b|onChange|onInput|useState|useReducer|['"]use client['"]/.test(code)) fail('no filter field and no client state (R44-A3: NO filter) — the list stays a Server Component');
  if (/scroll-smooth|scrollIntoView|scroll-behavior|scrollTo\(/.test(code)) fail('no scripted or smooth scroll; native anchor jump only');

  // --- no new copy, per-answer badge untouched ---
  // copyStrings' JSX-text heuristic also catches code between `=>` and `<`; real copy has no `;` or `(`.
  const copyOf = (s) => copyStrings(s).filter((t) => !/[;()]/.test(t));
  const had = new Set(copyOf(base));
  const added = copyOf(src).filter((t) => !had.has(t) && t !== NAV_LABEL);
  if (added.length) fail(`new copy beyond the "${NAV_LABEL}" nav label: ${JSON.stringify(added)}`);
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

  // --- page route: no new copy, no new imports of components ---
  const pageNow = readRepoFile(PAGE);
  const pageBase = readBaseFile(PAGE);
  if (pageNow === null) fail(`${PAGE} missing`);
  else {
    const a = copyStrings(pageNow).join('|');
    const b = copyStrings(pageBase).join('|');
    if (a !== b) fail(`${PAGE} copy changed; R44-A3 adds no copy to the route`);
  }

  // --- docs ---
  const doc = readRepoFile(DOC);
  if (doc === null) fail(`${DOC} missing`);
  else {
    if (!/R44[- ]?A3/.test(doc)) fail(`${DOC} must cite R44-A3`);
    if (!/no filter/i.test(doc)) fail(`${DOC} must record the no-filter ruling`);
    if (!/R41/.test(doc)) fail(`${DOC} must note per-answer TBC stays R41`);
  }

  finish(NAME, failures, 'FAQ jump nav: single-source categories, stable ids, scroll-margin, wrapping 44px chips with theme focus ring, no filter, no client code, no new copy, badge untouched, docs present.');
}
