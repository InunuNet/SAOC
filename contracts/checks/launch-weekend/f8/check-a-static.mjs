#!/usr/bin/env node
// A1 - static: the withhold lives in the data/render layer, reuses existing strings only, has one switch, and
// leaves the seo fields, llms generator and coordinated files alone. Reads F8_ROOT (default cwd).
import { execFileSync } from 'node:child_process';
import { ROOT, PENDING_LABEL, read, report } from './_lib.mjs';

const problems = [];
const sp = read('lib/data/show-pages.ts');
const prose = read('components/nos/ShowPageProse.tsx');
const programme = read('app/(nos)/national-show/programme/page.tsx');
const presentation = read('lib/data/ticket-presentation.ts');
const showIndex = read('components/nos/NosShowIndex.tsx');
const state = read('components/show/nos/ShowContentState.tsx');
const proxy = read('proxy.ts');
const launch = read('lib/beta-public-launch.ts');

if (!/export function withholdPlaceholderProse\(/.test(sp)) problems.push('lib/data/show-pages.ts does not export withholdPlaceholderProse()');
if (!/export function applyContentGaps\(/.test(sp)) problems.push('lib/data/show-pages.ts does not export applyContentGaps()');
const calls = (sp.match(/applyContentGaps\(/g) || []).length;
if (calls < 3) problems.push(`applyContentGaps( appears ${calls} time(s); expected the definition plus calls from hydratePage and buildAbsentShowPage`);
const gapFn = sp.match(/export function applyContentGaps\([\s\S]*?\n}\n/)?.[0] ?? '';
if (!sp.includes(PENDING_LABEL)) problems.push(`show-pages.ts lacks the existing label string "${PENDING_LABEL}"`);
if (!/ABSENT_SHOW_PAGE_FIXED_SENTENCE/.test(gapFn)) problems.push('applyContentGaps does not reuse ABSENT_SHOW_PAGE_FIXED_SENTENCE as the gap text');
const envReads = new Set([...sp.matchAll(/process\.env\.([A-Z_]+)/g)].map((m) => m[1]));
for (const n of envReads) if (!['SHOW_PLACEHOLDER_PREVIEW', 'SITE_PUBLIC_LAUNCH', 'BETA_BASIC_AUTH_USER', 'BETA_BASIC_AUTH_PASSWORD'].includes(n)) problems.push(`show-pages.ts reads process.env.${n}; only SHOW_PLACEHOLDER_PREVIEW, SITE_PUBLIC_LAUNCH and the two BETA_BASIC_AUTH_* names are allowed`);
if (!/isPubliclyLaunched\(/.test(sp)) problems.push('withholdPlaceholderProse does not consult isPubliclyLaunched()');
// One wall predicate, shared: "creds configured" is defined once in lib/beta-public-launch.ts and used by proxy.ts and the preview switch.
if (!/export function isBetaWallConfigured\(/.test(launch)) problems.push('lib/beta-public-launch.ts does not export isBetaWallConfigured()');
if (!/isBetaWallConfigured\(/.test(proxy)) problems.push('proxy.ts does not use isBetaWallConfigured()');
if (!/isBetaWallConfigured\(/.test(sp)) problems.push('show-pages.ts withholdPlaceholderProse does not use isBetaWallConfigured()');
if (!/export function buildAbsentShowPage\(/.test(sp)) problems.push('buildAbsentShowPage is not exported (A3 renders the fallback through it)');
// The absent-doc branch of ShowContentState must render afterProse (so /programme keeps its links).
const fallbackBranch = state.match(/state === 'fallback-unpublished'[\s\S]*?\) : layout === 'listing'/)?.[0] ?? '';
if (!/afterProse/.test(fallbackBranch)) problems.push('ShowContentState fallback-unpublished branch does not render afterProse');
if (!/data-nos-content-gap/.test(prose)) problems.push('ShowPageProse.tsx does not emit data-nos-content-gap');
// The programme page is the NOS Design PG-G1 board (PR #106 replaced the old data-nos-programme-links container; the
// golden is .agent/memory/project/specs/nos-content-standard/goldens/spec.md, "/programme (PG-G1 ...)"). The original
// intent stands: a visitor on /programme can reach the Symposium and Workshops pages. Today that means the board
// renders, the Symposium session tile links the ticket product's detail page, the Workshops row links WORKSHOPS_HREF,
// and the page ends with NosShowIndex, which also lists both pages.
if (!/data-programme-board/.test(programme)) problems.push('programme/page.tsx does not render the PG-G1 timetable board (data-programme-board)');
if (!/data-programme-body/.test(programme)) problems.push('programme/page.tsx lacks the PG-G1 full-width body (data-programme-body)');
const detailHrefs = presentation.match(/export const TICKET_DETAIL_HREFS[\s\S]*?\n};/)?.[0] ?? '';
if (!/symposium:\s*'\/[^']+'/.test(detailHrefs)) problems.push('lib/data/ticket-presentation.ts TICKET_DETAIL_HREFS has no symposium href');
if (!/TICKET_DETAIL_HREFS\[id\]/.test(programme)) problems.push('programme/page.tsx does not take session tile hrefs from TICKET_DETAIL_HREFS');
if (!/<Link[^>]*href=\{session\.href\}[^>]*className="nos-pg-session"/.test(programme)) problems.push('programme/page.tsx does not render the session tile as a link (nos-pg-session with session.href)');
const programmeProducts = presentation.match(/export const PROGRAMME_PRODUCTS[\s\S]*?\];/)?.[0] ?? '';
if (!/'symposium'/.test(programmeProducts)) problems.push('PROGRAMME_PRODUCTS does not include the symposium, so no Symposium tile is placed on the board');
if (!/const WORKSHOPS_HREF = '\/[^']+'/.test(programme)) problems.push('programme/page.tsx does not define WORKSHOPS_HREF');
if (!/<Link[^>]*href=\{WORKSHOPS_HREF\}[^>]*className="nos-pg-later"/.test(programme)) problems.push('programme/page.tsx lacks the ruled Workshops row (nos-pg-later linking WORKSHOPS_HREF)');
if (!/<NosShowIndex current="\/national-show\/programme"/.test(programme)) problems.push('programme/page.tsx does not render NosShowIndex');
for (const href of ['/national-show/symposium', '/national-show/workshops']) {
  if (!showIndex.includes(`'${href}'`)) problems.push(`components/nos/NosShowIndex.tsx does not list ${href}`);
}

// llms generator must never query showPage; seo fields of showPage must stay unconsumed outside the loader.
if (/showPage/.test(read('scripts/refresh-llms.ts'))) problems.push('scripts/refresh-llms.ts queries showPage content');
for (const dir of ['app', 'components']) {
  try {
    const hit = execFileSync('grep', ['-rlE', '\\.(seoTitle|seoDescription|seoImage)\\b', '--include=*.ts', '--include=*.tsx', `${ROOT}/${dir}`], { encoding: 'utf8' }).trim();
    if (hit) problems.push(`showPage seo fields consumed in: ${hit.split('\n').join(', ')}`);
  } catch { /* grep exit 1 = no match */ }
}

// No new copy: every multi-word string literal ADDED in the three edited files already exists in the base tree.
const git = (...a) => execFileSync('git', ['-C', ROOT, ...a], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
let base = process.env.BASE_REF;
if (!base) { try { base = git('merge-base', 'HEAD', 'origin/main').trim(); } catch { base = 'origin/main'; } }
// The programme page is not diffed: PR #106 rewrote it deliberately (PG-G1), so its copy is the golden's, not F8's.
const files = ['lib/data/show-pages.ts', 'components/nos/ShowPageProse.tsx'];
const added = git('diff', '-U0', base, '--', ...files).split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++') && !/^\+\s*(\/\/|\*|\/\*)/.test(l));
const isClassString = (lit) => lit.split(/\s+/).every((t) => /^[a-z0-9:\[\]\-_./%()#]+$/.test(t)) && /[-\[]/.test(lit);
for (const line of added) {
  for (const m of line.matchAll(/(['"`])((?:(?!\1).)+)\1/g)) {
    const lit = m[2];
    if (lit.trim().split(/\s+/).length < 3 || isClassString(lit)) continue;
    try { execFileSync('git', ['-C', ROOT, 'grep', '-qF', '--', lit, base]); } catch { problems.push(`new copy not present at base: "${lit}"`); }
  }
}
report(problems, 'withhold is in the data/render layer, single switch, no new copy, llms and seo untouched');
