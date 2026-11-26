// Static scan: every anchor that leaves the site must open in a new tab.
//
// Brad (26 Nov 2026): a link to the other site (SAOC <-> National Orchid Show) or to any external
// origin opens in a new tab. The central rule is lib/link-target.ts, applied by components/ui/SiteLink.tsx
// and the portable-text link mark. This scan fails when a hand-written anchor bypasses it:
//   1. a plain <a> whose href is an absolute http(s) URL, or is built by nosUrl()/saocUrl(), or is any
//      other expression not listed in anchor-allowlist.json, and has no target="_blank" plus a rel
//      with noopener and noreferrer, plus the screen-reader cue;
//   2. a next/link <Link> whose href is external, or built by nosUrl()/saocUrl() (use SiteLink);
//   3. a <PortableText> in a file that does not use portableLinkMarks().
// Pure file reading: no server, no build, no child process.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SCAN_DIRS = ['components', 'app'];
const SKIP_DIRS = new Set(['admin', 'api', 'node_modules']);
const CUE_MARKERS = ['NEW_TAB_CUE', '(opens in a new tab)'];
const SAFE_LITERAL = /^(#|\/(?!\/)|mailto:|tel:|sms:)/i;
const SAFE_TEMPLATE_OR_EXPR = /^`(#|mailto:|tel:|sms:)/i;
const ABSOLUTE = /^(https?:)?\/\//i;

export function listSourceFiles(dir = ROOT) {
  const out = [];
  const walk = (current) => {
    for (const name of readdirSync(current)) {
      const full = join(current, name);
      if (statSync(full).isDirectory()) {
        if (!SKIP_DIRS.has(name)) walk(full);
      } else if (name.endsWith('.tsx')) {
        out.push(full);
      }
    }
  };
  for (const sub of SCAN_DIRS) walk(join(dir, sub));
  return out;
}

/** Opening tags `<tag ...>` with their raw text, honouring {} nesting and quoted strings. */
export function openingTags(source, tag) {
  const tags = [];
  const start = new RegExp(`<${tag}(?=[\\s/>])`, 'g');
  let match;
  while ((match = start.exec(source)) !== null) {
    let depth = 0;
    let quote = null;
    let i = match.index + tag.length + 1;
    for (; i < source.length; i += 1) {
      const ch = source[i];
      if (quote) {
        if (ch === quote && source[i - 1] !== '\\') quote = null;
      } else if (ch === '"' || ch === "'" || (ch === '`' && depth > 0)) {
        quote = ch;
      } else if (ch === '{') {
        depth += 1;
      } else if (ch === '}') {
        depth -= 1;
      } else if (ch === '>' && depth === 0) {
        break;
      }
    }
    tags.push({ text: source.slice(match.index, i + 1), index: match.index });
  }
  return tags;
}

/** The href as { kind: 'literal' | 'expr', value } or null when the tag has none. */
export function hrefOf(tagText) {
  const literal = /\shref="([^"]*)"/.exec(tagText);
  if (literal) return { kind: 'literal', value: literal[1] };
  const at = tagText.search(/\shref=\{/);
  if (at === -1) return null;
  let depth = 0;
  const open = tagText.indexOf('{', at);
  for (let i = open; i < tagText.length; i += 1) {
    if (tagText[i] === '{') depth += 1;
    if (tagText[i] === '}') {
      depth -= 1;
      if (depth === 0) return { kind: 'expr', value: tagText.slice(open + 1, i).trim() };
    }
  }
  return null;
}

function lineOf(source, index) {
  return source.slice(0, index).split('\n').length;
}

function leavesSite(href) {
  if (href.kind === 'literal') return ABSOLUTE.test(href.value);
  return /\b(nosUrl|saocUrl)\(/.test(href.value) || /^['"]https?:\/\//.test(href.value);
}

function isSafeInternal(href) {
  if (href.kind === 'literal') return SAFE_LITERAL.test(href.value);
  return SAFE_TEMPLATE_OR_EXPR.test(href.value);
}

function hasNewTabAttrs(tagText) {
  return (
    /\starget=("_blank"|\{'_blank'\})/.test(tagText) &&
    /\srel="[^"]*\bnoopener\b[^"]*\bnoreferrer\b[^"]*"|\srel=\{NEW_TAB_REL\}/.test(tagText)
  );
}

export function checkSource(source, file, allowlist) {
  const problems = [];
  const hasCue = CUE_MARKERS.some((marker) => source.includes(marker));

  for (const tag of openingTags(source, 'a')) {
    const href = hrefOf(tag.text);
    if (href === null || isSafeInternal(href) || /\sdownload[\s=>/]/.test(tag.text)) continue;
    const key = `${file}::${href.value}`;
    const external = leavesSite(href);
    if (!external && allowlist.has(key)) continue;
    const where = `${file}:${lineOf(source, tag.index)}`;
    if (!hasNewTabAttrs(tag.text)) {
      const why = external ? 'leaves the site' : 'has an unclassified href (allowlist it or use SiteLink)';
      problems.push(`${where} <a href=${href.value}> ${why} but lacks target="_blank" and rel="noopener noreferrer"`);
    } else if (!hasCue) {
      problems.push(`${where} <a href=${href.value}> opens a new tab but the file has no "(opens in a new tab)" cue`);
    }
  }

  for (const tag of openingTags(source, 'Link')) {
    const href = hrefOf(tag.text);
    if (href !== null && leavesSite(href)) {
      problems.push(`${file}:${lineOf(source, tag.index)} <Link href=${href.value}> leaves the site: use SiteLink`);
    }
  }

  if (/<PortableText[\s/>]/.test(source) && !source.includes('portableLinkMarks')) {
    problems.push(`${file} renders <PortableText> without portableLinkMarks()`);
  }
  return problems;
}

export function loadAllowlist() {
  const raw = JSON.parse(readFileSync(new URL('./anchor-allowlist.json', import.meta.url), 'utf8'));
  return new Set(raw.entries.map((entry) => `${entry.file}::${entry.href}`));
}

export function scanRepo() {
  const allowlist = loadAllowlist();
  const problems = [];
  for (const full of listSourceFiles()) {
    const file = relative(ROOT, full).split(sep).join('/');
    problems.push(...checkSource(readFileSync(full, 'utf8'), file, allowlist));
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = scanRepo();
  if (problems.length > 0) {
    console.error(`FAIL: ${problems.length} cross-site or external link(s) would open in the same tab`);
    for (const line of problems) console.error(`  ${line}`);
    process.exit(1);
  }
  console.log('PASS: every cross-site and external anchor has target="_blank", rel and the new-tab cue');
}
