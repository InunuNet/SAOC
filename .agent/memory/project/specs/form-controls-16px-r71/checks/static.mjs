// form-controls-16px-r71 static. QA input, hash-locked. Goldens: goldens/controls.json (the control inventory), goldens/footprint.json.
// Admin surfaces that need a real session cannot be rendered, and the read-only link inputs of VendorPaymentLinkControl / VendorPhotoLinkControl only
// mount after an authenticated POST: this check is what covers them (the resolved className must give >= 16px and pin the line-height).
//   S1  inventory: the set of .tsx files under app/ and components/ that render a text-entry control equals goldens/controls.json (a new component fails here
//       until it is classified, which is how the class cannot come back unnoticed).
//   S2  own files: every text-entry control's resolved className (string, const, or template of consts) computes >= 16px; requireLeading files pin a leading-*.
//   S3  nos-rule files: the unlayered r55 rule is intact and --body-md is still 16px; prop mounts still pass a 16px class.
//   S4  class-only: each changed file equals its base copy once text-size/leading tokens are removed, and changes at most 2 lines per control tag.
//   S5  no invention: no CSS/token file touched, no new custom property, no hex colour added; docs/form-controls-16px-r71.md exists and states the limits.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { DOC, changedPaths, finish, git, goldenJson, readBaseFile, readRepoFile, repoRoot, SPEC_PREFIX } from './_lib.mjs';

const C = goldenJson('controls.json');
const failures = [];
const NON_TEXT = ['hidden', 'checkbox', 'radio', 'file', 'button', 'submit', 'reset', 'image', 'range', 'color'];

function walkTsx(dir, out = []) {
  for (const e of readdirSync(path.join(repoRoot, dir), { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) walkTsx(rel, out);
    else if (e.name.endsWith('.tsx')) out.push(rel);
  }
  return out;
}

/** Opening tags of every <input|select|textarea> in `src` (brace-aware, so arrow functions in attributes do not end the tag). */
function controlTags(src) {
  const tags = [];
  const re = /<(input|select|textarea)\b/g;
  let m;
  while ((m = re.exec(src))) {
    const lineStart = src.lastIndexOf('\n', m.index) + 1;
    if (/^\s*(\/\/|\*|\/\*)/.test(src.slice(lineStart, m.index))) continue; // a comment that mentions a tag
    let depth = 0;
    let j = m.index;
    for (; j < src.length; j++) {
      const c = src[j];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0 && src[j - 1] !== '=') break;
    }
    const text = src.slice(m.index, j + 1).replace(/\s+/g, ' ');
    const type = (text.match(/\btype="(\w+)"/) ?? [])[1] ?? (m[1] === 'input' ? 'text' : m[1]);
    if (m[1] === 'input' && NON_TEXT.includes(type)) continue;
    tags.push({ text, line: src.slice(0, m.index).split('\n').length, honeypot: text.includes(`name="${C.honeypotName}"`) });
  }
  return tags;
}

/** The string a const holds (single-quoted, double-quoted or template, possibly on the next line). */
function constValue(src, name) {
  const m = src.match(new RegExp(`(?:const|let)\\s+${name}\\s*=\\s*([\\s\\S]*?);`));
  return m ? m[1] : null;
}

