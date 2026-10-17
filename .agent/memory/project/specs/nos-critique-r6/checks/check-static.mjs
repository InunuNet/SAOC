// nos-critique-r6 F1 — static source check for R65 ("Body text should be standard across both sites";
// value 16px / 1.55 from design/design_handoff_saoc/design_system_README.md l.100). Content-based, no line numbers.
//   T1  nos-theme.css: `line-height: 1.65;` -> `1.55;` and `--fs-body: 1.0625rem;` -> `1rem;` made, old values gone.
//   T2  presenters.css differs from BASE only by 1.65 -> 1.55, --pc-bio-lh 1.68 -> 1.55 (bios render at 26.88px otherwise) and the stale 1.0625rem fallback / 17px comment.
//   T3  no 1.65 and no 1.0625rem anywhere in NOS scope (comments excluded).
//   T4  text-[17px] survives only on the allowlisted serif titles (same line carries font-serif).
//   T5  every sans text-[12..15px] line in NOS scope .tsx is allowlisted (label/meta/link/control) or a tracked-caps
//       label (uppercase / font-mono); anything else is prose and must be at the body role.
//   T6  every body-role line (text-[16px] or var(--fs-body) on a non-serif element) carries leading-[1.55] and no other
//       leading-* (relaxed / snug / normal / loose / [1.5] / [1.65]).
//   T7  the 17px body files route through text-[length:var(--fs-body,1rem)] (minimum counts in the allowlist file).
//   T8  no copy string added, removed or changed in any changed .tsx file; docs cite R65.
//
// Run as: node check-static.mjs   (NOS_CR6_ROOT selects the worktree, NOS_CR6_GIT the base history)
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { DOC, NOS_THEME, PRESENTERS, copyStrings, finish, git, readBaseFile, readRepoFile, scopeFiles, specDir, stripComments, BASE } from './_lib.mjs';

const NAME = 'check-static.mjs';
const failures = [];
const fail = (m) => failures.push(m);
const allow = JSON.parse(readFileSync(path.join(specDir, 'goldens', 'small-text-allowlist.json'), 'utf8'));

// ---- T1 ----
{
  const base = readBaseFile(NOS_THEME);
  const now = readRepoFile(NOS_THEME);
  if (base === null || now === null) fail(`${NOS_THEME} missing`);
  else {
    // Stacked contracts f3 (form-label class) and f5 (hero stacking) also edit nos-theme.css, so T1 is a
    // presence check: both R65 substitutions made, the old values gone. check-footprint.mjs and the f3/f5
    // static checks police what else may change there.
    const want = base.replace('\n  line-height: 1.65;\n', '\n  line-height: 1.55;\n').replace('\n  --fs-body: 1.0625rem;\n', '\n  --fs-body: 1rem;\n');
    if (want === base) fail(`${NOS_THEME}: BASE no longer has the two cleared lines; re-read the contract`);
    else {
      if (!/\n  line-height: 1\.55;\n/.test(now)) fail(`${NOS_THEME}: "line-height: 1.65;" must become "1.55;" (T1)`);
      if (!/\n  --fs-body: 1rem;\n/.test(now)) fail(`${NOS_THEME}: "--fs-body: 1.0625rem;" must become "1rem;" (T1)`);
      if (/\n  line-height: 1\.65;\n|--fs-body: 1\.0625rem/.test(now)) fail(`${NOS_THEME}: the 1.65 / 1.0625rem values must be gone (T1)`);
    }
  }
}
// ---- T2 ----
{
  const base = readBaseFile(PRESENTERS);
  const now = readRepoFile(PRESENTERS);
  if (base === null || now === null) fail(`${PRESENTERS} missing`);
  else {
    const norm = (s) => s.replace(/1\.65/g, '1.55').replace(/--pc-bio-lh: 1\.68;/g, '--pc-bio-lh: 1.55;').replace(/1\.0625rem/g, '1rem').replace(/17px/g, '16px');
    if (norm(base) !== norm(now)) fail(`${PRESENTERS}: only 1.65 -> 1.55 (and the stale 1.0625rem fallback / 17px comment) may change`);
    if (!/line-height:\s*1\.55;/.test(now)) fail(`${PRESENTERS}: the .nos-presenters line-height must be 1.55`);
    if (!/--pc-bio-lh:\s*1\.55;/.test(now)) fail(`${PRESENTERS}: --pc-bio-lh must be 1.55 (the bios use it; R65 standard body leading)`);
  }
}

