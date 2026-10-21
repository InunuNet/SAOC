// nos-critique-r12 f4 static (QA input, hash-locked): unique descriptions through F24's machinery only.
//   S1  each SAOC target page (_f4.mjs) imports buildPageMetadata from '@/lib/seo' and its metadata is
//       `buildPageMetadata({ ... })` with its BASE title and its own path; every string literal of 20+ chars in the file already
//       exists as text in the BASE file (no new copy); at most 16 changed lines.
//   S2  /societies (left at default, no source) is byte-identical to BASE.
//   S3  tickets/[slug]/page.tsx: generateMetadata keeps F3's notFound() branch and returns buildPageMetadata with the ticket type's
//       name as title, its description (the standfirst the hero renders) as description and lede, and path `/tickets/${slug}`, with the
//       title overridden to { absolute: `${ticketType.name}${NOS_TITLE_SUFFIX}` } (a ticket is a NOS page, R62 #1; /tickets/* sits outside
//       national-show/layout.tsx's template); the module adds `const NOS_TITLE_SUFFIX = ' — National Orchid Show | SAOC';`. The shared guard holds.
//   S4  docs/nos-critique-r12.md records F4 and the per-route sources.
//   S6  /national-show/symposium equals BASE except its one metadata description line, which becomes a single-quoted literal ending in '…'
//       (the ruled word-boundary cut; f4-rendered proves it is the cut of the rendered lede).
//   S5  Codi R64 casing: what-to-expect, plan-your-visit and national-show/sponsors each equal BASE with exactly their title and og image
//       line recased to the h1 ('What to expect', 'Plan your visit', 'Sponsors').
import { BASE, DOC, finish, git, readBaseFile, readRepoFile, stripComments } from './_lib.mjs';
import { CASING, LEFT_AT_DEFAULT, SAOC_TARGETS, SYMPOSIUM, casingEdit } from './_f4.mjs';
import { NOS_SUFFIX_CONST, SEO_IMPORT, TICKET_PAGE, generateMetadataOf, ticketPageFailures } from './_ticketpage.mjs';

