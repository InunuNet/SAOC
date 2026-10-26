// Diff scope for the SAOC PageHero mirror (mechanical, from git). Usage: node check-diff-scope.mjs
// Changed = tracked changes against the merge-base with origin/main (committed or not) plus untracked files. Every changed path must be in the allowlist, none
// in the stay-off list, and the content rules hold: no copy change on a page, no new custom property, no new colour literal.
import { execFileSync } from 'node:child_process';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 28 });
// The base is the merge-base, so a main that moved on after the branch point is not counted as this PR's change.
const BASE = git('merge-base', 'HEAD', 'origin/main').trim();
const changed = new Set([
  ...git('diff', '--name-only', BASE).split('\n'),
  ...git('ls-files', '--others', '--exclude-standard').split('\n'),
].filter(Boolean));

const ALLOW = [
  /^components\/ui\/(PageHero|PhotoBand|RouteHero)\.tsx$/,
  /^components\/ui\/RouteHero\.module\.css$/,
  /^lib\/data\/saoc-hero-photos\.ts$/,
  /^docs\/saoc-inner-heroes\.md$/,
  /^components\/home\/(Hero|ShowBand)\.tsx$/,
  /^components\/nos\/LegalHero\.tsx$/,
  /^components\/chrome\/SaocLockup\.tsx$/, // `sizes` lines only (footer emblem srcset, no visual change; shared with NOS)
  /^lib\/data\/home-hero-slides\.ts$/,
  /^app\/\(marketing\)\/(about|judging|societies|events|sponsors|contact|memorandum-of-incorporation|media-kit|members)\/page\.tsx$/,
  /^app\/\(marketing\)\/societies\/\[slug\]\/page\.tsx$/,
  /^app\/\(marketing\)\/events\/\[slug\]\/page\.tsx$/, // only the ShowBand `split` prop line (rule below); #92 owns the rest
  /^app\/\(shared\)\/(privacy|terms|refunds)\/page\.tsx$/,
  /^app\/globals\.css$/,
  /^lib\/hero-(source-widths|derived-sources)\.json$/,
  /^scripts\/generate-image-variants\.mjs$/,
  /^docs\/(components|saoc-inner-heroes)\.md$/,
  /^e2e\/.*\.spec\.ts$/,
  /^\.agent\/memory\/project\/specs\/saoc-inner-heroes\//,
  /^\.agent\/memory\/project\/(learned|backlog)\.md$/,
];
// Named lanes this PR stays out of (spec.md section 7). A path here fails even if an allowlist pattern above would match it.
const STAY_OFF = [
  /^components\/chrome\/(?!SaocLockup\.tsx$)/, /^components\/newsletter\//, /^app\/\(marketing\)\/events\/submit\//,
  /^app\/\(shared\)\/(?!(privacy|terms|refunds)\/page\.tsx$)/, /^lib\/image-widths\.json$/, /^lib\/image-loader\.ts$/, /^components\/societies\//,
  /^components\/home\/(YearbookStrip|EventsStrip|NavCards|MissionBlock|PartnersSection)\.tsx$/,
  /^components\/nos(-chrome)?\/(?!LegalHero\.tsx$)/, /^app\/\(nos\)\//, /^CLAUDE\.md$/, /^apphosting\.yaml$/, /^proxy\.ts$/, /^lib\/site-hosts\.ts$/,
];
const failures = [];
for (const f of changed) {
  if (STAY_OFF.some((re) => re.test(f))) failures.push(`${f}: in a lane this PR stays out of`);
  else if (!ALLOW.some((re) => re.test(f))) failures.push(`${f}: not in the allowlist`);
}

const diffOf = (file) => git('diff', BASE, '-U0', '--', file).split('\n').filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l));
// No copy change: a page's diff is only its image / imagePosition props. Both sides of the diff are normalised (those two attributes
// stripped, whitespace collapsed); the removed and added lines must then be the same multiset, so a one-line <PageHero ...> edit passes
// only when nothing but image / imagePosition changed. LegalHero.tsx (host-aware wrapper) may also drop its `image` plumbing lines.
const PROP = /\bimage(Position)?=("[^"]*"|\{[^}]*\})/g;
const SPLIT_PROP = /\bsplit=("[^"]*"|\{[^}]*\})/g;
const EVENT_PAGE = 'app/(marketing)/events/[slug]/page.tsx';
const norm = (l) => l.slice(1).replace(PROP, '').replace(SPLIT_PROP, '').replace(/\s+/g, ' ').trim();
for (const f of changed) {
  const isPage = /^app\/\((marketing|shared)\)\/.*page\.tsx$/.test(f);
  const isLegal = f === 'components/nos/LegalHero.tsx';
  const isLockup = f === 'components/chrome/SaocLockup.tsx';
  if (!isPage && !isLegal && !isLockup) continue;
  const lines = diffOf(f).filter((l) => !(isLegal && /\bimage\b/.test(l)));
  // SaocLockup.tsx: the diff may only touch `sizes=` lines (the footer emblem needs a real @3 pick; no visual change).
  if (f === 'components/chrome/SaocLockup.tsx') for (const l of lines) if (!/\bsizes=/.test(l)) failures.push(`${f}: diff beyond the sizes lines: ${l.trim().slice(0, 70)}`);
  // events/[slug]: the diff may only touch <ShowBand ...> lines, and only to add / change the opt-in `split` prop (NOS Design: 42/58 on the event page only).
  if (f === EVENT_PAGE) for (const l of lines) if (!/<ShowBand\b/.test(l)) failures.push(`${f}: diff beyond the ShowBand split prop: ${l.trim().slice(0, 70)}`);
  const minus = lines.filter((l) => l.startsWith('-')).map(norm).filter(Boolean).sort();
  const plus = lines.filter((l) => l.startsWith('+')).map(norm).filter(Boolean).sort();
  if (!isLockup && JSON.stringify(minus) !== JSON.stringify(plus)) failures.push(`${f}: diff beyond image/imagePosition (no copy changes): -${minus.filter((x) => !plus.includes(x))[0]?.slice(0, 70)} +${plus.filter((x) => !minus.includes(x))[0]?.slice(0, 70)}`);
}
// No new tokens or colours.
for (const f of changed) {
  if (!/\.(css|tsx?)$/.test(f) || /^\.agent\//.test(f)) continue;
  for (const l of diffOf(f).filter((x) => x.startsWith('+'))) {
    if (/^\+\s*--[a-z][\w-]*\s*:/.test(l)) failures.push(`${f}: new custom property: ${l.trim().slice(0, 80)}`);
    if (/#[0-9a-fA-F]{3,8}\b/.test(l) && !/^\+\s*(\/\/|\*|\/\*)/.test(l)) failures.push(`${f}: new hex colour literal: ${l.trim().slice(0, 80)}`);
    if (/rgba?\(/.test(l) && !/rgba?\(\s*34[ ,]+40[ ,]+31/.test(l) && !/^\+\s*(\/\/|\*|\/\*)/.test(l)) failures.push(`${f}: colour other than the sage rgb(34 40 31): ${l.trim().slice(0, 80)}`);
  }
}
// The width manifest edit is entries only.
if (changed.has('lib/hero-source-widths.json')) for (const l of diffOf('lib/hero-source-widths.json')) if (!/^[+-]\s*[{}]?\s*$/.test(l) && !/^[+-]\s*"[^"]+": \d+,?$/.test(l)) failures.push(`hero-source-widths.json: unexpected diff: ${l.trim()}`);

if (failures.length) { console.error(`check-diff-scope FAILED:\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log(`check-diff-scope pass (${changed.size} changed paths)`);
