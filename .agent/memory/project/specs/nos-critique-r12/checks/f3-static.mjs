// nos-critique-r12 f3 static (QA input, hash-locked): the two not-founds and the missing-ticket branch.
//   S1  NOS: national-show/not-found.tsx's `metadata` sets title 'Page not found' (the F24 template adds the suffix) or { absolute: TITLE }, the
//       NOS lede as description, alternates without a canonical, and keeps R63 robots; outside that statement the file equals BASE.
//   S2  NOS catch-all national-show/[...slug]/page.tsx gains `generateMetadata` whose body is only notFound(), so the client payload carries the
//       not-found's metadata too (without it the hydrated head flips back to the doubled layout default and the 404 URL's canonical); the rest equals BASE.
//   S3  SAOC: app/not-found.tsx keeps its <section> byte-identical as the named export NotFoundSection, its default export wraps it in <main>,
//       and its metadata sets title 'Page not found', the SAOC lede, no canonical and robots noindex.
//   S4  app/(marketing)/not-found.tsx (new) renders NotFoundSection with no <main> (the marketing chrome already owns it) and re-exports that metadata,
//       so notFound() from a marketing page (tickets, societies, events) keeps one top-level <main>.
//   S5  tickets/[slug]/page.tsx: generateMetadata calls notFound() when the slug resolves no ticket type and no longer falls back to 'Tickets';
//       the shared _ticketpage.mjs guard holds.
//   S6  docs/nos-critique-r12.md records F3 and the canonical.
//   S7  (lead 2026-10-18, finding 2) societies/[slug], events/[slug] and national-show/archive/[year] call notFound() in generateMetadata when the
//       entity is missing, in place of their 'Society not found' / 'Event' / neutral-archive metadata; with comments and blank lines ignored, each file
//       equals BASE with exactly that change.
import { DOC, finish, readBaseFile, readRepoFile, stripComments } from './_lib.mjs';
import { LEDE, MARKETING_NOT_FOUND, NOS_CATCH_ALL, NOT_FOUND, SAOC_LEDE, SAOC_NOT_FOUND, TITLE } from './_f3.mjs';
import { TICKET_PAGE, generateMetadataOf, ticketPageFailures } from './_ticketpage.mjs';

const NAME = 'f3-static.mjs';
const failures = [];
const METADATA = /export const metadata: Metadata = \{[\s\S]*?\n?\};\n/;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const NO_CANONICAL = /alternates:\s*(?:null|\{\s*canonical:\s*null,?\s*\})/;
const ROBOTS = /robots:\s*\{\s*index:\s*false,\s*follow:\s*false,?\s*\}/;
const descriptionOf = (lede) => new RegExp(`description:\\s*'${esc(lede)}'`);

function pair(rel, tag) {
  const head = readRepoFile(rel);
  const base = readBaseFile(rel);
  if (head === null || base === null) failures.push(`${rel} is missing at HEAD or BASE (${tag})`);
  return [head, base];
}

// S1
{
  const [head, base] = pair(NOT_FOUND, 'S1');
  if (head !== null && base !== null) {
    const meta = stripComments(head).match(METADATA)?.[0] ?? '';
    if (!new RegExp(`title:\\s*(?:'Page not found'|\\{\\s*absolute:\\s*'${esc(TITLE)}',?\\s*\\})`).test(meta)) failures.push(`${NOT_FOUND}: metadata title must be 'Page not found' or { absolute: '${TITLE}' } (S1)`);
    if (!descriptionOf(LEDE).test(meta)) failures.push(`${NOT_FOUND}: metadata description must be '${LEDE}' (S1)`);
    if (!NO_CANONICAL.test(meta)) failures.push(`${NOT_FOUND}: metadata must drop the canonical (S1)`);
    if (!ROBOTS.test(meta)) failures.push(`${NOT_FOUND}: metadata must keep robots { index: false, follow: false } (S1)`);
    if (head.replace(METADATA, '') !== base.replace(METADATA, '')) failures.push(`${NOT_FOUND}: only the metadata statement may change (S1)`);
  }
}

// S2
{
  const [head, base] = pair(NOS_CATCH_ALL, 'S2');
  if (head !== null && base !== null) {
    const GM = /export (?:async )?function generateMetadata\(\)(?::\s*[\w<>]+)?\s*\{\s*notFound\(\);\s*\}\n\n?/;
    if (!GM.test(head)) failures.push(`${NOS_CATCH_ALL}: want \`export function generateMetadata(): never { notFound(); }\` (S2)`);
    if (head.replace(GM, '') !== base) failures.push(`${NOS_CATCH_ALL}: only generateMetadata may be added (S2)`);
  }
}

