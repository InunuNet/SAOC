// nos-vendor-apply-form (r55) static check. QA input, hash-locked. Golden: goldens/spec.md (the design), goldens/footprint.json.
//   S1  nos-theme.css holds ONE NOS-scoped control rule, right after the .nos-form-label role: .nos-theme :is(input, select, textarea) minus
//       checkbox/radio/file/hidden, font-size var(--body-md) (the existing 16px token). No per-component text-[15px] edit.
//   S2  nos-chrome.css: the footer newsletter input (.nf-form input) no longer sets 15px and takes var(--body-md).
//   S3  the vendor apply page gives its NosSection paddingBlockStart var(--space-7) (48px) inline: no new CSS, no section-wide change.
//   S4  VendorFormField takes an optional inputClassName appended to the field classes; VendorApplyForm passes "max-w-[12ch]" to the
//       indicativeBoothCount field only.
//   S5  no invention: the added lines carry no colour literal, no custom-property declaration, no font-family, no new copy (no JSX text, no
//       new string other than the class names above), and the TSX diff stays small.
//   S6  docs/nos-vendor-apply-form.md records r55.
import { finish, git, readBaseFile, readRepoFile, BASE, DOC } from './_lib.mjs';

const failures = [];
const CSS_THEME = 'app/(marketing)/national-show/nos-theme.css';
const CSS_CHROME = 'components/nos-chrome/nos-chrome.css';
const PAGE = 'app/(marketing)/national-show/vendors/apply/page.tsx';
const FIELD = 'components/vendors/VendorFormField.tsx';
const FORM = 'components/vendors/VendorApplyForm.tsx';
const need = (rel) => {
  const t = readRepoFile(rel);
  if (t === null) failures.push(`${rel} is missing`);
  return t ?? '';
};

// S1
const theme = need(CSS_THEME);
const labelAt = theme.indexOf('.nos-theme .nos-form-label {');
const ruleRe = /\.nos-theme\s+:is\(\s*input\s*,\s*select\s*,\s*textarea\s*\)\s*:not\(([^)]*)\)\s*\{([^}]*)\}/;
const rule = ruleRe.exec(theme);
if (!rule) failures.push(`S1: no ".nos-theme :is(input, select, textarea):not(...) { ... }" rule in ${CSS_THEME}`);
else {
  for (const t of ['checkbox', 'radio', 'file', 'hidden']) if (!new RegExp(`\\[type=['"]?${t}['"]?\\]`).test(rule[1])) failures.push(`S1: the rule does not exclude [type=${t}]`);
  const decls = rule[2].split(';').map((d) => d.trim()).filter(Boolean);
  if (decls.length !== 1 || !/^font-size:\s*var\(--body-md\)$/.test(decls[0])) failures.push(`S1: the rule must hold exactly "font-size: var(--body-md)", has: ${decls.join('; ')}`);
  if (labelAt === -1 || rule.index < labelAt) failures.push('S1: the rule must follow the .nos-form-label role block');
  if (theme.split(':is(input, select, textarea)').length !== 2) failures.push('S1: the control rule is declared more than once');
}

// S2
const chrome = need(CSS_CHROME);
const nf = /^\.nf-form input \{([^}]*)\}/m.exec(chrome);
if (!nf) failures.push('S2: ".nf-form input { ... }" not found in nos-chrome.css');
else {
  if (/\b15px\b/.test(nf[1])) failures.push('S2: .nf-form input still sets 15px');
  if (!/font:[^;]*var\(--body-md\)[^;]*var\(--nc-sans\)|font-size:\s*var\(--body-md\)/.test(nf[1])) failures.push('S2: .nf-form input must take var(--body-md) (font shorthand with var(--nc-sans), or font-size)');
}

// S3
const page = need(PAGE);
if (!/<NosSection\b[^>]*style=\{\{\s*paddingBlockStart:\s*['"]var\(--space-7\)['"]\s*\}\}[^>]*>/.test(page)) failures.push('S3: the apply page NosSection lacks style={{ paddingBlockStart: \'var(--space-7)\' }}');
if ((page.match(/<NosSection\b/g) ?? []).length !== 1) failures.push('S3: the apply page must keep exactly one NosSection');

// S4
const field = need(FIELD);
if (!/inputClassName\?:\s*string/.test(field)) failures.push('S4: VendorFormField has no optional inputClassName?: string prop');
if (!/inputClassName/.test(field.replace(/inputClassName\?:\s*string/, ''))) failures.push('S4: VendorFormField never uses inputClassName');
const form = need(FORM);
const uses = form.match(/inputClassName=/g) ?? [];
if (uses.length !== 1) failures.push(`S4: VendorApplyForm must pass inputClassName exactly once, passes ${uses.length}`);
const block = /<VendorFormField\s+fieldKey="indicativeBoothCount"[\s\S]*?\/>/.exec(form);
if (!block || !/inputClassName="max-w-\[12ch\]"/.test(block[0])) failures.push('S4: the indicativeBoothCount field must carry inputClassName="max-w-[12ch]"');

// S5
const files = [CSS_THEME, CSS_CHROME, PAGE, FIELD, FORM];
let tsxAdded = 0;
for (const rel of files) {
  const diff = git('diff', '-U0', BASE, '--', rel);
  const added = diff.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1));
  const isCss = rel.endsWith('.css');
  if (!isCss) tsxAdded += added.length;
  // A changed one-line rule keeps its old tokens: judge only the tokens the diff introduces.
  const removed = new Set(diff.split('\n').filter((l) => l.startsWith('-') && !l.startsWith('---')).flatMap((l) => l.slice(1).split(/\s+/)));
  for (const full of added) {
    const l = full.split(/\s+/).filter((tok) => !removed.has(tok)).join(' ');
    if (/#[0-9a-fA-F]{3,8}\b/.test(l)) failures.push(`S5: colour literal added in ${rel}: ${l.trim()}`);
    if (isCss && /^\s*--[\w-]+\s*:/.test(l)) failures.push(`S5: custom property declared in ${rel}: ${l.trim()}`);
    if (isCss && /font-family|@font-face|rgba?\(|\bhsl/.test(l)) failures.push(`S5: font/colour added in ${rel}: ${l.trim()}`);
    if (!isCss && />\s*[A-Za-z][^<>{}]*</.test(l) && !/=>/.test(l)) failures.push(`S5: JSX text added in ${rel}: ${l.trim()}`);
  }
}
if (tsxAdded > 14) failures.push(`S5: the TSX diff adds ${tsxAdded} lines (limit 14)`);
if (readBaseFile(FIELD) !== null && (readRepoFile(FIELD) ?? '').includes('text-[16px]')) failures.push('S5: per-component text-[16px] edit in VendorFormField: the shared rule does the job');

// S6
const doc = readRepoFile(DOC);
if (doc === null) failures.push(`S6: ${DOC} is missing`);
else for (const t of ['r55', '--body-md', '--space-7', '12ch']) if (!doc.includes(t)) failures.push(`S6: ${DOC} does not mention ${t}`);

finish('static.mjs', failures, 'one shared 16px control rule, footer input, 48px section top, 12ch stands field, no invention, docs present.');
