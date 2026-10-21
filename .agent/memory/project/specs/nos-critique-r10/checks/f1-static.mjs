// nos-critique-r10 f1 static: define the three type-scale tokens nos-structure.css (main F18b) reads with a fallback only, from the nos-v4 golden, and drop those fallbacks.
//   S1  nos-theme.css declares --fs-sm: 0.875rem, --fs-base: 1rem and --fs-lg: 1.5625rem in the .nos-theme rule that holds --fs-body, with a comment that names --fs- and cites
//       nos-v4 plan-your-visit.html (goldens/f1-spec.md: the values equal the fallbacks, so nothing moves)
//   S2  the nos-theme.css diff vs BASE adds only those three declarations, comment lines and blanks, and removes nothing
//   S3  nos-structure.css equals BASE with exactly its five var(--fs-sm|--fs-base|--fs-lg, <fallback>) reduced to var(--fs-x): no other byte changes (the --nk-field fallback stays: the
//       token is set inline on every .nk-stub by components/tickets/keepsake/parts.tsx)
//   S4  every var(--x) under components/show, components/nos, components/tickets, the national-show tree and app/(marketing)/tickets is defined: declared in that CSS/TSX, in the
//       nos-chrome css or app/globals.css, or set as an inline custom property ('--x': ...) there; next/font variables only. No fallback allowlist: PREEXISTING_FALLBACK is empty.
//   S5  docs/nos-critique-r10.md exists
import { DOC, NS, finish, git, readBaseFile, readRepoFile, stripComments } from './_lib.mjs';

const failures = [];
const fail = (m) => failures.push(m);
const THEME = `${NS}/nos-theme.css`;
const STRUCTURE = `${NS}/nos-structure.css`;
// nos-v4 plan-your-visit.html :root (in-project copy .agent/memory/project/specs/nos-critique-r6/goldens/f7-v4-plan-your-visit.html:38, :39, :42).
const TOKENS = { '--fs-sm': '0.875rem', '--fs-base': '1rem', '--fs-lg': '1.5625rem' };
const NEXT_FONT_VARS = new Set(['--font-nos-fraunces', '--font-nos-karla']); // injected by next/font at layout, not declared in source css
const FS_FALLBACK_USES = 5; // nos-structure.css at BASE: :771 --fs-sm, :1347 --fs-lg, :1354 :1535 :1572 --fs-base (the sixth fallback, :882 --nk-field, stays)
const stripCss = (s) => s.replace(/\/\*[^]*?\*\//g, '');

const css = readRepoFile(THEME);
const base = readBaseFile(THEME);
if (css === null || base === null) fail(`${THEME} is missing at HEAD or BASE`);
else {
  const at = css.indexOf('--fs-body:');
  const block = at < 0 ? '' : css.slice(css.lastIndexOf('{', at), css.indexOf('}', at));
  if (!block) fail('--fs-body not found in nos-theme.css (S1)');
  if (!/^\.nos-theme\s*$/.test(css.slice(css.lastIndexOf('}', css.lastIndexOf('{', at)) + 1, css.lastIndexOf('{', at)).trim())) fail('the rule holding --fs-body must be .nos-theme (S1)');
  for (const [k, v] of Object.entries(TOKENS)) {
    const m = stripCss(block).match(new RegExp(`${k}:\\s*([^;]+);`));
    if (!m) fail(`${k} must be declared in the .nos-theme rule that holds --fs-body (S1)`);
    else if (m[1].trim() !== v) fail(`${k} is ${m[1].trim()}, want ${v} (nos-v4) (S1)`);
  }
  if (!(block.match(/\/\*[^]*?\*\//g) ?? []).some((c) => /--fs-/.test(c) && /plan-your-visit\.html/.test(c) && /v4/.test(c))) fail('a comment in that rule must name --fs- and cite nos-v4 plan-your-visit.html (S1)');
  const baseCount = new Map();
  for (const l of base.split('\n')) baseCount.set(l, (baseCount.get(l) ?? 0) + 1);
  const extra = [];
  for (const l of css.split('\n')) { const n = baseCount.get(l) ?? 0; if (n > 0) baseCount.set(l, n - 1); else extra.push(l.trim()); }
  if ([...baseCount.values()].some((n) => n > 0)) fail('nos-theme.css removes or edits BASE lines (S2)');
  const OK = /^(--fs-(sm|base|lg):\s*[\d.]+rem;(\s*\/\*.*\*\/)?|\/\*.*|\*.*|.*\*\/|)$/;
  for (const l of extra) if (!OK.test(l)) fail(`unexpected added line in nos-theme.css: "${l.slice(0, 80)}" (S2)`);
}

const st = readRepoFile(STRUCTURE);
const sb = readBaseFile(STRUCTURE);
if (st === null || sb === null) fail(`${STRUCTURE} is missing at HEAD or BASE`);
else {
  const FB = /var\(\s*(--fs-(?:sm|base|lg))\s*,[^)]*\)/g;
  const n = (sb.match(FB) ?? []).length;
  if (n !== FS_FALLBACK_USES) fail(`BASE nos-structure.css has ${n} --fs fallback uses, want ${FS_FALLBACK_USES}: BASE is not the audited d05c85a5 (S3)`);
  if (st !== sb.replace(FB, 'var($1)')) fail('nos-structure.css must equal BASE with only the five --fs fallbacks dropped (S3)');
  if (!/var\(--nk-field, var\(--primary\)\)/.test(st)) fail('the --nk-field fallback stays: it guards the inline per-product setter (S3)');
}

const list = (...p) => git('ls-files', '--cached', '--others', '--exclude-standard', '--', ...p).split('\n').filter(Boolean);
const scan = list('components/show', 'components/nos', 'components/tickets', NS, 'app/(marketing)/tickets').filter((f) => /\.(tsx?|css)$/.test(f));
const defFiles = [...scan, ...list('components/nos-chrome').filter((f) => f.endsWith('.css')), 'app/globals.css'];
const defs = new Set();
for (const f of defFiles) {
  const s = readRepoFile(f);
  if (s !== null) for (const m of (f.endsWith('.css') ? stripCss(s) : stripComments(s)).matchAll(/['"]?(--[\w-]+)['"]?\s*:/g)) defs.add(m[1]);
}
const undefinedUses = new Map();
for (const f of scan) {
  const raw = readRepoFile(f);
  if (raw === null) continue;
  const code = f.endsWith('.css') ? stripCss(raw) : stripComments(raw);
  for (const m of code.matchAll(/var\(\s*(--[\w-]+)\s*(,)?/g)) {
    if (defs.has(m[1]) || NEXT_FONT_VARS.has(m[1])) continue;
    undefinedUses.set(m[1], new Set([...(undefinedUses.get(m[1]) ?? []), `${f.split('/').pop()}${m[2] ? ' (fallback)' : ''}`]));
  }
}
for (const [v, where] of undefinedUses) fail(`var(${v}) is used in ${[...where].join(', ')} and defined nowhere (S4)`);
if (readRepoFile(DOC) === null) fail(`${DOC} is missing (S5)`);

finish('f1-static.mjs', failures, 'nos-theme.css defines --fs-sm 0.875rem, --fs-base 1rem, --fs-lg 1.5625rem (nos-v4), nos-structure.css only drops their five fallbacks, and every var(--x) in the NOS and ticket trees is defined, with no fallback allowlist.');
