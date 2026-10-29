// check-static: the dev's diff stays inside the feature (A5). Fails before the dev starts (retired strings still in page.tsx) by design.
// Reads git only; no build, no network.
//   S1 diff scope: only the files this spec lists may change, and never shared chrome, the footer, nav, the title constants or Sanity
//   S2 retired strings (the old lede, About lead/body/heading, CLOSING at 98aa1da1 and at main-now) are gone from the hub page.tsx
//   S3 retained strings are still in the hub page.tsx or the optional landing copy module
//   S4 no invention in added lines: no colour literal, font, or inline style value; no Sanity/Firestore write; no TODO stand-in
//   S5 the dev did not hand-edit her words: no added line contains a corrected form of a queried typo
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

import { withBaseline } from './baseline.mjs';

const SPEC = '.agent/memory/project/specs/nos-landing-v1';
const PAGE = 'app/(nos)/national-show/page.tsx';
const OPTIONAL_COPY_MODULE = 'lib/data/national-show-landing.ts';
const copy = withBaseline(JSON.parse(readFileSync(`${SPEC}/goldens/copy.json`, 'utf8')));
const failures = [];
const fail = (m) => failures.push(m);
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 1 << 26 });

const base = git('merge-base', 'HEAD', 'origin/main').trim();
const changed = [...new Set(git('diff', '--name-only', base).split('\n').concat(git('ls-files', '--others', '--exclude-standard').split('\n')).filter(Boolean))];

const ALLOWED = [
  /^\.agent\/memory\/project\/specs\/nos-landing-v1\//,
  /^\.agent\/memory\/project\/(learned|backlog)\.md$/,
  /^\.agent\/memory\/project\/missions\//,
  /^contracts\/checks\/live-write-guard\/writers-registry\.json$/,
  new RegExp(`^${PAGE.replace(/[()]/g, '\\$&')}$`),
  /^app\/\(nos\)\/national-show\/nos-structure\.css$/,
  /^components\/nos\/(JudgingGroupCard|ExhibitorStageCard)\.tsx$/,
  new RegExp(`^${OPTIONAL_COPY_MODULE.replace('.', '\\.')}$`),
  /^docs\/nos-landing-v1\.md$/,
  /^e2e\/nos-landing-v1\.spec\.ts$/,
  /^README\.md$/,
];
const PROTECTED = [/^components\/chrome\//, /^components\/nos-chrome\//, /^components\/newsletter\//, /^lib\/show-title\.ts$/, /^lib\/site-metadata\.ts$/, /^sanity\//, /^content\//, /^firestore/, /^app\/api\//, /^components\/ui\//];
for (const f of changed) {
  if (PROTECTED.some((r) => r.test(f))) fail(`S1: ${f} is shared or protected (footer/nav/chrome/title constants/Sanity): out of scope (D7)`);
  else if (!ALLOWED.some((r) => r.test(f))) fail(`S1: ${f} is not in this feature's file list`);
}

const sources = [PAGE, OPTIONAL_COPY_MODULE].filter(existsSync).map((f) => readFileSync(f, 'utf8'));
const hub = readFileSync(PAGE, 'utf8');
const lit = (s) => [s, s.replace(/'/g, "\\'"), s.replace(/"/g, '\\"')];
for (const r of copy.retired) if (sources.some((src) => lit(r.text).some((v) => src.includes(v)))) fail(`S2: retired text ${r.id} is still in source (${r.why})`);
for (const r of copy.retained) if (!sources.some((src) => lit(r.text).some((v) => src.includes(v)))) fail(`S3: retained text ${r.id} is gone from the hub source`);
void hub;

const added = git('diff', '-U0', base, '--', ...changed.filter((f) => /\.(tsx?|css)$/.test(f))).split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'));
for (const l of added) {
  if (/#[0-9a-fA-F]{3,8}\b/.test(l) && !/&#|href=|id=|["']#/.test(l)) fail(`S4: colour literal in added line: ${l.slice(0, 100)}`);
  if (/font-family|@font-face|rgba?\(/.test(l)) fail(`S4: font or colour function in added line: ${l.slice(0, 100)}`);
  if (/createOrReplace|\.patch\(|setDoc\(|\.mutate\(|getFirestore|firebase-admin/.test(l)) fail(`S4: a Sanity/Firestore write or admin import in added line: ${l.slice(0, 100)}`);
  if (/\b(TODO|FIXME|lorem ipsum)\b/i.test(l)) fail(`S4: placeholder marker in added line: ${l.slice(0, 100)}`);
  for (const c of copy.corrections) if (l.includes(c.never)) fail(`S5: added line carries a corrected form of her wording (${c.never})`);
}
for (const x of failures) console.error('FAIL', x);
console.log(failures.length ? `check-static: ${failures.length} failure(s)` : `check-static: ok (${changed.length} changed files)`);
process.exit(failures.length ? 1 : 0);