// ---- per-file rules ----
const files = scopeFiles();
const entriesFor = (rel) => allow.entries.filter((e) => e.file === rel);
const serif17For = (rel) => allow.serif17.filter((e) => e.file === rel);
const LEADING = /(?<![\w-])leading-(?:\[[^\]]+\]|none|tight|snug|normal|relaxed|loose|\d+)(?![\w-])/g;

for (const rel of files) {
  const raw = readRepoFile(rel);
  const code = stripComments(raw);
  if (/\b1\.65\b|1\.0625rem/.test(code)) fail(`${rel}: still contains 1.65 or 1.0625rem (T3)`);
  if (!rel.endsWith('.tsx')) continue;
  const lines = code.split('\n');
  lines.forEach((line) => {
    const t = line.trim();
    if (!t) return;
    // T4
    if (/\btext-\[17px\]/.test(t)) {
      const ok = /font-serif/.test(t) && serif17For(rel).some((e) => t.includes(e.contains));
      if (!ok) fail(`${rel}: text-[17px] outside the serif allowlist (T4): ${t.slice(0, 110)}`);
    }
    // T5
    if (/\btext-\[1[2-5](?:\.\d+)?px\]/.test(t) ) {
      const exempt = /\buppercase\b|\bfont-mono\b/.test(t) || entriesFor(rel).some((e) => t.includes(e.contains));
      if (!exempt) fail(`${rel}: sub-body size on what is not allowlisted label/meta/link/control, so it is prose and must be 16px (T5): ${t.slice(0, 110)}`);
    }
    // T6
    if (/\btext-\[16px\]|\btext-\[length:var\(--fs-body/.test(t) && !/font-serif/.test(t)) {
      const lead = t.match(LEADING) ?? [];
      if (lead.length !== 1 || lead[0] !== 'leading-[1.55]') fail(`${rel}: body-role line must carry exactly leading-[1.55], found ${JSON.stringify(lead)} (T6): ${t.slice(0, 110)}`);
    }
  });
}

// ---- T7 ----
for (const [rel, min] of Object.entries(allow.routed)) {
  if (rel === 'comment') continue;
  const code = stripComments(readRepoFile(rel) ?? '');
  const n = (code.match(/text-\[length:var\(--fs-body,1rem\)\]/g) ?? []).length;
  if (n < min) fail(`${rel}: ${n} use(s) of text-[length:var(--fs-body,1rem)], want >= ${min} (T7: route the body role through the one token)`);
}

// ---- T8 ----
let changed = [];
try {
  changed = [git('diff', '--name-only', BASE), git('ls-files', '--others', '--exclude-standard')].join('\n').split('\n').map((l) => l.trim()).filter((p) => p.endsWith('.tsx'));
} catch (e) {
  fail(`could not list changed files: ${e.message}`);
}
for (const rel of changed) {
  const base = readBaseFile(rel);
  const now = readRepoFile(rel);
  if (base === null || now === null) continue;
  const SAOC_SYMP = 'components/show/ShowSectionNav.tsx'; // f10 rename, Brad naming ruling: "SAOC Symposium" -> "National Orchid Show Symposium", nothing else
  const fix = (strs) => (rel === SAOC_SYMP ? strs.map((t) => t.split('SAOC Symposium').join('National Orchid Show Symposium')) : strs);
  if (fix(copyStrings(base)).sort().join('\n') !== copyStrings(now).sort().join('\n')) fail(`${rel}: copy strings changed; R65 is class-only (no invention)`);
}
const doc = readRepoFile(DOC);
if (doc === null) fail(`${DOC} missing`);
else {
  if (!/R65/.test(doc)) fail(`${DOC} must cite R65`);
  if (!/16px\s*\/\s*1\.55/.test(doc)) fail(`${DOC} must state the value "16px / 1.55" and quote design_system_README.md`);
  if (!/prose/i.test(doc) || !/label/i.test(doc)) fail(`${DOC} must classify the 12-15px hits as prose or label`);
}

finish(NAME, failures, `R65: nos-theme two-line edit, presenters 1.55, no 1.65 / 1.0625rem, 17px only on allowlisted serif titles, every sub-body sans line allowlisted, body lines at leading-[1.55], ${files.length} scope files, copy unchanged, docs present.`);
