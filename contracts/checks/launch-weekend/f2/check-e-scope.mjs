#!/usr/bin/env node
// A5 — scope, provenance and token discipline against BASE_REF (default origin/main). Run in the implementation worktree.
//  1. Every changed file (tracked diff + untracked) is on the allowlist; Footer.tsx, footer-data.ts, UtilityBar.tsx,
//     globals.css and all NOS files are therefore untouched.
//  2. No added line under components/chrome introduces a colour literal, font-family or @font-face (Contact's classes are reused).
//  3. Header.tsx and MobileMenu.tsx hold no literal Tickets label/href or Contact label/href: both come from nav-config.
//  4. nav-config.ts exports TICKETS_CTA and CONTACT_LINK, and NAV itself has no 'contact' entry (the NOS chrome maps NAV and
//     appends its own Contact, so a NAV entry would render Contact twice there).
// Usage: node contracts/checks/launch-weekend/f2/check-e-scope.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { GOLDEN_DIR, report } from './_lib.mjs';

const cfg = JSON.parse(readFileSync(`${GOLDEN_DIR}/scope-allowlist.json`, 'utf8'));
const base = process.env[cfg.baseRefEnv] || cfg.baseRefDefault;
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const problems = [];
try { git('rev-parse', '--verify', base); } catch { console.error(`INFRA: base ref ${base} not found`); process.exit(2); }

const changed = new Set([...git('diff', '--name-only', base).split('\n'), ...git('ls-files', '--others', '--exclude-standard').split('\n')].filter(Boolean));
const allowed = cfg.allowed.map((r) => new RegExp(r));
for (const f of changed) if (!allowed.some((r) => r.test(f))) problems.push(`out-of-scope change: ${f}`);

const literal = new RegExp(cfg.colourOrTypeLiteral);
const checked = new RegExp(cfg.literalCheckedPaths);
for (const f of changed) {
  if (!checked.test(f)) continue;
  let added = [];
  try { added = git('diff', '-U0', base, '--', f).split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')); } catch { /* untracked */ }
  if (!added.length) { try { added = readFileSync(f, 'utf8').split('\n').map((l) => '+' + l); } catch { added = []; } }
  for (const l of added) if (literal.test(l)) problems.push(`${f}: added line introduces a colour/type literal: ${l.slice(1).trim().slice(0, 100)}`);
}

for (const f of cfg.noLiteralIn) {
  let src = '';
  try { src = readFileSync(f, 'utf8'); } catch { problems.push(`${f}: unreadable`); continue; }
  for (const p of cfg.noLiteralPatterns) if (new RegExp(p).test(src)) problems.push(`${f}: hardcodes /${p}/ - label and href must come from nav-config`);
}
let nav = '';
try { nav = readFileSync('components/chrome/nav-config.ts', 'utf8'); } catch { problems.push('nav-config.ts unreadable'); }
for (const e of cfg.navConfigMustExport) if (!nav.includes(e)) problems.push(`nav-config.ts lacks "${e}"`);
for (const p of cfg.navConfigMustNotContain) if (new RegExp(p).test(nav)) problems.push(`nav-config.ts NAV contains /${p}/ (would double Contact on the NOS chrome)`);

report(problems, `${changed.size} changed file(s) in scope against ${base}; CTA and Contact sourced from nav-config`);
