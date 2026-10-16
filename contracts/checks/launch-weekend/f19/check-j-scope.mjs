#!/usr/bin/env node
// F19-A10: scope, no-invention and the static half of the NOS regression guard, on the diff against BASE_REF (default origin/main).
// Only tokens.json scope.allow files (plus the two SAOC footer files in scope.allowOverride: tap targets) and scope.allowPrefix directories may change; NOTHING under the National Show (app/(marketing)/
// national-show/**, components/nos/**, components/nos-chrome/**, components/show/**, nos-structure.css), the rest of the chrome (components/chrome/** except Footer.tsx and footer-data.ts: Header, UtilityBar, MegaMenu, MobileMenu are other lanes and the header is the axis authority; VenueCard lives under components/show/**), lib/**, sanity/**, app/api/** or ShowBand.tsx. Added lines hold no hex colour, no rgb()/rgba() that is
// not a palette token value, no new font family, no @keyframes / animate-, no duration other than 150ms (the carousel's existing
// duration-[1400ms] and the pause button are untouched lines) and no emoji; globals.css additions sit under an F19 comment except the
// ruled in-place line-height edit.
// Usage: node contracts/checks/launch-weekend/f19/check-j-scope.mjs   (BASE_REF=<sha> to pin)
import { execFileSync } from 'node:child_process';
import { ROOT, loadGolden } from './_lib.mjs';

const BASE_REF = process.env.BASE_REF || 'origin/main';
const T = loadGolden('tokens.json').scope;
const git = (...a) => execFileSync('git', ['-C', ROOT, ...a], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const problems = [];
const names = [...new Set([...git('diff', '--name-only', `${BASE_REF}...HEAD`).split('\n'), ...git('diff', '--name-only', 'HEAD').split('\n'), ...git('ls-files', '--others', '--exclude-standard').split('\n')].filter(Boolean))];
const nosHit = (f) => !T.allowOverride.includes(f) && T.forbidPrefix.some((p) => f.startsWith(p)) || f.endsWith('nos-structure.css');
for (const f of names) {
  if (nosHit(f)) problems.push(`forbidden path changed (NOS / chrome / data layer): ${f}`);
  else if (!T.allow.includes(f) && !T.allowPrefix.some((p) => f.startsWith(p))) problems.push(`file outside the F19 allowlist changed: ${f}`);
}
const palette = T.rgbTokens.map((s) => s.replace(/\s/g, ''));
const added = [];
for (const f of names.filter((n) => T.allow.includes(n) || n.startsWith('components/'))) {
  if (!/\.(tsx|css)$/.test(f)) continue;
  const lines = git('diff', '--unified=0', BASE_REF, '--', f).split('\n');
  const adds = lines.filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1));
  const dels = lines.filter((l) => l.startsWith('-') && !l.startsWith('---')).map((l) => l.slice(1));
  if (f === 'app/globals.css') {
    const bad = dels.filter((d) => !/line-height:\s*1\.65/.test(d));
    if (bad.length) problems.push(`app/globals.css: only the .p-lg line-height 1.65 line may be edited, also removed/changed: "${bad[0].trim().slice(0, 60)}"`);
    const body = adds.filter((l) => !/line-height:\s*1\.55/.test(l));
    if (body.length && !body.some((l) => /F19/.test(l))) problems.push('app/globals.css: additions must sit under an F19 comment');
  }
  adds.forEach((l) => added.push({ f, l }));
}
for (const { f, l } of added) {
  const tag = `${f}: "${l.trim().slice(0, 90)}"`;
  if (/#[0-9a-fA-F]{3,8}\b/.test(l.replace(/&#\d+;/g, ''))) problems.push(`hex colour added: ${tag}`);
  for (const m of l.matchAll(/rgba?\(([^)]*)\)/g)) { const v = m[1].replace(/[\s,/_]+/g, ' ').trim().split(' ').slice(0, 3).join(','); if (!palette.some((p) => p.startsWith(v) || v.startsWith(p))) problems.push(`rgb/rgba(${m[1]}) is not a palette token value: ${tag}`); }
  if (/font-family|font-\[['"]|@font-face|Georgia|Arial|Inter\b/.test(l)) problems.push(`new font family: ${tag}`);
  if (/@keyframes|\banimate-|animation:/.test(l)) problems.push(`animation added: ${tag}`);
  for (const m of l.matchAll(/duration-\[?(\d+)/g)) if (m[1] !== '150') problems.push(`duration-${m[1]} (only 150ms): ${tag}`);
  if (/\p{Extended_Pictographic}/u.test(l)) problems.push(`emoji added: ${tag}`);
}
if (!names.length) problems.push('no F19 change found');
if (problems.length) { console.error(`FAIL (${problems.length}):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log(`PASS: ${names.length} changed path(s), none in NOS/chrome/data layer, all on the allowlist; ${added.length} added line(s) hold no unruled colour, font, animation, duration or emoji`);