// S3
let saocMeta = '';
{
  const [head, base] = pair(SAOC_NOT_FOUND, 'S3');
  if (head !== null && base !== null) {
    const section = (s) => { const a = s.indexOf('<section'); const b = s.lastIndexOf('</section>'); return a < 0 || b < 0 ? null : s.slice(a, b + '</section>'.length); };
    if (section(head) === null || section(head) !== section(base)) failures.push(`${SAOC_NOT_FOUND}: the <section> must stay byte-identical to BASE (S3)`);
    const code = stripComments(head);
    if (!/export function NotFoundSection\(\)/.test(code)) failures.push(`${SAOC_NOT_FOUND}: the section must be the named export NotFoundSection (S3)`);
    if (!/export default function \w+\(\)\s*\{\s*return \(\s*<main>\s*<NotFoundSection \/>\s*<\/main>\s*\);\s*\}/.test(code)) failures.push(`${SAOC_NOT_FOUND}: the default export must return <main><NotFoundSection /></main> (S3)`);
    saocMeta = code.match(METADATA)?.[0] ?? '';
    if (!/title:\s*'Page not found'/.test(saocMeta)) failures.push(`${SAOC_NOT_FOUND}: metadata title must be 'Page not found' (S3)`);
    if (!new RegExp(`description:\\s*'${esc(SAOC_LEDE)}'`).test(saocMeta)) failures.push(`${SAOC_NOT_FOUND}: metadata description must be '${SAOC_LEDE}' (S3)`);
    if (!NO_CANONICAL.test(saocMeta)) failures.push(`${SAOC_NOT_FOUND}: metadata must drop the canonical (S3)`);
    if (!ROBOTS.test(saocMeta)) failures.push(`${SAOC_NOT_FOUND}: metadata must set robots { index: false, follow: false } (S3)`);
  }
}

// S4
{
  const src = readRepoFile(MARKETING_NOT_FOUND);
  if (src === null) failures.push(`${MARKETING_NOT_FOUND} is missing (S4)`);
  else {
    const code = stripComments(src);
    if (/<main\b/.test(code)) failures.push(`${MARKETING_NOT_FOUND}: must not render a <main> (S4)`);
    if (!/import \{ NotFoundSection \} from '(?:\.\.|@\/app)\/not-found';/.test(code) || !/<NotFoundSection \/>/.test(code)) failures.push(`${MARKETING_NOT_FOUND}: must render NotFoundSection from app/not-found.tsx (S4)`);
    if (!/export \{ metadata \} from '(?:\.\.|@\/app)\/not-found';/.test(code)) failures.push(`${MARKETING_NOT_FOUND}: must re-export app/not-found.tsx's metadata (S4)`);
  }
}

// S5
{
  const [head, base] = pair(TICKET_PAGE, 'S5');
  failures.push(...ticketPageFailures(head, base, 'S5'));
  if (head !== null) {
    const gm = stripComments(generateMetadataOf(head));
    if (!/if \(!ticketType\) notFound\(\);/.test(gm)) failures.push(`${TICKET_PAGE}: generateMetadata must call notFound() when no ticket type resolves (S5)`);
    if (/'Tickets'/.test(gm)) failures.push(`${TICKET_PAGE}: generateMetadata must not fall back to the 'Tickets' title (S5)`);
  }
}

// S6
const doc = readRepoFile(DOC);
if (doc === null || !/\bF3\b/.test(doc) || !/canonical/i.test(doc)) failures.push(`${DOC} must record F3 and the canonical (S6)`);

// S7
const squash = (src) => stripComments(src).split('\n').filter((l) => l.trim()).join('\n');
const DYNAMIC = [
  ['app/(marketing)/societies/[slug]/page.tsx', "  if (!society) return { title: 'Society not found' };\n", '  if (!society) notFound();\n'],
  ['app/(marketing)/events/[slug]/page.tsx', "  const title = event?.title ?? 'Event';\n  const description = event?.description ?? undefined;\n", '  if (!event) notFound();\n  const title = event.title;\n  const description = event.description ?? undefined;\n'],
  ['app/(marketing)/national-show/archive/[year]/page.tsx', /  if \(!show\) \{\n    return buildPageMetadata\(\{\n[\s\S]*?\n    \}\);\n  \}\n/, '  if (!show) notFound();\n'],
];
for (const [rel, from, to] of DYNAMIC) {
  const [head, base] = pair(rel, 'S7');
  if (head === null || base === null) continue;
  const hits = typeof from === 'string' ? base.split(from).length - 1 : (base.match(new RegExp(from.source, 'g')) ?? []).length;
  if (hits !== 1) { failures.push(`${rel}: BASE does not hold exactly one not-found metadata branch; BASE is not the audited 26fde668 (S7)`); continue; }
  if (squash(head) !== squash(base.replace(from, to))) failures.push(`${rel}: generateMetadata must call notFound() for a missing entity, and nothing else may change (comments aside) (S7)`);
}

finish(NAME, failures, 'NOS and SAOC not-founds carry one-suffix titles, their own ledes, no canonical and noindex; the SAOC section is unchanged inside <main>; the marketing not-found and the missing-ticket branch use it; docs record F3.');
