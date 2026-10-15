// nos-critique-r1 F1 — presenters focus per R9, Codi 2026-10-16 verbatim: "a solid 2px ring
// with a 2px offset, royal on light grounds and gold on dark ones. Remove --pc-violet and the
// 3px offset. The presenters handoff doesn't override R9." (golden §4)
//
// The ring itself is painted by `.nos-theme :focus-visible:not(.group)` (nos-theme.css:245,
// specificity 0,3,0, 2px solid var(--ring-focus), offset 2px). It already beats
// `.nos-presenters :focus-visible` (0,2,0), so presenters.css re-points the ground-resolved
// alias instead: `.nos-presenters { --ring-focus: var(--pc-royal); }`. Dark grounds keep the
// theme's `.nos-on-dark` flip to pale gold. presenters.css declares no outline of its own.
// --pc-violet stays for .pc-role and .pc-more (Codi's reference render), not for focus.
//
// Run as: node contracts/checks/nos-critique-r1/check-presenters-focus.mjs
import { FILES, finish, readBaseFile, readRepoFile } from './_lib.mjs';

const NAME = 'check-presenters-focus.mjs';
const failures = [];
const rel = FILES.presenters;
const raw = readRepoFile(rel);
if (!raw) finish(NAME, [`missing ${rel}`]);
const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');

const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim().replace(/\s+/g, ' '), body: m[2] }));
const focusRules = rules.filter((r) => /:focus(-visible|-within)?\b/.test(r.sel));
for (const r of focusRules) {
  if (/\boutline(-color|-offset|-width|-style)?\s*:/.test(r.body)) failures.push(`"${r.sel}" must not declare outline* — the .nos-theme ring paints it`);
  if (/--pc-violet/.test(r.body)) failures.push(`"${r.sel}" must not use --pc-violet`);
  if (/box-shadow/.test(r.body)) failures.push(`"${r.sel}" must not paint a box-shadow ring (R9/1)`);
}
if (/outline-offset\s*:\s*3px/.test(css)) failures.push('no 3px outline-offset may remain');
const root = rules.find((r) => r.sel === '.nos-presenters');
if (!root) failures.push('.nos-presenters root rule not found');
else {
  if (!/(^|;)\s*--ring-focus\s*:\s*var\(--pc-royal\)\s*;/.test(root.body)) failures.push('.nos-presenters must declare --ring-focus: var(--pc-royal);');
  if (!/--pc-royal\s*:\s*#211A57\s*;/i.test(root.body)) failures.push('--pc-royal must stay #211A57');
  if (!/--pc-violet\s*:\s*#7E3F97\s*;/i.test(root.body)) failures.push('--pc-violet stays declared (#7E3F97) for .pc-role/.pc-more');
}
for (const sel of ['.nos-presenters .pc-role', '.nos-presenters .pc-more']) {
  const r = rules.find((x) => x.sel === sel);
  if (!r || !/(^|;)\s*color\s*:\s*var\(--pc-violet\)/.test(r.body)) failures.push(`${sel} keeps color: var(--pc-violet) (sourced: Codi's reference render)`);
}
if (/--ring-focus-on-light|--ring-focus-on-dark/.test(css)) failures.push('presenters.css must not redefine the theme-level ring tokens');

// Every other line is unchanged from base: only the focus line and the root block may differ.
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.trim()).filter(Boolean);
const before = strip(readBaseFile(rel));
const after = strip(raw);
const added = after.filter((l) => !before.includes(l));
const removed = before.filter((l) => !after.includes(l));
const ok = (l) => /^--ring-focus:\s*var\(--pc-royal\);$/.test(l) || /^\.nos-presenters :focus-visible\s*\{/.test(l);
for (const l of [...added, ...removed]) if (!ok(l)) failures.push(`unexpected change in presenters.css: ${JSON.stringify(l)}`);

finish(NAME, failures, 'presenters focus uses the R9 ring (2px solid, 2px offset) with --ring-focus re-pointed to royal; --pc-violet and the 3px offset are gone from focus.');
