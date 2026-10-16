#!/usr/bin/env node
// A-H: scope and no-invention hygiene on the diff against BASE_REF (default origin/main). Only the allowlisted files may
// change; app/globals.css may only gain lines (no deletions) and only inside an F14 comment block if touched. In the
// added lines: no hex colour, no rgba/rgb other than the ruled alphas, no new font family, no animation/keyframes,
// every Tailwind duration-N is 150, every scale-[x] is <=1.03, no shadow other than the ruled hover shadow, no emoji.
// Usage: node contracts/checks/launch-weekend/f14/check-h-scope.mjs   (cwd = implementation worktree)
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const BASE_REF = process.env.BASE_REF || 'origin/main';
const T = JSON.parse(readFileSync('.agent/memory/project/specs/launch-weekend/goldens/f14/tokens.json', 'utf8'));
const ALLOWED = ['components/home/NavCards.tsx', 'components/home/ShowBand.tsx', 'app/globals.css'];
const ALLOWED_PREFIX = ['contracts/checks/launch-weekend/f14/', '.agent/memory/project/specs/launch-weekend/', 'docs/', '.tmp/'];
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const problems = [];

const names = [...new Set([...git('diff', '--name-only', `${BASE_REF}...HEAD`).split('\n'), ...git('diff', '--name-only', 'HEAD').split('\n'), ...git('ls-files', '--others', '--exclude-standard').split('\n')].filter(Boolean))];
for (const f of names) if (!ALLOWED.includes(f) && !ALLOWED_PREFIX.some((p) => f.startsWith(p))) problems.push(`file outside the F14 allowlist changed: ${f}`);

const added = [];
for (const f of ALLOWED) {
  if (!names.includes(f)) continue;
  const diff = git('diff', '--unified=0', BASE_REF, '--', f);
  const lines = diff.split('\n');
  const adds = lines.filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1));
  const dels = lines.filter((l) => l.startsWith('-') && !l.startsWith('---'));
  if (f === 'app/globals.css') {
    if (dels.length) problems.push(`app/globals.css: ${dels.length} line(s) deleted or edited, only additions allowed`);
    if (adds.length && !adds.some((l) => /F14/.test(l))) problems.push('app/globals.css: additions must sit under an F14 comment');
  }
  adds.forEach((l) => added.push({ f, l }));
}

const allowedRgba = T.allowedRgbaInAddedLines.map((s) => s.replace(/\s/g, ''));
for (const { f, l } of added) {
  const tag = `${f}: "${l.trim().slice(0, 90)}"`;
  if (/#[0-9a-fA-F]{3,8}\b/.test(l.replace(/&#\d+;/g, ''))) problems.push(`hex colour added: ${tag}`);
  for (const m of l.matchAll(/rgba?\(([^)]*)\)/g)) {
    const v = m[1].replace(/[\s_]/g, '');
    if (!allowedRgba.some((a) => v.startsWith(a))) problems.push(`rgb/rgba(${m[1]}) is not a ruled value: ${tag}`);
  }
  if (/font-family|font-\[['"]|@font-face|Georgia|Arial|Inter\b/.test(l)) problems.push(`new font family: ${tag}`);
  if (/@keyframes|\banimate-|animation:/.test(l)) problems.push(`animation added (README l.140-145 forbids): ${tag}`);
  for (const m of l.matchAll(/duration-\[?(\d+)/g)) if (m[1] !== '150') problems.push(`duration-${m[1]} (only 150ms): ${tag}`);
  for (const m of l.matchAll(/scale-\[?([0-9.]+)/g)) if (parseFloat(m[1]) > 1.03 && parseFloat(m[1]) < 100) problems.push(`scale ${m[1]} > 1.03: ${tag}`);
  if (/shadow-(sm|md|lg|xl|2xl)\b/.test(l)) problems.push(`Tailwind stock shadow added (use the ruled hover shadow only): ${tag}`);
  if (/\p{Extended_Pictographic}/u.test(l)) problems.push(`emoji added: ${tag}`);
}
if (!problems.length && !added.length) problems.push('no F14 change found in NavCards.tsx, ShowBand.tsx or globals.css');
if (problems.length) { console.error(`FAIL (${problems.length}):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log(`PASS: ${names.length} changed path(s), all inside the allowlist; ${added.length} added line(s) hold no unruled colour, font, animation, duration or scale`);
