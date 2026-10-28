// Diff scope for contract-f2 (mechanical, from git). Usage: node f2-check-diff-scope.mjs
// Changed = the COMMITTED diff, merge-base(origin/main, HEAD)..HEAD (the working tree is ignored; commit before running).
// Every changed path must be in the allowlist and none in the stay-off list; no new custom property, no new colour literal other than the sage.
import { execFileSync } from 'node:child_process';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 28 });
const BASE = git('merge-base', 'HEAD', 'origin/main').trim();
const changed = new Set(git('diff', '--name-only', BASE, 'HEAD').split('\n').filter(Boolean));

const ALLOW = [
  /^components\/ui\/(PageHero|RouteHero)\.tsx$/,
  /^lib\/data\/saoc-hero-photos\.ts$/,
  /^app\/globals\.css$/,
  /^app\/\(marketing\)\/members\/page\.tsx$/,
  /^app\/not-found\.tsx$/,
  /^app\/\(marketing\)\/events\/submit\/page\.tsx$/,
  /^components\/events\/SubmitEventPageBody\.tsx$/,
  /^components\/ui\/DraftNotice\.tsx$/,           // NOS Design 2026-10-27: the one shared draft notice
  /^app\/\(shared\)\/refunds\/page\.tsx$/,          // ...adopted by /refunds (carved out of the (shared) stay-off lane below)
  /^scripts\/heroes-sheets\.mjs$/,
  /^docs\/saoc-inner-heroes\.md$/,
  /^e2e\/.*\.spec\.ts$/,
  /^\.agent\/memory\/project\/specs\/saoc-inner-heroes\//,
  /^\.agent\/memory\/project\/(learned|backlog)\.md$/,
];
// Lanes f2 stays out of: the home hero, the NOS host, the shared legal pages and every other page (HM-6 and the /events/[slug] cut are
// sheet deliverables, not implemented here), the image pipeline and the derived-source manifest (no new cut ships in f2).
const STAY_OFF = [
  /^components\/home\//, /^components\/nos(-chrome)?\//, /^app\/\(nos\)\//, /^app\/\(shared\)\//, /^components\/chrome\//,
  /^lib\/hero-derived-sources\.json$/, /^lib\/hero-source-widths\.json$/, /^scripts\/generate-image-variants\.mjs$/, /^lib\/image-(loader|widths)/,
  /^app\/\(marketing\)\/events\/\[slug\]\/page\.tsx$/, /^app\/\(marketing\)\/societies\/\[slug\]\/page\.tsx$/, // /societies/[slug] goes typographic through saoc-hero-photos + RouteHero, never the page file
  /^CLAUDE\.md$/, /^apphosting\.yaml$/, /^proxy\.ts$/,
];
const EXEMPT_FROM_STAY_OFF = [/^app\/\(shared\)\/refunds\/page\.tsx$/];
const failures = [];
for (const f of changed) {
  if (STAY_OFF.some((re) => re.test(f)) && !EXEMPT_FROM_STAY_OFF.some((re) => re.test(f))) failures.push(`${f}: in a lane f2 stays out of`);
  else if (!ALLOW.some((re) => re.test(f))) failures.push(`${f}: not in the allowlist`);
}
const diffOf = (file) => git('diff', BASE, 'HEAD', '-U0', '--', file).split('\n').filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l));
for (const f of changed) {
  if (!/\.(css|tsx?)$/.test(f) || /^\.agent\//.test(f)) continue;
  for (const l of diffOf(f).filter((x) => x.startsWith('+'))) {
    if (/^\+\s*--[a-z][\w-]*\s*:/.test(l)) failures.push(`${f}: new custom property: ${l.trim().slice(0, 80)}`);
    if (/#[0-9a-fA-F]{3,8}\b/.test(l) && !/^\+\s*(\/\/|\*|\/\*)/.test(l)) failures.push(`${f}: new hex colour literal: ${l.trim().slice(0, 80)}`);
    if (/rgba?\(/.test(l) && !/rgba?\(\s*34[ ,]+40[ ,]+31/.test(l) && !/^\+\s*(\/\/|\*|\/\*)/.test(l)) failures.push(`${f}: colour other than the sage rgb(34 40 31): ${l.trim().slice(0, 80)}`);
  }
}
if (failures.length) { console.error(`f2-check-diff-scope FAILED:\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log(`f2-check-diff-scope pass (${changed.size} changed paths)`);