/** The class text an element carries: its className literal, or the consts / template parts it references. */
function resolvedClass(src, tagText) {
  const attr = tagText.match(/className=("[^"]*"|\{[^]*?\}(?=\s+[a-zA-Z]+=|\s*\/?>))/);
  if (!attr) return null;
  let text = attr[1];
  const seen = new Set();
  const expand = (s) => {
    let out = s;
    for (const id of s.matchAll(/\$\{(\w+)\}|^\{(\w+)\}$/g)) {
      const name = id[1] ?? id[2];
      if (seen.has(name)) continue;
      seen.add(name);
      const v = constValue(src, name);
      if (v) out += ` ${expand(v)}`;
    }
    return out;
  };
  text = expand(text);
  return text;
}

const SIZE = { xs: 12, sm: 14, base: 16 };
/** Smallest explicit font-size (px) among the unprefixed-by-file/placeholder text-size tokens, or null when none. */
function smallestSize(cls) {
  let min = null;
  for (const raw of cls.split(/[\s"'`{}]+/)) {
    if (!raw) continue;
    const parts = raw.split(':');
    const token = parts[parts.length - 1];
    if (parts.slice(0, -1).some((v) => v === 'file' || v === 'placeholder')) continue;
    let px = null;
    const arb = token.match(/^text-\[([\d.]+)px\]$/);
    if (arb) px = Number(arb[1]);
    else if (/^text-(xs|sm|base)$/.test(token)) px = SIZE[token.slice(5)];
    if (px !== null && (min === null || px < min)) min = px;
  }
  return min;
}

// S1
const found = new Map();
for (const f of [...walkTsx('app'), ...walkTsx('components')]) {
  const tags = controlTags(readRepoFile(f));
  // The honeypot is a hidden decoy field (aria-hidden wrapper); a file whose only control is the honeypot has no visible text entry.
  if (tags.some((t) => !t.honeypot)) found.set(f, tags);
}
for (const f of found.keys()) if (!C.files[f]) failures.push(`S1 ${f} renders a text-entry control and is not classified in goldens/controls.json`);
for (const f of Object.keys(C.files)) if (!found.has(f)) failures.push(`S1 ${f} is in goldens/controls.json but renders no text-entry control`);

// S2
for (const [f, spec] of Object.entries(C.files)) {
  if (spec.kind !== 'own' || !found.has(f)) continue;
  const src = readRepoFile(f);
  for (const t of found.get(f)) {
    if (t.honeypot) continue;
    const cls = resolvedClass(src, t.text);
    if (cls === null) { failures.push(`S2 ${f}:${t.line} control has no className the check can resolve: ${t.text.slice(0, 80)}`); continue; }
    const px = smallestSize(cls);
    if (px !== null && px < 16) failures.push(`S2 ${f}:${t.line} control resolves to ${px}px, needs >= 16px`);
    if (spec.requireLeading && px === null) failures.push(`S2 ${f}:${t.line} control carries no explicit text size`);
    if (spec.requireLeading && !/(^|[\s"'`{])leading-/.test(cls)) failures.push(`S2 ${f}:${t.line} control does not pin its line-height (leading-*), so its box height would move`);
  }
}

// S3
const theme = readRepoFile('app/(marketing)/national-show/nos-theme.css') ?? '';
if (!/\.nos-theme\s*:is\(input, select, textarea\):not\([\s\S]*?\)\s*\{\s*font-size:\s*var\(--body-md\);\s*\}/.test(theme)) failures.push('S3 the unlayered .nos-theme text-control rule (font-size: var(--body-md)) is missing or changed in nos-theme.css');
if (!/--body-md:\s*16px/.test(readRepoFile('app/globals.css') ?? '')) failures.push('S3 --body-md is no longer 16px in app/globals.css');
for (const m of C.propMounts) if (!new RegExp(m.mustMatch).test(readRepoFile(m.file) ?? '')) failures.push(`S3 ${m.file} no longer matches /${m.mustMatch}/`);

// S4
const SIZE_TOKEN = /(?<![\w:-])(?:text-(?:xs|sm|base)|text-\[[\d.]+px\]|h-\[\d+px\]|leading-(?:\[[\d.]+px\]|[\w.]+))(?![\w-])/g;
const squash = (s) => s.replace(SIZE_TOKEN, '').replace(/\s+/g, ' ').replace(/ (["'`])/g, '$1');
const SPEC_OR_DOC = (p) => p.startsWith(SPEC_PREFIX) || p === DOC;
const changed = [...changedPaths()].filter((p) => !SPEC_OR_DOC(p));
for (const p of changed) {
  const head = readRepoFile(p);
  const base = readBaseFile(p);
  if (head === null || base === null) { failures.push(`S4 ${p} was added or deleted; the sweep only edits existing class strings`); continue; }
  if (!p.endsWith('.tsx')) { failures.push(`S4 ${p} is not a .tsx file: the sweep is per-component classes only`); continue; }
  if (squash(head) !== squash(base)) failures.push(`S4 ${p} differs from base by more than text-size / leading tokens`);
  const lines = git('diff', '--numstat', '85cf0814', '--', p).trim().split('\t');
  const cap = 2 * controlTags(head).length;
  if (Number(lines[0]) + Number(lines[1]) > cap) failures.push(`S4 ${p} changes ${Number(lines[0]) + Number(lines[1])} lines, more than 2 per control tag (${cap})`);
}

// S5
for (const p of changed) {
  if (/\.(css|scss)$/.test(p) || /globals|tokens|theme|tailwind/i.test(p)) failures.push(`S5 ${p} is a style/token file: out of scope (no new tokens)`);
}
const added = git('diff', '-U0', '85cf0814', '--', ...changed).split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'));
for (const l of added) {
  if (/--[a-z][\w-]*\s*:/.test(l)) failures.push(`S5 a diff line adds a custom property: ${l.slice(0, 100)}`);
  if (/#[0-9a-fA-F]{3,8}\b/.test(l)) failures.push(`S5 a diff line adds a hex colour: ${l.slice(0, 100)}`);
}
const doc = existsSync(path.join(repoRoot, DOC)) ? readFileSync(path.join(repoRoot, DOC), 'utf8') : null;
if (doc === null) failures.push(`S5 ${DOC} is missing`);
else for (const needle of ['16px', '/admin-fixtures', 'VendorPaymentLinkControl', 'VendorPhotoLinkControl', 'member session', 'iOS']) if (!doc.includes(needle)) failures.push(`S5 ${DOC} does not mention "${needle}"`);

finish('static.mjs', failures, `${found.size} control files classified, own files resolve >= 16px, nos rule intact, ${changed.length} changed file(s) are class-only.`);
