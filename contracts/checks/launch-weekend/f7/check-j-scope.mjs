#!/usr/bin/env node
// F7-A8 - every changed file (tracked diff vs BASE_REF + untracked) is on the allowlist for the feature under test
// (F7_SCOPE=a|b|c, default all = union); no colour/type literal is added; the :root and @theme token blocks in
// app/globals.css are byte-identical to BASE_REF (token VALUES never change).
import { execFileSync } from 'node:child_process';
import { GOLDEN_DIR, readJson, report } from './_lib.mjs';

const cfg = readJson(`${GOLDEN_DIR}/scope-allowlist.json`);
const which = process.env.F7_SCOPE || 'all';
const base = process.env[cfg.baseRefEnv] || cfg.baseRefDefault;
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
try { git('rev-parse', '--verify', base); } catch { console.error(`INFRA: base ref ${base} not found`); process.exit(2); }

const rules = [...cfg.shared, ...(which === 'all' || which === 'a' ? cfg.a : []), ...(which === 'all' || which === 'b' ? cfg.b : []), ...(which === 'all' || which === 'c' ? cfg.c : [])].map((r) => new RegExp(r));
const never = cfg.neverTouch.map((r) => new RegExp(r));
const changed = new Set([...git('diff', '--name-only', base).split('\n'), ...git('ls-files', '--others', '--exclude-standard').split('\n')].filter(Boolean));
const problems = [];
for (const f of changed) {
  if (never.some((r) => r.test(f))) problems.push(`touches a file owned by in-flight work: ${f}`);
  else if (!rules.some((r) => r.test(f))) problems.push(`out-of-scope change (${which}): ${f}`);
}

const literal = new RegExp(cfg.colourLiteral);
for (const f of changed) {
  if (!/^(app|components)\/.*\.(tsx|ts|css)$/.test(f) || never.some((r) => r.test(f))) continue;
  let added;
  try { added = git('diff', '-U0', base, '--', f).split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')); } catch { continue; }
  for (const l of added) {
    const body = l.slice(1).trim();
    if (/^(\/\/|\/\*|\*)/.test(body)) continue;
    if (/href=|#vendor-register-|id=/.test(body)) continue;
    if (literal.test(body)) problems.push(`added colour/type literal in ${f}: ${body.slice(0, 90)}`);
  }
}

const blocks = (src) => [/^:root\s*\{[\s\S]*?^\}/m, /^@theme[^{]*\{[\s\S]*?^\}/m].map((re) => (re.exec(src) || [''])[0]);
if (changed.has('app/globals.css')) {
  const now = execFileSync('cat', ['app/globals.css'], { encoding: 'utf8' });
  const then = git('show', `${base}:app/globals.css`);
  const [a, b] = [blocks(now), blocks(then)];
  if (a[0] !== b[0]) problems.push('app/globals.css: :root token block changed');
  if (a[1] !== b[1]) problems.push('app/globals.css: @theme block changed');
}
report(problems, `${changed.size} changed file(s) within the F7 (${which}) allowlist; token blocks untouched`);
