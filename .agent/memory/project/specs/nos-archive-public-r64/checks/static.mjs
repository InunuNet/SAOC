// nos-archive-public-r64 static: source-level guards. QA input, hash-locked. Each failure names its rule.
//   S1  lib/data/past-shows.ts is pure (no next/*, no sanity client, no process.env) and exports PAST_SHOWS_HREF, hasPastShowRecords, navWithoutHref.
//   S2  lib/data/past-shows-public.ts decides from existing data: pastShowsQuery + hasPastShowRecords + withholdPlaceholderProse; no new flag or env var.
//   S3  archive/page.tsx (page and generateMetadata) and archive/[year]/page.tsx call notFound() behind the shared predicate; no static metadata on the archive page.
//   S4  every linking surface follows the predicate: app/(marketing)/layout.tsx (Header + NosHeader nav), national-show/layout.tsx (breadcrumb labels),
//       NosHero (sub-nav), NosShowIndex, the hub page (Planning a visit card), sitemap.ts.
//   S5  P3: one noun. 'Past shows' is the H1, the title and the og text; none of the old nouns is left in the archive pages.
//   S6  No invention and no writes: added lines carry no hex colour, font-family, Sanity/Firestore write, process.env, or new multi-word string literal.
//   S7  docs/nos-archive-public-r64.md records the rule, its evidence, the surfaces and the owner flags.
import { BASE, DOC, finish, git, readBaseFile, readRepoFile } from './_lib.mjs';

const failures = [];
const need = (cond, msg) => { if (!cond) failures.push(msg); };
const read = (rel) => { const s = readRepoFile(rel); if (s === null) failures.push(`${rel} is missing`); return s ?? ''; };

const PURE = 'lib/data/past-shows.ts';
const PUB = 'lib/data/past-shows-public.ts';
const ARCH = 'app/(marketing)/national-show/archive/page.tsx';
const YEAR = 'app/(marketing)/national-show/archive/[year]/page.tsx';

// S1
const pure = read(PURE);
need(/export const PAST_SHOWS_HREF\s*=\s*'\/national-show\/archive'/.test(pure), 'S1: PAST_SHOWS_HREF = \'/national-show/archive\' is not exported');
need(/export function hasPastShowRecords\b/.test(pure), 'S1: hasPastShowRecords is not exported');
need(/export function navWithoutHref\b/.test(pure), 'S1: navWithoutHref is not exported');
for (const m of pure.matchAll(/^\s*import[^;]*from\s*'([^']+)'/gm)) {
  if (/^(next\b|@\/sanity|@\/lib\/firebase)/.test(m[1])) failures.push(`S1: ${PURE} imports ${m[1]}; it must stay pure so unit.mjs can load it`);
}
need(!/process\.env/.test(pure), `S1: ${PURE} reads process.env`);
need(/mergePastShows/.test(pure), 'S1: the predicate must read the same merged record set the archive pages render (mergePastShows)');

