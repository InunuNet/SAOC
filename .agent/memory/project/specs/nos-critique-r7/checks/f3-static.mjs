// nos-critique-r7 f3 static: the missing --gold tokens (found by the F1 dev at 1f8ad3de; the r6 disclosure surfaces had no gold fill).
//   S1  nos-theme.css defines --gold: #f3f2d6 and --gold-100: #fbfaf0 in the rule that holds --ink-700 / --ink-500 (nos-v4 index.html:16-17)
//   S2  a comment in that rule cites nos-v4 index.html
//   S3  the nos-theme.css diff vs BASE adds only --gold* declarations, comment lines, blanks (and F2's one text-wrap line) and removes nothing
//   S4  --gold-300 (#e8e6c2) is defined only if something uses it, and is then #e8e6c2
//   S5  every var(--x) under components/show, components/nos and the national-show tree is defined (here, in nos-chrome css or globals.css) or is a listed
//       next/font variable; a var() with a fallback must be one of the pre-existing two; --gold / --gold-100 / --gold-300 never carry an inline fallback
import { NS, finish, git, readBaseFile, readRepoFile, stripComments } from './_lib.mjs';

const failures = [];
const fail = (m) => failures.push(m);
const NEXT_FONT_VARS = new Set(['--font-nos-fraunces', '--font-nos-karla']); // injected by next/font at layout, not declared in source css
const PREEXISTING_FALLBACK = new Set(['--green-1', '--nos-hero-pos']); // fallbacks present at BASE (ShowHoldingNote, NosHero inline style)
const GOLD = { '--gold': '#f3f2d6', '--gold-100': '#fbfaf0', '--gold-300': '#e8e6c2' };
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
  for (const k of ['--gold', '--gold-100']) {
    const m = block.match(new RegExp(`${k}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
    if (!m) fail(`${k} must be declared in the rule that holds --ink-700 (S1)`);
    else if (m[1].toLowerCase() !== GOLD[k]) fail(`${k} is ${m[1]}, want ${GOLD[k]} (S1)`);
  }
  if (!(block.match(/\/\*[^]*?\*\//g) ?? []).some((c) => /--gold/.test(c) && /index\.html/.test(c))) fail('a comment in that rule must name --gold and cite nos-v4 index.html (S2)');
  const baseCount = new Map();
  for (const l of base.split('\n')) baseCount.set(l, (baseCount.get(l) ?? 0) + 1);
  const extra = [];
  for (const l of css.split('\n')) { const n = baseCount.get(l) ?? 0; if (n > 0) baseCount.set(l, n - 1); else extra.push(l.trim()); }
  if ([...baseCount.values()].some((n) => n > 0)) fail('nos-theme.css removes BASE lines (S3)');
  const OK = /^(--gold(-100|-300)?:\s*#[0-9a-fA-F]{6};|text-wrap: pretty;|\/\*.*|\*.*|.*\*\/|)$/;
  for (const l of extra) if (!OK.test(l)) fail(`unexpected added line in nos-theme.css: "${l.slice(0, 80)}" (S3)`);
  const m300 = block.match(/--gold-300:\s*(#[0-9a-fA-F]{6})\s*;/);
  if (m300 && m300[1].toLowerCase() !== GOLD['--gold-300']) fail(`--gold-300 is ${m300[1]}, want ${GOLD['--gold-300']} (S4)`);
}

const list = (...p) => git('ls-files', '--cached', '--others', '--exclude-standard', '--', ...p).split('\n').filter(Boolean);
const scan = [...list('components/show', 'components/nos', NS)].filter((f) => /\.(tsx?|css)$/.test(f));
const defFiles = [...scan, ...list('components/nos-chrome').filter((f) => f.endsWith('.css')), 'app/globals.css'];
const defs = new Set();
for (const f of defFiles) {
  const s = readRepoFile(f);
  if (s !== null) for (const m of s.matchAll(/(--[\w-]+)\s*:/g)) defs.add(m[1]);
}
const used = new Map();
for (const f of scan) {
  const raw = readRepoFile(f);
  if (raw === null) continue;
  const code = f.endsWith('.css') ? raw.replace(/\/\*[^]*?\*\//g, '') : stripComments(raw);
  for (const m of code.matchAll(/var\(\s*(--[\w-]+)\s*(,)?/g)) {
    const list2 = used.get(m[1]) ?? [];
    list2.push({ f, fallback: !!m[2] });
    used.set(m[1], list2);
  }
}
if (used.has('--gold-300') && !defs.has('--gold-300')) fail('--gold-300 is used but not defined (S4)');
for (const [v, uses] of used) {
  const where = [...new Set(uses.map((u) => u.f.split('/').pop()))].join(', ');
  if (uses.some((u) => u.fallback) && v in GOLD) fail(`${v} carries an inline fallback in ${where}; the token is defined now, remove the fallback (S5)`);
  else if (uses.some((u) => u.fallback) && !PREEXISTING_FALLBACK.has(v) && !defs.has(v)) fail(`var(${v}, ...) has a fallback and no definition (${where}) (S5)`);
  if (uses.some((u) => !u.fallback) && !defs.has(v) && !NEXT_FONT_VARS.has(v)) fail(`var(${v}) is used in ${where} and defined nowhere (S5)`);
}

finish('f3-static.mjs', failures, 'nos-theme.css defines --gold #f3f2d6 and --gold-100 #fbfaf0 with a v4 citation, only token/comment lines added, every var(--x) in the NOS trees is defined, no inline gold fallbacks.');