const NAME = 'f4-static.mjs';
const failures = [];
const MAX_PAGE_LINES = 16;
const MIN_LITERAL = 20;
const norm = (t) => t.replace(/\s+/g, ' ').trim();
// BASE text as a reader sees it: tags and {' '} spacers removed, entities for the apostrophes resolved.
const textOf = (src) => norm(src.replace(/\{' '\}/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&rsquo;/g, '’').replace(/&apos;|&#39;/g, "'"));

function numstat(rel) {
  const line = git('diff', '--numstat', BASE, '--', rel).trim();
  if (!line) return 0;
  const [a, d] = line.split('\t');
  return Number(a) + Number(d);
}

// S1
for (const { route, file } of SAOC_TARGETS) {
  const head = readRepoFile(file);
  const base = readBaseFile(file);
  if (head === null || base === null) { failures.push(`${file} is missing at HEAD or BASE (S1)`); continue; }
  const code = stripComments(head);
  const baseTitle = base.match(/export const metadata: Metadata = \{ title: '([^']+)' \};/)?.[1];
  if (!baseTitle) { failures.push(`${file}: BASE metadata title not found (S1)`); continue; }
  if (!code.includes(SEO_IMPORT)) failures.push(`${file}: must import buildPageMetadata from '@/lib/seo' (S1)`);
  const meta = code.match(/export const metadata: Metadata = buildPageMetadata\(\{[\s\S]*?\}\);/)?.[0] ?? '';
  if (!meta) failures.push(`${file}: metadata must be buildPageMetadata({ ... }) (S1)`);
  else {
    if (!meta.includes(`title: '${baseTitle}'`)) failures.push(`${file}: buildPageMetadata title must stay '${baseTitle}' (S1)`);
    if (!meta.includes(`path: '${route}'`)) failures.push(`${file}: buildPageMetadata path must be '${route}' (S1)`);
    if (!/\bdescription:/.test(meta)) failures.push(`${file}: buildPageMetadata needs a description (S1)`);
  }
  const baseText = textOf(stripComments(base));
  const baseSource = norm(base);
  for (const m of code.matchAll(/'((?:[^'\\\n]|\\.){20,})'|"((?:[^"\\\n]|\\.){20,})"/g)) {
    const lit = norm((m[1] ?? m[2]).replace(/\\'/g, "'"));
    if (lit.length >= MIN_LITERAL && !baseText.includes(lit) && !baseSource.includes(lit)) failures.push(`${file}: string "${lit.slice(0, 60)}" is not text of the BASE page (NO INVENTION) (S1)`);
  }
  const n = numstat(file);
  if (n > MAX_PAGE_LINES) failures.push(`${file}: ${n} changed lines against BASE, want at most ${MAX_PAGE_LINES} (S1)`);
}

// S2
for (const { file } of LEFT_AT_DEFAULT) if (readRepoFile(file) !== readBaseFile(file)) failures.push(`${file} is left at the site default (no source) and must equal BASE (S2)`);

// S3
{
  const head = readRepoFile(TICKET_PAGE);
  failures.push(...ticketPageFailures(head, readBaseFile(TICKET_PAGE), 'S3'));
  if (head !== null) {
    const gm = norm(stripComments(generateMetadataOf(head)));
    if (!gm.includes('if (!ticketType) notFound();')) failures.push(`${TICKET_PAGE}: generateMetadata must keep F3's notFound() branch (S3)`);
    if (!head.includes(SEO_IMPORT)) failures.push(`${TICKET_PAGE}: must import buildPageMetadata from '@/lib/seo' (S3)`);
    if (!head.includes(`\n${NOS_SUFFIX_CONST}\n`)) failures.push(`${TICKET_PAGE}: must declare ${NOS_SUFFIX_CONST} (S3)`);
    for (const want of ['...buildPageMetadata({', 'title: ticketType.name,', 'description: ticketType.description,', 'lede: ticketType.description,', 'path: `/tickets/${slug}`', 'title: { absolute: `${ticketType.name}${NOS_TITLE_SUFFIX}` }']) {
      if (!gm.includes(want)) failures.push(`${TICKET_PAGE}: generateMetadata lacks \`${want}\` (S3)`);
    }
  }
}

// S5
for (const c of CASING) {
  const head = readRepoFile(c.file);
  const base = readBaseFile(c.file);
  const [from, to] = casingEdit(c);
  if (head === null || base === null) { failures.push(`${c.file} is missing at HEAD or BASE (S5)`); continue; }
  if (base.split(from).length !== 2) { failures.push(`${c.file}: BASE does not hold exactly one ${JSON.stringify(from.trim())}; BASE is not the audited 26fde668 (S5)`); continue; }
  if (head !== base.replace(from, to)) failures.push(`${c.file} must equal BASE with only the title and og image recased '${c.from}' -> '${c.to}' (Codi R64) (S5)`);
}

// S6
{
  const head = readRepoFile(SYMPOSIUM.file);
  const base = readBaseFile(SYMPOSIUM.file);
  const OLD = "  description: 'This page is the programme and registration hub for the SAOC Symposium.',\n";
  if (head === null || base === null || base.split(OLD).length !== 2) failures.push(`${SYMPOSIUM.file}: missing, or BASE is not the audited 26fde668 (S6)`);
  else {
    const [pre, post] = base.split(OLD);
    const mid = head.startsWith(pre) && head.endsWith(post) ? head.slice(pre.length, head.length - post.length) : null;
    if (mid === null || !/^  description: '[^'\n]+…',\n$/.test(mid)) failures.push(`${SYMPOSIUM.file} must equal BASE except its description line, which becomes one single-quoted literal ending in '…' (S6)`);
  }
}

// S4
const doc = readRepoFile(DOC);
if (doc === null || !/\bF4\b/.test(doc) || !/description/i.test(doc)) failures.push(`${DOC} must record F4 and the description sources (S4)`);

finish(NAME, failures, 'five SAOC pages and the ticket pages take their description through buildPageMetadata from existing page text, tickets wear the NOS title template, three NOS titles follow their h1 casing, /societies stays at the default, docs record F4.');