// S2
const pub = read(PUB);
need(/export (async )?function showPastShowsRoute\b/.test(pub), 'S2: showPastShowsRoute is not exported');
need(/export (async )?function getVisibleNav\b/.test(pub), 'S2: getVisibleNav is not exported');
need(/pastShowsQuery/.test(pub) && /hasPastShowRecords\(/.test(pub), 'S2: the route flag must come from pastShowsQuery through hasPastShowRecords');
need(/withholdPlaceholderProse\(/.test(pub), 'S2: the public/preview switch must be withholdPlaceholderProse()');
need(!/process\.env/.test(pub), 'S2: no new env var or flag');

// S3
const arch = read(ARCH);
const year = read(YEAR);
need(/showPastShowsRoute\(/.test(arch) && /notFound\(/.test(arch), 'S3: archive/page.tsx must call notFound() when !showPastShowsRoute()');
need(/export async function generateMetadata\b[\s\S]*?showPastShowsRoute\(/.test(arch), 'S3: archive/page.tsx must decide in generateMetadata too, so the 404 head carries no canonical or og:url of the withheld route');
need(!/export const metadata\b/.test(arch), 'S3: archive/page.tsx must not keep a static metadata export (it would put a canonical on the 404)');
need(/showPastShowsRoute\(/.test(year), 'S3: archive/[year]/page.tsx must consult showPastShowsRoute() (a hidden route has no year pages)');

// S4
const surfaces = {
  'app/(marketing)/layout.tsx': /getVisibleNav\(/,
  'app/(marketing)/national-show/layout.tsx': /getVisibleNav\(/,
  'components/nos/NosHero.tsx': /(getVisibleNav|showPastShowsRoute)\(/,
  'components/nos/NosShowIndex.tsx': /showPastShowsRoute\(/,
  'app/(marketing)/national-show/page.tsx': /showPastShowsRoute\(/,
  'app/sitemap.ts': /(showPastShowsRoute|hasPastShowRecords)\(/,
};
for (const [rel, re] of Object.entries(surfaces)) need(re.test(read(rel)), `S4: ${rel} does not follow the shared predicate`);
need(/\bnav\b/.test(read('components/chrome/Header.tsx')) && /nav\??:/.test(read('components/chrome/Header.tsx')), 'S4: Header must take a nav prop (the filtered nav) instead of reading NAV directly');
need(/nav\??:/.test(read('components/nos-chrome/NosHeader.tsx')), 'S4: NosHeader must take a nav prop (the filtered nav)');
need(/nav=\{nav\}/.test(read('components/chrome/Header.tsx')), 'S4: Header must pass the filtered nav to MobileMenu (nav={nav})');
need(!/\bNAV\.(map|find)\(/.test(read('components/nos-chrome/NosHeader.tsx')) && !/\bNAV\.map\(/.test(read('components/chrome/Header.tsx')), 'S4: NosHeader and Header must render the nav prop, not the static NAV');

// S5
need(/title="Past shows"/.test(arch), 'S5: the archive H1 must be "Past shows"');
need(/title:\s*'Past shows'/.test(arch), "S5: the archive metadata title must be 'Past shows'");
need(/nosOgImage\('Past shows'\)/.test(arch), "S5: the archive og image text must be 'Past shows'");
for (const [name, src] of [['archive/page.tsx', arch], ['archive/[year]/page.tsx', year]]) {
  for (const old of ['National Show archive', "title: 'Archive'", '← Archive', "'Show history'", 'Full archive', 'National Show Archive']) {
    need(!src.includes(old), `S5: ${name} still carries the old noun ${JSON.stringify(old)}`);
  }
}

// S6
const files = [PURE, PUB, ARCH, YEAR, 'app/sitemap.ts', 'app/(marketing)/layout.tsx', 'app/(marketing)/national-show/layout.tsx', 'app/(marketing)/national-show/page.tsx', 'components/chrome/Header.tsx', 'components/nos-chrome/NosHeader.tsx', 'components/nos/NosHero.tsx', 'components/nos/nos-subnav-groups.ts', 'components/nos/NosShowIndex.tsx'];
const allowedPhrases = new Set(['Past shows']);
for (const rel of files) {
  const base = readBaseFile(rel);
  const src = readRepoFile(rel) ?? '';
  const added = base === null ? src.split('\n') : git('diff', '-U0', BASE, '--', rel).split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1));
  for (const line of added) {
    const code = line.trim();
    if (code === '' || code.startsWith('//') || code.startsWith('*') || code.startsWith('/*') || code.startsWith('{/*')) continue;
    if (/#[0-9a-fA-F]{3,8}\b/.test(code) && !/&#/.test(code)) failures.push(`S6: hex colour in ${rel}: ${code}`);
    if (/font-family/.test(code)) failures.push(`S6: font-family in ${rel}: ${code}`);
    if (/\.(create|createOrReplace|patch|delete|set|update|commit)\(/.test(code) && /sanity|firestore|client|db\b/i.test(code)) failures.push(`S6: a write call in ${rel}: ${code}`);
    if (/process\.env/.test(code)) failures.push(`S6: process.env in an added line of ${rel}: ${code}`);
    for (const m of code.matchAll(/(['"`])((?:(?!\1).){12,})\1/g)) {
      const text = m[2];
      if (/^[@./#\w-]+$/.test(text) || text.startsWith('/') || text.startsWith('@/') || text.includes('${') || allowedPhrases.has(text) || (base ?? '').includes(text)) continue;
      if (text.trim().split(/\s+/).length >= 3 && /[a-z]{3}/.test(text) && /^[A-Z]/.test(text)) failures.push(`S6: a new multi-word string literal in ${rel} (no invention): ${text}`);
    }
  }
}

// S7
const doc = readRepoFile(DOC);
if (doc === null) failures.push(`S7: ${DOC} is missing`);
else {
  for (const [re, what] of [[/r64/i, 'r64'], [/hasPastShowRecords/, 'the predicate'], [/pastShowsQuery|Sanity `show`|status == "past"/, 'the Sanity evidence'], [/Past shows/, 'the one noun'], [/sitemap/i, 'the sitemap'], [/404|notFound/i, 'the 404'], [/owner/i, 'the owner flags']]) {
    need(re.test(doc), `S7: ${DOC} does not mention ${what}`);
  }
}

finish('static.mjs', failures, 'S1-S7 hold.');
