#!/usr/bin/env node
// A5 — byte identity outside the change and token discipline. Run from the implementation worktree.
//  1. Every file differing from BASE_REF (tracked diff + untracked) is on the scope allowlist.
//  2. No added line in app/ or components/ introduces a colour literal, font-family, @font-face or next/font:
//     colour and type come from existing tokens.
//  3. The :root and @theme blocks of app/globals.css are byte-identical to BASE_REF.
//  4. A @media (prefers-reduced-motion: reduce) block exists in app/globals.css (runtime effect: A3).
// Usage: node contracts/checks/launch-weekend/f1/check-e-scope.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { GOLDEN_DIR, report } from './_lib.mjs';

const cfg = JSON.parse(readFileSync(`${GOLDEN_DIR}/scope-allowlist.json`, 'utf8'));
const base = process.env[cfg.baseRefEnv] || cfg.baseRefDefault;
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const problems = [];

try { git('rev-parse', '--verify', base); } catch { console.error(`INFRA: base ref ${base} not found`); process.exit(2); }
const changed = new Set([
  ...git('diff', '--name-only', base).split('\n'),
  ...git('ls-files', '--others', '--exclude-standard').split('\n'),
].filter(Boolean));
const allowed = cfg.allowed.map((r) => new RegExp(r));
for (const f of changed) if (!allowed.some((r) => r.test(f))) problems.push(`out-of-scope change: ${f}`);

const literal = new RegExp(cfg.colourOrTypeLiteral);
const checked = new RegExp(cfg.literalCheckedPaths);
for (const f of changed) {
  if (!checked.test(f)) continue;
  let added;
  try { added = git('diff', '-U0', base, '--', f).split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')); }
  catch { added = []; }
  if (!added.length) { try { added = readFileSync(f, 'utf8').split('\n').map((l) => '+' + l); } catch { added = []; } } // untracked file
  for (const l of added) if (literal.test(l)) problems.push(`${f}: added line introduces a colour/type literal: ${l.slice(1).trim().slice(0, 100)}`);
}

const block = (css, opener) => { const m = css.match(new RegExp(opener.replace('^', '(?:^|\\n)'))); if (!m) return null; const s = m.index + (m[0].startsWith('\n') ? 1 : 0); let d = 0; for (let i = css.indexOf('{', s); i < css.length; i++) { if (css[i] === '{') d++; if (css[i] === '}' && --d === 0) return css.slice(s, i + 1); } return null; };
const baseCss = git('show', `${base}:app/globals.css`);
const nowCss = readFileSync('app/globals.css', 'utf8');
for (const opener of cfg.tokenBlocksUnchanged) if (block(baseCss, opener) !== block(nowCss, opener)) problems.push(`app/globals.css: block ${opener} differs from ${base}`);
if (!/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/.test(nowCss)) problems.push('app/globals.css has no @media (prefers-reduced-motion: reduce) block');

report(problems, `${changed.size} changed file(s) all in scope against ${base}; tokens untouched; no colour/type literals`);
