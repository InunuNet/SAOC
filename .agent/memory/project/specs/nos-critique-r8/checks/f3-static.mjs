// nos-critique-r8 f3 static: define --green-1 and --green-2 (nos-v4 index.html:19-20) and drop the inline --green-1 fallback.
//   S1  nos-theme.css defines --green-1: #a7a841 and --green-2: #7f7d33 in the rule that holds --ink-700 / --gold, with a comment naming --green and citing nos-v4 index.html
//   S2  the nos-theme.css diff vs BASE adds only --green* declarations, comment lines and blanks, and removes nothing
//   S3  ShowHoldingNote.tsx uses var(--green-1) with NO inline fallback
//   S4  every var(--x) under components/show, components/nos and the national-show tree is defined (here, nos-chrome css, globals.css) or a listed next/font variable;
//       the grandfathered fallback set is now only --nos-hero-pos (--green-1 is no longer grandfathered) plus main F18b's --fs-sm/--fs-base/--fs-lg/--nk-field in nos-structure.css (BASE 81490e7a);
//       no token defined by the theme carries an inline fallback
import { NS, finish, git, readBaseFile, readRepoFile, stripComments } from './_lib.mjs';

const failures = [];
const fail = (m) => failures.push(m);
const NEXT_FONT_VARS = new Set(['--font-nos-fraunces', '--font-nos-karla']); // injected by next/font at layout, not declared in source css
const PREEXISTING_FALLBACK = new Set(['--nos-hero-pos']); // set by NosHero's inline style
const TOKENS = { '--green-1': '#a7a841', '--green-2': '#7f7d33' }; // nos-v4 index.html:19-20
const NO_FALLBACK = new Set(['--gold', '--gold-100', '--gold-300', ...Object.keys(TOKENS)]);
const THEME = `${NS}/nos-theme.css`;

const css = readRepoFile(THEME);
const base = readBaseFile(THEME);
if (css === null || base === null) fail(`${THEME} is missing at HEAD or BASE`);
else {
  const at = css.indexOf('--ink-700:');
  const open = css.lastIndexOf('{', at);
  const close = css.indexOf('}', at);
  const block = at < 0 ? '' : css.slice(open, close);
  if (!block) fail('--ink-700 not found in nos-theme.css (S1)');
  for (const [k, v] of Object.entries(TOKENS)) {
    const m = block.match(new RegExp(`${k}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
    if (!m) fail(`${k} must be declared in the rule that holds --ink-700 (S1)`);
    else if (m[1].toLowerCase() !== v) fail(`${k} is ${m[1]}, want ${v} (S1)`);
  }
  if (!(block.match(/\/\*[^]*?\*\//g) ?? []).some((c) => /--green/.test(c) && /index\.html/.test(c))) fail('a comment in that rule must name --green and cite nos-v4 index.html (S1)');
  const baseCount = new Map();
  for (const l of base.split('\n')) baseCount.set(l, (baseCount.get(l) ?? 0) + 1);
  const extra = [];
  for (const l of css.split('\n')) { const n = baseCount.get(l) ?? 0; if (n > 0) baseCount.set(l, n - 1); else extra.push(l.trim()); }
  if ([...baseCount.values()].some((n) => n > 0)) fail('nos-theme.css removes BASE lines (S2)');
  const OK = /^(--green-[12]:\s*#[0-9a-fA-F]{6};|\/\*.*|\*.*|.*\*\/|)$/;
  for (const l of extra) if (!OK.test(l)) fail(`unexpected added line in nos-theme.css: "${l.slice(0, 80)}" (S2)`);
}
const note = readRepoFile('components/show/ShowHoldingNote.tsx');
if (note === null) fail('components/show/ShowHoldingNote.tsx is missing (S3)');
else {
  const code = stripComments(note);
  if (!/var\(--green-1\)/.test(code)) fail('ShowHoldingNote.tsx must use var(--green-1) (S3)');
  if (/var\(--green-1\s*,/.test(code)) fail('ShowHoldingNote.tsx still carries the inline --green-1 fallback (S3)');
}

const list = (...p) => git('ls-files', '--cached', '--others', '--exclude-standard', '--', ...p).split('\n').filter(Boolean);
const scan = list('components/show', 'components/nos', NS).filter((f) => /\.(tsx?|css)$/.test(f));
const defFiles = [...scan, ...list('components/nos-chrome').filter((f) => f.endsWith('.css')), 'app/globals.css'];
const defs = new Set();
for (const f of defFiles) {
  const s = readRepoFile(f);
  if (s !== null) for (const m of s.matchAll(/(--[\w-]+)\s*:/g)) defs.add(m[1]);
}
// Re-base onto 81490e7a (lead ruling): main's F18b brought fallback-only uses of undefined tokens into nos-structure.css, which r8 does not touch. Exactly those uses (file + var)
// are grandfathered and logged as a main defect in the backlog; any other fallback-without-definition, in any file, still fails.
const BASE_FALLBACK = new Set(['--fs-sm', '--fs-base', '--fs-lg', '--nk-field'].map((v) => `${NS}/nos-structure.css ${v}`));
const baseFallback = (f, v) => BASE_FALLBACK.has(`${f} ${v}`);
const used = new Map();
for (const f of scan) {
  const raw = readRepoFile(f);
  if (raw === null) continue;
  const code = f.endsWith('.css') ? raw.replace(/\/\*[^]*?\*\//g, '') : stripComments(raw);
  for (const m of code.matchAll(/var\(\s*(--[\w-]+)\s*(,)?/g)) {
    const entries = used.get(m[1]) ?? [];
    entries.push({ f, fallback: !!m[2] });
    used.set(m[1], entries);
  }
}
for (const [v, uses] of used) {
  const where = [...new Set(uses.map((u) => u.f.split('/').pop()))].join(', ');
  if (uses.some((u) => u.fallback) && NO_FALLBACK.has(v)) fail(`${v} carries an inline fallback in ${where}; the token is defined now, remove the fallback (S4)`);
  else if (uses.some((u) => u.fallback && !baseFallback(u.f, v)) && !PREEXISTING_FALLBACK.has(v) && !defs.has(v)) fail(`var(${v}, ...) has a fallback and no definition (${where}) (S4)`);
  if (uses.some((u) => !u.fallback) && !defs.has(v) && !NEXT_FONT_VARS.has(v)) fail(`var(${v}) is used in ${where} and defined nowhere (S4)`);
}

finish('f3-static.mjs', failures, 'nos-theme.css defines --green-1 #a7a841 and --green-2 #7f7d33 with a v4 citation, only token and comment lines added, the inline --green-1 fallback is gone, every var(--x) in the NOS trees is defined.');
