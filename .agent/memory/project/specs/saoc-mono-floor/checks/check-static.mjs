// Static checks for saoc-mono-floor: no SAOC mono size under 12px by source. Reads the worktree from its root.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const failures = [];
const must = (name, ok, detail = '') => { if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ''}`); };
const css = readFileSync('app/globals.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const px = (v) => (/rem$/.test(v) ? parseFloat(v) * 16 : parseFloat(v));

// 1. Tokens.
for (const t of ['--mono-md', '--mono-sm', '--mono-xs']) {
  const v = new RegExp(`${t}:\\s*([0-9.]+(?:px|rem))`).exec(css)?.[1];
  must(`${t} is at least 12px`, v !== undefined && px(v) >= 12, String(v));
}
must('--mono-tracking is unchanged (0.18em)', /--mono-tracking:\s*0\.18em/.test(css));
must('.mono-label keeps its 0.2em tracking and uppercase', /\.mono-label\s*\{[^}]*letter-spacing:\s*0\.2em[^}]*text-transform:\s*uppercase/.test(css));
must('.eyebrow keeps its mono tracking token and uppercase', /\.eyebrow\s*\{[^}]*letter-spacing:\s*var\(--mono-tracking\)[^}]*text-transform:\s*uppercase/.test(css));

// 2. Hard-coded font-size in a rule that sets the mono family.
for (const m of css.matchAll(/\{([^{}]*font-family:\s*var\(--(?:mono|font-mono)\)[^{}]*)\}/g)) {
  const size = /font-size:\s*([0-9.]+(?:px|rem))/.exec(m[1])?.[1];
  if (size) must('mono rule font-size at least 12px', px(size) >= 12, `${size} in ${m[1].trim().slice(0, 80)}`);
}

// 3. Tailwind literals that bypass the token: every sub-12px literal used with font-mono (outside the NOS-only trees) must be covered by the global floor rule.
function* walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) { if (e !== 'node_modules') yield* walk(p); } else if (p.endsWith('.tsx')) yield p;
  }
}
const literals = new Set();
for (const root of ['app', 'components']) for (const file of walk(root)) {
  if (/app\/\(nos\)|components\/(nos|nos-chrome)\//.test(file)) continue;
  // Multi-line safe: a sub-12px literal counts when `font-mono` sits within WINDOW characters of it in the same file, whichever
  // line the class list is split across. Over-matching only widens the floor selector; the runtime probe (gate-mono.mjs) is the authority.
  const src = readFileSync(file, 'utf8');
  const WINDOW = 400;
  for (const m of src.matchAll(/text-\[([0-9.]+)(px|rem)\]/g)) {
    if (px(m[1] + m[2]) >= 12) continue;
    if (src.slice(Math.max(0, m.index - WINDOW), m.index + WINDOW).includes('font-mono')) literals.add(`${m[1]}${m[2]}`);
  }
}
const floorRule = /\.font-mono:is\(([^)]*)\)(?::not\(([^)]*)\))?\s*\{([^}]*)\}/.exec(css);
must('a global floor rule `.font-mono:is([class*=...])` exists, unlayered', Boolean(floorRule));
if (floorRule) {
  must('floor rule sets font-size to 12px / 0.75rem and nothing that changes tracking or case', /font-size:\s*(12px|0\.75rem)/.test(floorRule[3]) && !/letter-spacing|text-transform/.test(floorRule[3]), floorRule[3]);
  must('floor rule exempts the logo lockup tagline via :not([data-lockup-tagline])', floorRule[2] === '[data-lockup-tagline]', String(floorRule[2]));
  const lockup = readFileSync('components/chrome/SaocLockup.tsx', 'utf8');
  must('SaocLockup carries data-lockup-tagline at both tagline sites and keeps text-[11px] and 0.22em', (lockup.match(/data-lockup-tagline/g) ?? []).length === 2 && (lockup.match(/text-\[11px\]/g) ?? []).length === 2 && (lockup.match(/letterSpacing: '0\.22em'/g) ?? []).length === 2);
  must('SaocLockup states the exemption in a comment at both sites', (lockup.match(/exempt/gi) ?? []).length >= 2);
  const lockupDiff = execFileSync('git', ['diff', '-U0', 'origin/main', '--', 'components/chrome/SaocLockup.tsx'], { encoding: 'utf8' }).split('\n').filter((l) => /^[+-][^+-]/.test(l));
  must('SaocLockup diff is comments and the data attribute only', lockupDiff.every((l) => l.startsWith('+') && (/^\+\s*(\/\/|\{\/\*|\*|\/\*)/.test(l) || /data-lockup-tagline/.test(l))), lockupDiff.join(' | '));
  for (const lit of literals) must(`floor rule covers text-[${lit}]`, floorRule[1].includes(`text-[${lit}]`), floorRule[1]);
}
console.log(`sub-12px mono literals found in source: ${[...literals].join(', ') || 'none'}`);

// 4. NOS tree untouched (NOS already passes).
const nosChanged = execFileSync('git', ['diff', '--name-only', 'origin/main', '--', 'app/(nos)', 'components/nos', 'components/nos-chrome'], { encoding: 'utf8' }).trim();
must('no NOS file changed', nosChanged === '', nosChanged);
must('NOS baseline for the non-regression probe exists', existsSync('.agent/memory/project/specs/saoc-mono-floor/checks/nos-baseline.json'));

if (failures.length) { console.error(`FAILED:\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log('saoc-mono-floor static checks pass');
